# Phase 3 — Consuming, retries, dead-lettering

**Goal:** one background worker that starts a consumer for every subscribed module — `habit`,
`habit-entry`, `habit-user`, `search`. Each consumer reads its queue, calls only that module's handlers in a fresh
DI scope, acks on success, retries failures after a delay, and parks messages that keep failing.
Every cross-module reaction runs again, off the request path, and every handler is safe to run
twice.

**Builds on:** tutorials [2](https://www.rabbitmq.com/tutorials/tutorial-two-dotnet) (manual
acks, prefetch) and [4](https://www.rabbitmq.com/tutorials/tutorial-four-dotnet) (bindings), and
the [dead letter exchanges](https://www.rabbitmq.com/docs/dlx), [TTL](https://www.rabbitmq.com/docs/ttl)
and [quorum queues](https://www.rabbitmq.com/docs/quorum-queues) docs.

```
src/Dailu.Infrastructure/Messaging/
├── RabbitMqTopology.cs               ← + DeclareConsumerAsync: main, retry and dead-letter queues
├── DeathHeader.cs                    ← reads the attempt count from x-death
├── ModuleHandlers.cs                 ← invokes INotificationHandler<T> from one assembly only
├── RabbitMqQueueConsumer.cs          ← one queue: channel, deliveries, ack / retry / park
├── RabbitMqConsumerWorker.cs         ← one BackgroundService, a RabbitMqQueueConsumer per subscription
└── Setup.cs                          ← AddRabbitMq registers the worker

src/shared/SharedKernel/Persistence/IAppDbContextBase.cs         ← + ExecuteLockedAsync (3.6)
src/shared/SharedInfrastructure/Persistence/AppDbContextBase.cs  ← advisory-lock implementation (3.6)
```

The same topology repeats for each of the four queues. Here it is for `search`:

```
              dailu.integration (topic)
                 │ bindings: HabitNameDescriptionChangedIntegrationEvent,
                 │           HabitEntryNoteChangedIntegrationEvent, TagNameChangedIntegrationEvent
                 ▼
   ┌──────────► search  (quorum; DLX "" → "search.retry")
   │             │
   │             ├─ handler ok ───────────────────────► ack
   │             ├─ handler throws, attempt < 5 ──────► nack(requeue: false) ──┐
   │             └─ attempt 5, or unreadable message ─► copy to search.dlq, ack │
   │                                                                           ▼
   └── TTL 10 s expires ◄──────────── search.retry  (quorum; x-message-ttl 10000; DLX "" → "search")

                                       search.dlq   (quorum; nothing consumes it — inspect by hand)
```

`habit`, `habit-entry` and `habit-user` get the same three queues, bound to their own events
(phase 2, 2.7).

---

## 3.1 Topology

Each consumer declares its own three queues. Add to `RabbitMqTopology.cs`:

```csharp
public const int RetryDelayMs = 10_000;

public static string RetryQueueOf(string queue) => $"{queue}.retry";
public static string DeadLetterQueueOf(string queue) => $"{queue}.dlq";

public static async Task DeclareConsumerAsync(
    IChannel channel,
    IntegrationEventSubscription subscription,
    CancellationToken ct
)
{
    var retryQueue = RetryQueueOf(subscription.Queue);

    await channel.ExchangeDeclareAsync(Exchange, ExchangeType.Topic, durable: true, autoDelete: false, cancellationToken: ct);

    await channel.QueueDeclareAsync(
        subscription.Queue,
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: new Dictionary<string, object?>
        {
            ["x-queue-type"] = "quorum",
            ["x-dead-letter-exchange"] = "",                       // default exchange: routes by queue name
            ["x-dead-letter-routing-key"] = retryQueue,
        },
        cancellationToken: ct
    );

    await channel.QueueDeclareAsync(
        retryQueue,
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: new Dictionary<string, object?>
        {
            ["x-queue-type"] = "quorum",
            ["x-message-ttl"] = RetryDelayMs,
            ["x-dead-letter-exchange"] = "",
            ["x-dead-letter-routing-key"] = subscription.Queue,      // expired → back to the main queue
        },
        cancellationToken: ct
    );

    await channel.QueueDeclareAsync(
        DeadLetterQueueOf(subscription.Queue),
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: new Dictionary<string, object?> { ["x-queue-type"] = "quorum" },
        cancellationToken: ct
    );

    foreach (var eventType in subscription.EventTypes)
    {
        await channel.QueueBindAsync(
            subscription.Queue,
            Exchange,
            routingKey: IntegrationEventTypes.NameOf(eventType),
            cancellationToken: ct
        );
    }
}
```

- **Retry and dead-letter names live here, not on the subscription.** `.retry` / `.dlq` are a
  RabbitMQ topology detail; `IntegrationEventSubscription` in `SharedInfrastructure` only knows
  the main queue's name.
- **The default exchange (`""`)** routes a message to the queue whose name equals the routing
  key. Using it as the dead-letter exchange means no extra exchanges for retries: dead-lettering
  from `search` with routing key `search.retry` lands in `search.retry`, and vice versa.
- **Retry by TTL.** Nothing consumes `search.retry`. A message sits there for 10 s, expires, is
  dead-lettered back into `search`, and is delivered again. The delay lives in the broker, not
  in a `Task.Delay` that would block the consumer.
- **The cycle is allowed.** RabbitMQ drops a dead-lettered message that has gone round a cycle
  only if no *rejection* happened in it. Every trip here starts with your `nack`, so it isn't
  treated as an infinite loop — the attempt limit in 3.4 is what ends it.
- **Arguments are part of a queue's identity.** Declaring an existing queue with different
  arguments fails with `PRECONDITION_FAILED` and closes the channel. To change the TTL or the
  queue type later, delete the queue (or use a policy) — re-declaring won't update it.
- **Removed bindings stay.** Deleting a module's last handler for an event doesn't unbind it;
  unbind it in the UI, or call `QueueUnbindAsync` once. Until you do, the event keeps arriving
  and the worker throws "has no handler for it" (3.3) until it's parked.
- **Decision:** a fixed 10 s delay. Exponential backoff needs one retry queue per delay (e.g.
  `search.retry.10s`, `.1m`, `.5m`) and picking the queue by attempt — a good exercise once this
  works.

## 3.2 Counting attempts

Each time a message is dead-lettered, the broker adds or updates an entry in its `x-death`
header: which queue it left, why (`rejected`, `expired`, …), and how many times. The number of
times it was rejected from the main queue is the number of failed attempts.

`src/Dailu.Infrastructure/Messaging/DeathHeader.cs`:

```csharp
internal static class DeathHeader
{
    /// <summary>How many times the message was rejected from <paramref name="queue"/>.</summary>
    public static long RejectedCount(IReadOnlyBasicProperties properties, string queue)
    {
        if (properties.Headers?.TryGetValue("x-death", out var raw) != true || raw is not IEnumerable<object> deaths)
        {
            return 0;
        }

        foreach (var death in deaths.OfType<IDictionary<string, object?>>())
        {
            if (Text(death, "queue") == queue
                && Text(death, "reason") == "rejected"
                && death.TryGetValue("count", out var count)
                && count is long n)
            {
                return n;
            }
        }

        return 0;
    }

    // AMQP strings arrive as byte[] in header tables
    private static string? Text(IDictionary<string, object?> table, string key) =>
        table.TryGetValue(key, out var value) && value is byte[] bytes ? Encoding.UTF8.GetString(bytes) : value as string;
}
```

Set a breakpoint and look at the header the first time a retry comes back — it's the fastest way
to understand what the broker records.

## 3.3 Calling only this module's handlers

`IPublisher.Publish` would run **every** module's handler for the event — the bug the per-module
queue is meant to avoid. Instead, resolve the handlers and keep the ones from the subscribing
module's assembly.

`src/Dailu.Infrastructure/Messaging/ModuleHandlers.cs`:

```csharp
internal static class ModuleHandlers
{
    private delegate Task Invoker(IServiceProvider services, IIntegrationEvent @event, Assembly module, CancellationToken ct);

    private static readonly ConcurrentDictionary<Type, Invoker> Invokers = new();

    public static Task InvokeAsync(IServiceProvider services, IIntegrationEvent @event, Assembly module, CancellationToken ct) =>
        Invokers.GetOrAdd(@event.GetType(), Build)(services, @event, module, ct);

    private static Invoker Build(Type eventType) =>
        typeof(ModuleHandlers)
            .GetMethod(nameof(InvokeTypedAsync), BindingFlags.NonPublic | BindingFlags.Static)!
            .MakeGenericMethod(eventType)
            .CreateDelegate<Invoker>();

    private static async Task InvokeTypedAsync<TEvent>(
        IServiceProvider services,
        IIntegrationEvent @event,
        Assembly module,
        CancellationToken ct
    )
        where TEvent : IIntegrationEvent
    {
        var handlers = services
            .GetServices<INotificationHandler<TEvent>>()
            .Where(h => h.GetType().Assembly == module)
            .ToList();

        if (handlers.Count == 0)
        {
            throw new InvalidOperationException(
                $"{module.GetName().Name} subscribes to {typeof(TEvent).Name} but has no handler for it."
            );
        }

        foreach (var handler in handlers)
        {
            await handler.Handle((TEvent)@event, ct);
        }
    }
}
```

- **`INotificationHandler<T>`, not `IEventHandler<T>`.** `IEventHandler<T>` is Dailu's marker
  interface; the Mediator source generator registers handlers under `INotificationHandler<T>`.
  Check in the Verify step that `GetServices<INotificationHandler<TagNameChangedIntegrationEvent>>()`
  really returns the search handler — if it's empty, the generator registers only the concrete
  type and you'll register the interface mapping yourself (Scrutor is already referenced).
- **Several handlers, one message.** `habit` has four handlers for
  `IntegrationActivitiesDetectedIntegrationEvent`. If one throws, the retry runs all four again.
  Every handler must be safe to repeat — that's at-least-once delivery, not a quirk of this code.
  3.7 goes through the current handlers.

## 3.4 The worker

Two classes: a plain `RabbitMqQueueConsumer` that handles one queue, and one hosted
`RabbitMqConsumerWorker` that creates a consumer per subscription the modules declared (phase 2,
2.5).

`src/Dailu.Infrastructure/Messaging/RabbitMqQueueConsumer.cs`:

```csharp
/// <summary>Consumes one module's queue. Created by <see cref="RabbitMqConsumerWorker"/>, not by DI.</summary>
public sealed class RabbitMqQueueConsumer(
    IntegrationEventSubscription subscription,
    RabbitMqConnection connection,
    IServiceScopeFactory scopeFactory,
    ILogger<RabbitMqQueueConsumer> logger
)
{
    private const int MaxAttempts = 5;

    private readonly IntegrationEventSubscription _subscription = subscription;
    private readonly string _deadLetterQueue = RabbitMqTopology.DeadLetterQueueOf(subscription.Queue);

    private IChannel? _channel;

    public async Task RunAsync(CancellationToken stoppingToken)
    {
        // automatic recovery only covers connections that were established once,
        // so the first connect (broker still starting) is retried here
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await StartConsumingAsync(stoppingToken);
                return;                     // deliveries now arrive on the client's dispatcher
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Can't start consuming {Queue}; retrying in 10 s", _subscription.Queue);
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }
    }

    private async Task StartConsumingAsync(CancellationToken ct)
    {
        var amqpConnection = await connection.GetAsync(ct);
        _channel = await amqpConnection.CreateChannelAsync(cancellationToken: ct);

        await RabbitMqTopology.DeclareConsumerAsync(_channel, _subscription, ct);

        // one unacked message at a time: in order, and a slow handler can't
        // pull the whole queue into memory
        await _channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false, ct);

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.ReceivedAsync += OnReceivedAsync;

        await _channel.BasicConsumeAsync(_subscription.Queue, autoAck: false, consumer, ct);
    }

    private async Task OnReceivedAsync(object sender, BasicDeliverEventArgs delivery)
    {
        var channel = ((AsyncEventingBasicConsumer)sender).Channel;

        IIntegrationEvent integrationEvent;
        try
        {
            var type = IntegrationEventTypes.Resolve(delivery.BasicProperties.Type ?? "");
            integrationEvent = (IIntegrationEvent)
                JsonSerializer.Deserialize(delivery.Body.Span, type, IntegrationEventJson.Options)!;
        }
        catch (Exception ex)
        {
            // retrying can't fix a message we can't read
            await ParkAsync(channel, delivery, ex);
            return;
        }

        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            await ModuleHandlers.InvokeAsync(
                scope.ServiceProvider,
                integrationEvent,
                _subscription.Module,
                delivery.CancellationToken
            );

            await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false);
        }
        catch (Exception ex)
        {
            var attempt = DeathHeader.RejectedCount(delivery.BasicProperties, _subscription.Queue) + 1;

            if (attempt >= MaxAttempts)
            {
                await ParkAsync(channel, delivery, ex);
                return;
            }

            logger.LogWarning(
                ex,
                "{EventType} {MessageId} failed (attempt {Attempt}/{MaxAttempts}); retrying in {Delay} ms",
                delivery.BasicProperties.Type,
                delivery.BasicProperties.MessageId,
                attempt,
                MaxAttempts,
                RabbitMqTopology.RetryDelayMs
            );

            // requeue: false → dead-lettered to the retry queue instead of straight back to the front
            await channel.BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: false);
        }
    }

    private async Task ParkAsync(IChannel channel, BasicDeliverEventArgs delivery, Exception error)
    {
        logger.LogError(
            error,
            "Parking {EventType} {MessageId} in {DeadLetterQueue}",
            delivery.BasicProperties.Type,
            delivery.BasicProperties.MessageId,
            _deadLetterQueue
        );

        var properties = new BasicProperties(delivery.BasicProperties)
        {
            Headers = new Dictionary<string, object?>(
                delivery.BasicProperties.Headers ?? new Dictionary<string, object?>()
            )
            {
                ["x-last-error"] = error.Message,
            },
        };

        // body is only valid until this handler returns, so publish before acking
        await channel.BasicPublishAsync("", _deadLetterQueue, mandatory: false, properties, delivery.Body);
        await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false);
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_channel is not null)
        {
            // unacked in-flight message goes back to the queue and is redelivered on next start
            await _channel.CloseAsync(cancellationToken);
            await _channel.DisposeAsync();
        }
    }
}
```

`src/Dailu.Infrastructure/Messaging/RabbitMqConsumerWorker.cs`:

```csharp
public sealed class RabbitMqConsumerWorker : BackgroundService
{
    private readonly RabbitMqQueueConsumer[] _consumers;

    public RabbitMqConsumerWorker(
        IEnumerable<IntegrationEventSubscription> subscriptions,
        RabbitMqConnection connection,
        IServiceScopeFactory scopeFactory,
        ILoggerFactory loggerFactory
    )
    {
        var all = subscriptions.ToArray();

        // runs when the host starts: a bad subscription fails startup, not the first message
        var duplicate = all.GroupBy(s => s.Queue).FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null)
        {
            throw new InvalidOperationException($"Queue '{duplicate.Key}' is subscribed by more than one module.");
        }

        foreach (var eventType in all.SelectMany(s => s.EventTypes))
        {
            IntegrationEventTypes.NameOf(eventType);
        }

        var consumerLogger = loggerFactory.CreateLogger<RabbitMqQueueConsumer>();

        _consumers = all
            .Select(s => new RabbitMqQueueConsumer(s, connection, scopeFactory, consumerLogger))
            .ToArray();
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
        Task.WhenAll(_consumers.Select(c => c.RunAsync(stoppingToken)));

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        foreach (var consumer in _consumers)
        {
            await consumer.StopAsync(cancellationToken);
        }

        await base.StopAsync(cancellationToken);
    }
}
```

Register it in `AddRabbitMq()` (`Messaging/Setup.cs`), next to the publisher:

```csharp
services.AddHostedService<RabbitMqConsumerWorker>();
```

- **One worker, one consumer per queue.** The worker isn't tied to any module. It reads whatever
  subscriptions the modules declared, so there's no generic `TModuleRoot` and no per-module
  registration in the host. Each `RabbitMqQueueConsumer` has its own channel, prefetch and
  start-up retry loop, so one queue failing to start (e.g. `PRECONDITION_FAILED` on a changed
  argument) doesn't stop the others.
- **No `IsEnabled` check in the worker.** `AddRabbitMq()` is only called when RabbitMQ is on
  (phase 1, 1.5), so the worker only exists when it should run. With the switch off, the
  subscriptions are still in DI, but nothing reads them.
- **Consumers aren't in DI.** The worker creates them with `new`, because there's one per
  subscription and their only varying input is that subscription. They share one logger
  category; the queue name is in every log line.
- **`ILoggerFactory`, not `ILogger<RabbitMqQueueConsumer>`.** Injecting another type's logger
  into the worker trips SonarAnalyzer S6672 ("use its enclosing type"), which fails the build.
  Creating it from the factory is the intended way for objects you construct yourself.
- **Startup checks in the constructor.** Hosted services are constructed when the host starts,
  so an event type missing from `IntegrationEventTypes`, or two modules claiming the same queue,
  stops the API before it serves a request — the check `AddRabbitMqConsumer` used to make.
- **`ExecuteAsync` returns only once every queue is consuming.** If the broker is down, the
  `Task.WhenAll` simply waits while each consumer retries. It doesn't block the rest of the
  host: `BackgroundService` starts `ExecuteAsync` without waiting for it to finish.
- **Manual acks.** `autoAck: false` means the broker keeps the message until you ack it. If the
  API crashes while a handler is running, the message is redelivered on the next start.
- **New scope per message.** Handlers get a fresh `DbContext` and scoped services, like the
  `PeriodicTimer` workers (`StravaActivityWorker`). There's no HTTP request and no current user —
  events carry `UserId` for exactly this reason (see `docs/search/02-indexing.md`).
- **Events published from a handler go to the broker too.** A handler that publishes through
  `IEventDispatcher` / `IIntegrationEventBus` gets the scoped `RabbitMqIntegrationEventBus`, so
  the next module receives it from its own queue. If that publish fails, the bus throws
  `IntegrationEventPublishException` (phase 2, 2.6), nothing catches it — handlers aren't called
  through `EventDispatchingBehavior` here — and the incoming message is retried.
- **`RunAsync` returns after subscribing.** The consumer keeps running on the client's
  dispatcher; nothing needs to loop. Automatic recovery re-registers the
  consumer after a broker restart.
- **Parking without confirms.** The consumer channel has no publisher confirms, so a broker crash
  in the instant between the DLQ publish and the ack could lose a parked message. Acceptable for
  a "look at this by hand" queue; enable confirms on the channel if you want to close it.

## 3.5 What the search handlers must do

The worker's contract is **throw = retry, return = done**. Look at the three handlers in
`Search.Application/EventHandlers` with that in mind:

- **Ollama down / timeout** — `IEmbeddingGenerator.GenerateAsync` throws, nothing catches it, the
  worker retries. Correct.
- **Wrong vector size** — `SearchIndexService` returns `Result.Failure`, the handler logs it and
  returns, the message is acked. Correct: retrying won't change the model's output size.
- **Database transient error** — `EnableRetryOnFailure` retries inside EF first; if it still
  fails it throws, and the worker retries later. Correct.
- **Bound the embedding call.** With prefetch 1, a call that hangs for the default 100 s
  `HttpClient` timeout stalls the whole `search` queue. Give the embedding client a timeout of a
  few seconds, as `02-indexing.md` already recommends.

## 3.6 A database lock: `ExecuteLockedAsync`

At-least-once delivery means a handler and a request (or two deliveries of the same message) can
run the same "check, then insert" at the same moment. Both see "missing", both insert. 3.7 needs
exactly this for the `HabitUser`, and it won't be the last place.

Check-then-insert is only safe if two callers can't run it for the same key at the same time.
An in-process `SemaphoreSlim` can't promise that (a second API instance, or consumers moved to
their own host, has its own), and `SELECT … FOR UPDATE` can't lock a row that doesn't exist yet.
A **Postgres advisory lock** can: a lock on an arbitrary number, held by the transaction,
respected by every connection to the database.

This section only adds the tool. Nothing uses it until 3.7.

Put it next to `ExecuteTransactionalAsync`, so every module's DbContext gets it.

`src/shared/SharedKernel/Persistence/IAppDbContextBase.cs`, add:

```csharp
/// <summary>
/// Runs <paramref name="action"/> in a transaction that first takes a database-wide lock on
/// <paramref name="lockKey"/>. Concurrent calls with the same key — from any process — run one
/// after another. Pending changes are saved and committed at the end, like ExecuteTransactionalAsync.
/// </summary>
Task<T> ExecuteLockedAsync<T>(
    string lockKey,
    Func<Task<T>> action,
    CancellationToken cancellationToken = default
);
```

`src/shared/SharedInfrastructure/Persistence/AppDbContextBase.cs`, add:

```csharp
public Task<T> ExecuteLockedAsync<T>(
    string lockKey,
    Func<Task<T>> action,
    CancellationToken cancellationToken = default
) =>
    ExecuteTransactionalAsync(
        async () =>
        {
            // give up instead of waiting forever if the holder is stuck
            await Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", cancellationToken);

            // released automatically at commit or rollback
            await Database.ExecuteSqlAsync(
                $"SELECT pg_advisory_xact_lock(hashtextextended({lockKey}, 0))",
                cancellationToken
            );

            return await action();
        },
        cancellationToken
    );
```

- **`pg_advisory_xact_lock`, never `pg_advisory_lock`.** The `_xact_` variant belongs to the
  transaction and is released at commit or rollback. The session variant belongs to the
  *connection*, and with connection pooling a lock you forget to release stays on a pooled
  connection that some unrelated request picks up later.
- **The key is text, the lock is a number.** `hashtextextended(key, 0)` turns the string into the
  64-bit number Postgres locks on. Two different keys could hash to the same number; then they
  just wait for each other once. That's harmless.
- **The key is a parameter.** `ExecuteSqlAsync` with an interpolated string sends `{lockKey}` as
  a SQL parameter, not as text in the query, so a key can't inject SQL. `SET LOCAL` can't take
  parameters, which is why its value is a constant.
- **`lock_timeout` bounds the wait.** If a holder hangs, the waiter fails after 5 s with a
  "lock not available" error instead of hanging the request. In a consumer, that's a normal
  retry.
- **Namespace your keys.** Advisory locks are database-wide, so use keys like
  `habit-user:{id}`, not just `{id}`.
- **No Npgsql types.** It's Postgres-specific SQL, but plain EF APIs, so `SharedInfrastructure`
  needs no new reference. The whole app runs on Postgres anyway.
- **Don't nest it.** It starts its own transaction, so calling it inside another
  `ExecuteTransactionalAsync` fails ("a transaction is already in progress").
- **It saves everything pending.** Like `ExecuteTransactionalAsync`, it calls `SaveChangesAsync`
  at the end, so call it *before* making other changes on the same context, or they're committed
  with it.
- **A lock doesn't replace a unique constraint.** It only protects code that takes it. Anything
  that writes without it (a script, a migration, a future command) isn't stopped. Wherever you
  use it to prevent duplicates, keep a unique index as the guarantee.

**Verify.** Write a small test or a scratch endpoint: two tasks call `ExecuteLockedAsync` with the
same key, each `await Task.Delay(2000)` inside. The second one finishes about 2 s after the first.
With different keys, both finish together. In `psql`, `SELECT * FROM pg_locks WHERE locktype =
'advisory';` shows the lock while the first one holds it.

## 3.7 Making the other handlers safe to repeat

Same contract, plus at-least-once: any message can arrive twice. Go through each handler and ask
"what happens on the second run?"

| Handler | Second run today | What to do |
|---|---|---|
| `IdentityUserCreatedIntegrationEventHandler` (`habit-user`) | Inserts **another** `HabitUser` row — there's no unique index on `IdentityUserId` | Add a unique index on `IdentityUserId` and create the user through `GetOrCreateHabitUserAsync` — both in "The registration race" below |
| `HabitEntryCreatedIntegrationEventHandler` (`habit`) | Safe: `HabitAggregate.Complete` returns early when `completedAtUtc <= LastCompletedAtUtc` | Nothing. A concurrency conflict on `Version` (the user edited the habit at the same moment) throws and is retried, which is what you want |
| `HabitAutomationEntriesDetectedIntegrationEventHandler` (`habit-entry`) | Safe for its own rows: existing entries are matched by `(HabitId, ExternalId)` and updated or skipped. But it **saves, then publishes** the entries' events: if the publish fails, the retry finds the entries already there and doesn't raise their events again, so e.g. `HabitEntryCompletedIntegrationEvent` is lost | A unique index on `(HabitId, ExternalId)` protects against two deliveries racing. The save-then-publish gap is what the outbox fixes — accept it until then |
| The four `IntegrationActivitiesDetected` handlers (`habit`) | Each filters by `Source`, so only one does work; a rerun publishes the same entries again, which `habit-entry` deduplicates | Nothing. They publish through `IEventDispatcher.SendAsync`, so the event goes through the bus to `habit-entry`'s own queue |

**Rule: publish integration events only through `IEventDispatcher` / `IIntegrationEventBus`,
never with `IPublisher.Publish` directly.** A direct `Publish` skips the broker: the other
module's handler would run in-process inside *this* module's message, its failures would retry
and park this module's message, and its own queue's retries wouldn't apply.

### The registration race

`IdentityUserCreatedIntegrationEvent` now creates the `HabitUser` a moment after
`RegisterUserCommand` returns: usually milliseconds later, but up to minutes if the `habit-user`
queue is retrying or RabbitMQ is down. Every request that needs the `HabitUser` before then
fails.

**Who needs it.** Four places look a `HabitUser` up by `IdentityUserId` and give up when it's
missing:

| Where | Today when missing |
|---|---|
| `SaveIntegrationConfigCommand` | `Result.Failure("Habit user not found.")` |
| `HandleGithubCallbackCommand` | `Result.Failure("User not found.")` → redirect with `github_error` |
| `HandleGoogleHealthCallbackCommand` | same, `google_health_error` |
| `HandleStravaCallbackCommand` | same, `strava_error` |

Nothing else in `habit`, `habit-entry` or `tag` reads `HabitUser`. Those modules key their data
by the identity user id directly. So the race only hits a user who connects an integration
right after signing up. That's rare, but when it happens it's confusing: a fresh account whose
"Connect Strava" fails once and works a minute later. And if the event is ever *lost* (the gap
the outbox closes), those four commands fail for that user **forever**.

**Fix: create on first use.** Whoever needs the `HabitUser` first creates it — the event handler
or one of the four commands, whichever runs first. The others find it.

```
signup ──► RegisterUserCommand ──► IdentityUserCreatedIntegrationEvent ──► (later) handler ──┐
                                                                                             ├─► GetOrCreateHabitUserAsync(identityUserId)
user clicks "Connect Strava" ──► HandleStravaCallbackCommand ────────────────────────────────┘     one row, whoever is first
```

### 1. A unique index on `IdentityUserId`

In `HabitUserEntityConfiguration`:

```csharp
builder.HasIndex(h => h.IdentityUserId).IsUnique();
```

and a migration. This is what makes "whoever is first" safe: if the handler and a command insert
at the same moment, the database rejects the second row. Before adding it, check that the table
has no duplicates already — the handler inserted unconditionally until now:

```sql
SELECT identity_user_id, count(*) FROM habit_users GROUP BY identity_user_id HAVING count(*) > 1;
```

Merge or delete any duplicates first (repoint their `integration_configs` to the row you keep),
or the migration fails.

### 2. `GetOrCreateHabitUserAsync`

An extension method on the module's own `IHabitUserDbContext`, using `ExecuteLockedAsync` from
3.6.
`src/modules/habit-user/HabitUser.Application/Persistence/HabitUserDbContextExtensions.cs`:

```csharp
public static class HabitUserDbContextExtensions
{
    /// <summary>
    /// The HabitUser for this identity user, created if it doesn't exist yet. Only pass an id
    /// that's already authenticated — this creates rows for whatever id it's given.
    /// </summary>
    public static async Task<HabitUserEntity> GetOrCreateHabitUserAsync(
        this IHabitUserDbContext dbContext,
        Guid identityUserId,
        CancellationToken ct
    )
    {
        // fast path, no transaction: almost always the user exists already
        var existing = await dbContext.FindHabitUserAsync(identityUserId, ct);
        if (existing is not null)
        {
            return existing;
        }

        return await dbContext.ExecuteLockedAsync(
            $"habit-user:{identityUserId}",
            async () =>
            {
                // check again under the lock: whoever held it before us may have created it
                var createdMeanwhile = await dbContext.FindHabitUserAsync(identityUserId, ct);
                if (createdMeanwhile is not null)
                {
                    return createdMeanwhile;
                }

                var created = HabitUserAggregate.Create(identityUserId).ToEntity();
                dbContext.HabitUsers.Add(created);

                return created;             // ExecuteLockedAsync saves and commits
            },
            ct
        );
    }

    private static Task<HabitUserEntity?> FindHabitUserAsync(
        this IHabitUserDbContext dbContext,
        Guid identityUserId,
        CancellationToken ct
    ) =>
        dbContext.HabitUsers.AsNoTracking().FirstOrDefaultAsync(h => h.IdentityUserId == identityUserId, ct);
}
```

```
A: find → missing ── lock ── find → missing ── insert ── commit (unlock)
B: find → missing ── lock (waits for A) ─────────────────────────────── find → A's row ── commit (unlock)
```

- **Check, lock, check again.** The first check skips the transaction and the lock for every
  call after the first. That's almost all of them. The second check, under the lock, is the one
  that counts: it sees what the previous lock holder committed.
- **No Npgsql and no `catch`.** Two callers can't both reach the insert, so there's no unique
  violation to recognise in the normal case.
- **The unique index from step 1 stays.** The lock only protects code that takes it. A script, a
  migration, or a future command that inserts `HabitUser` directly bypasses it; the index still
  stops the duplicate. If that ever happens, the loser gets a plain error, and in a consumer a
  retry that then finds the row.
- **It commits on its own.** The new `HabitUser` is committed before the caller continues, so a
  command that fails afterwards still leaves the user created. That's fine: the row is correct
  either way, and creating it is the point.
- **Retries.** `ExecuteTransactionalAsync` runs inside EF's execution strategy, so a transient
  failure reruns the whole block: a new transaction, the lock again, the check again. A failure
  *during commit* is the one awkward case for any EF retry (the entity may already be marked as
  saved); the unique index is the backstop there too.
- **Alternative without a lock:** insert, catch `DbUpdateException`, and re-read. It's shorter and
  needs nothing shared, but the losing caller does a failed insert first. Either is correct with
  the unique index.

### 3. Use it everywhere

The event handler becomes:

```csharp
public sealed class IdentityUserCreatedIntegrationEventHandler(IHabitUserDbContext dbContext)
    : IEventHandler<IdentityUserCreatedIntegrationEvent>
{
    public async ValueTask Handle(IdentityUserCreatedIntegrationEvent notification, CancellationToken cancellationToken) =>
        await dbContext.GetOrCreateHabitUserAsync(notification.IdentityUserId, cancellationToken);
}
```

and in each of the four commands, the lookup plus `if (habitUser is null) return Result.Failure(...)`
becomes:

```csharp
var habitUser = await dbContext.GetOrCreateHabitUserAsync(userId, cancellationToken);
```

- **The handler is now safe to repeat**, which is what the 3.7 table asked for. A second delivery
  finds the row and does nothing.
- **The ids are trusted in all four places.** `SaveIntegrationConfigCommand` takes the id from
  `ICurrentUserService` (the JWT). The callbacks take it from the OAuth `state`, which the
  endpoint unprotects with `IDataProtector`, so it was issued to an authenticated user. Don't call
  `GetOrCreateHabitUserAsync` with an id from an unprotected query string or request body; it would create
  rows for any `Guid` someone sends.
- **The event still matters.** It creates the `HabitUser` for users who never touch the four
  commands, so that anything added later that reads `HabitUser` finds it. Create-on-first-use is
  the safety net, not a replacement.

**Alternative: let the client retry.** The frontend retries a "user not found" for a few seconds
after signup. It's simpler on the backend, but it only covers the milliseconds-to-seconds case:
a retrying queue or a lost event still leaves the user stuck. Prefer the fix above.

### Ordering caveat

prefetch 1 keeps messages in order *until one fails*. A message waiting 10 s in `<queue>.retry`
can be overtaken by a newer event for the same entity; when it comes back it applies older data.
For `search` that re-indexes older text; for `habit`, `Complete` ignores an older completion, so
it's harmless. While a dependency is down every message fails, so this is rare in practice, and
the next event fixes it. [Phase 5](05-ordering.md) fixes it properly: the events carry a change
time, and handlers skip messages older than what's stored.

---

## Verify

1. Start the API. In the UI, **Queues** shows `habit`, `habit-entry`, `habit-user` and `search`,
   each with its `.retry` and `.dlq` (type *quorum*). Each main queue has **1 consumer** and, on
   its page, bindings from `dailu.integration` for the events in phase 2's table.
   **Connections** shows `dailu-api` with four consumer channels, plus the publisher's channel
   after the first publish.
2. Debug the first message: `GetServices<INotificationHandler<…>>()` returns that module's
   handlers (3.3).
3. **Search.** Edit a habit's name. The request returns without waiting for Ollama; within a
   second the row in `search.search_index` updates, and the `search` queue's message rate graph
   shows one delivery and one ack.
4. **Registration.** Register a new user: the `HabitUser` row appears within a second. Simulate a
   redelivery: in the UI, publish the same payload to `dailu.integration` with routing key and
   `type` = `IdentityUserCreatedIntegrationEvent`. Still one row.
   **The race.** Stop the API's consumers from reaching `habit-user` (simplest: set a breakpoint
   in `IdentityUserCreatedIntegrationEventHandler`), register a new user, then connect Strava or
   save an integration config as that user. It succeeds and creates the `HabitUser`. Continue
   past the breakpoint: the handler finds the row, and there's still one row.
5. **Completion.** Complete an entry: the habit's `LastCompletedAtUtc` updates shortly after.
6. **Automation.** Trigger an activity sync (e.g. Strava): entries are created via the
   `habit-entry` queue — its message rate graph shows the delivery, which proves the four `habit`
   handlers now publish through the bus.
7. **Retry.** Stop Ollama, edit a tag. The log shows `attempt 1/5`; `search.retry` holds the
   message for 10 s, then it's back in `search` and fails again. Start Ollama before attempt 5:
   the next delivery succeeds and the tag is indexed. Look at the `x-death` header in the
   debugger on the way.
8. **Dead letter.** Keep Ollama stopped through 5 attempts: the message lands in `search.dlq`.
   **Get messages** on it shows the original payload and an `x-last-error` header. To replay it,
   copy the payload and publish it to `dailu.integration` from the UI with the same `type`
   property and the event name as routing key — or simply edit the tag again.
9. **Crash safety.** Put a breakpoint in a handler, trigger it, and stop the API while it's
   paused. The queue shows the message as *Unacked*, then *Ready* once the connection drops;
   start the API and it's processed.
10. **Broker restart.** `docker compose restart dailo.rabbitmq` while the API runs. The log shows
    recovery; editing a habit afterwards still indexes it, and the queues kept their messages.
11. **Broker not running at startup.** Stop RabbitMQ, start the API: the log shows "Can't
    start consuming <queue>; retrying in 10 s" once per queue, and the API serves requests.
    Start RabbitMQ: consumption starts on its own.
12. `RabbitMq:IsEnabled = false`: no consumers, no queues touched, every handler runs
    synchronously in the request again.

Commit: `Consume integration events from RabbitMQ`.

---

## Where to go next

- **Outbox — next, not later.** With every event on the broker, a publish that fails after
  commit can leave a user without a `HabitUser` row. The [outbox guide](../outbox-inbox/README.md)
  closes that gap; its dispatcher publishes through `IIntegrationEventBus`, so events reach
  RabbitMQ from the outbox table instead of directly from the request. Its inbox phase replaces
  the hand-written existence checks from 3.7 with one generic mechanism.
- **New modules with handlers.** Add `AddIntegrationEventSubscription<TModuleRoot>("queue")` to
  the module's `Setup.cs`, next to `AddHandlerAssembly` (phase 2, 2.7). A good exercise: at
  startup, compare the assemblies of all registered `INotificationHandler<T>` (with
  `T : IIntegrationEvent`) against the subscriptions and fail for any assembly that's missing.
- **Retry settings in config.** [Phase 4](04-policies.md) moves `MaxAttempts` and the retry
  delay into `appsettings`, and the delay into a policy, so changing it doesn't mean deleting
  queues.
- **Stale messages after a retry.** [Phase 5](05-ordering.md) fixes the ordering caveat from
  3.7.
- **Exponential backoff** with several retry queues (3.1).
- **Observability.** Add the message id and event type to the log scope in `OnReceivedAsync`;
  later, propagate the trace context in message headers so a request and the background work it
  triggered show up as one trace in the existing OpenTelemetry setup.
- **Aspire.** When you move to the AppHost, `AddRabbitMQ(...).WithManagementPlugin()` replaces
  the compose service and injects the connection string; `RabbitMqConnection` is the only class
  that has to change.

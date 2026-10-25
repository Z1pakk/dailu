# Phase 3 — Consuming, retries, dead-lettering

**Goal:** a reusable background worker per consuming module — `habit`, `habit-entry`,
`habit-user`, `search` — that consumes its queue, calls only that module's handlers in a fresh
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
├── RabbitMqConsumerWorker.cs         ← BackgroundService per module
└── Setup.cs                          ← AddRabbitMqConsumer registers the worker
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

public static async Task DeclareConsumerAsync(
    IChannel channel,
    RabbitMqSubscription subscription,
    CancellationToken ct
)
{
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
            ["x-dead-letter-routing-key"] = subscription.RetryQueue,
        },
        cancellationToken: ct
    );

    await channel.QueueDeclareAsync(
        subscription.RetryQueue,
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
        subscription.DeadLetterQueue,
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
  3.6 goes through the current handlers.

## 3.4 The worker

`src/Dailu.Infrastructure/Messaging/RabbitMqConsumerWorker.cs`:

```csharp
public sealed class RabbitMqConsumerWorker<TModuleRoot>(
    IEnumerable<RabbitMqSubscription> subscriptions,
    RabbitMqConnection connection,
    IServiceScopeFactory scopeFactory,
    ILogger<RabbitMqConsumerWorker<TModuleRoot>> logger
) : BackgroundService
{
    private const int MaxAttempts = 5;

    private readonly RabbitMqSubscription _subscription =
        subscriptions.Single(s => s.Module == typeof(TModuleRoot).Assembly);

    private IChannel? _channel;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
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
            _subscription.DeadLetterQueue
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
        await channel.BasicPublishAsync("", _subscription.DeadLetterQueue, mandatory: false, properties, delivery.Body);
        await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false);
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_channel is not null)
        {
            // unacked in-flight message goes back to the queue and is redelivered on next start
            await _channel.CloseAsync(cancellationToken);
            await _channel.DisposeAsync();
        }

        await base.StopAsync(cancellationToken);
    }
}
```

Then enable it in `AddRabbitMqConsumer` (phase 2, 2.5):

```csharp
services.AddHostedService<RabbitMqConsumerWorker<TModuleRoot>>();
```

The generic parameter makes each module's worker a distinct type, so `AddHostedService`
registers one per module instead of deduplicating them.

- **No `IsEnabled` check in the worker.** `AddRabbitMqConsumer` returns before registering
  anything when RabbitMQ is off, so the worker only exists when it should run.
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
- **`ExecuteAsync` returns after subscribing.** The consumer keeps running on the client's
  dispatcher; the hosted service doesn't need to loop. Automatic recovery re-registers the
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

## 3.6 Making the other handlers safe to repeat

Same contract, plus at-least-once: any message can arrive twice. Go through each handler and ask
"what happens on the second run?"

| Handler | Second run today | What to do |
|---|---|---|
| `IdentityUserCreatedIntegrationEventHandler` (`habit-user`) | Inserts **another** `HabitUser` row — there's no unique index on `IdentityUserId` | Return early if a `HabitUser` for that `IdentityUserId` exists, **and** add a unique index on it (a migration) so a race between two deliveries fails with a constraint error instead of a duplicate |
| `HabitEntryCreatedIntegrationEventHandler` (`habit`) | Safe: `HabitAggregate.Complete` returns early when `completedAtUtc <= LastCompletedAtUtc` | Nothing. A concurrency conflict on `Version` (the user edited the habit at the same moment) throws and is retried, which is what you want |
| `HabitAutomationEntriesDetectedIntegrationEventHandler` (`habit-entry`) | Safe for its own rows: existing entries are matched by `(HabitId, ExternalId)` and updated or skipped. But it **saves, then publishes** the entries' events: if the publish fails, the retry finds the entries already there and doesn't raise their events again, so e.g. `HabitEntryCompletedIntegrationEvent` is lost | A unique index on `(HabitId, ExternalId)` protects against two deliveries racing. The save-then-publish gap is what the outbox fixes — accept it until then |
| The four `IntegrationActivitiesDetected` handlers (`habit`) | Each filters by `Source`, so only one does work; a rerun publishes the same entries again, which `habit-entry` deduplicates | **Change how they publish** — see below |

### The `habit` activity handlers bypass the bus

`GithubActivitiesDetectedEventHandler`, `GoogleHealthActivitiesDetectedEventHandler`,
`GoogleHealthStepsDetectedEventHandler` and `StravaActivitiesDetectedEventHandler` publish
`HabitAutomationEntriesDetectedIntegrationEvent` with **`IPublisher.Publish`** directly, not
through `IEventDispatcher` / `IIntegrationEventBus`. With RabbitMQ on, that means:

- the event never reaches the broker — `habit-entry`'s handler runs **in-process, inside the
  `habit` consumer's message**;
- if `habit-entry`'s handler throws, the `habit` message is retried and parked in `habit.dlq`,
  even though `habit`'s own work succeeded;
- `habit-entry`'s queue never sees these events, so its retries and dead-letter queue don't apply.

Switch those four handlers to `IEventDispatcher.SendAsync(...)` (as
`HabitAutomationEntriesDetectedIntegrationEventHandler` already does) so the event goes through
the bus. That's a module change, but a one-line one per handler, and it keeps "each module
consumes its own queue" true.

### The registration race

`IdentityUserCreatedIntegrationEvent` now creates the `HabitUser` a moment after
`RegisterUserCommand` returns. Find the requests the frontend makes right after signup that need
a `HabitUser`, and pick one:

- **Create on first use** — the read path creates the `HabitUser` if it's missing (and the event
  handler's existence check from the table above makes the later delivery a no-op);
- **Let the client retry** a not-found response for a short time after signup.

### Ordering caveat

prefetch 1 keeps messages in order *until one fails*. A message waiting 10 s in `<queue>.retry`
can be overtaken by a newer event for the same entity; when it comes back it applies older data.
For `search` that re-indexes older text; for `habit`, `Complete` ignores an older completion, so
it's harmless. While a dependency is down every message fails, so this is rare in practice, and
the next event fixes it. If it ever matters: put a timestamp or version in the events and have
handlers skip messages older than what's stored.

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
11. **Broker not running at startup.** Stop RabbitMQ, start the API: each worker logs "Can't
    start consuming <queue>; retrying in 10 s" and the API serves requests. Start RabbitMQ:
    consumption starts on its own.
12. `RabbitMq:IsEnabled = false`: no consumers, no queues touched, every handler runs
    synchronously in the request again.

Commit: `Consume integration events from RabbitMQ`.

---

## Where to go next

- **Outbox — next, not later.** With every event on the broker, a publish that fails after
  commit can leave a user without a `HabitUser` row. The [outbox guide](../outbox-inbox/README.md)
  closes that gap; its dispatcher publishes through `IIntegrationEventBus`, so events reach
  RabbitMQ from the outbox table instead of directly from the request. Its inbox phase replaces
  the hand-written existence checks from 3.6 with one generic mechanism.
- **New modules with handlers.** Give them a queue in `Program.cs` (phase 2, 2.7) — or build the
  startup check suggested there, so a missing line fails loudly.
- **Exponential backoff** with several retry queues (3.1).
- **Observability.** Add the message id and event type to the log scope in `OnReceivedAsync`;
  later, propagate the trace context in message headers so a request and the background work it
  triggered show up as one trace in the existing OpenTelemetry setup.
- **Aspire.** When you move to the AppHost, `AddRabbitMQ(...).WithManagementPlugin()` replaces
  the compose service and injects the connection string; `RabbitMqConnection` is the only class
  that has to change.

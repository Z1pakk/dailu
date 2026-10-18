# Phase 3 — Consuming, retries, dead-lettering

**Goal:** a reusable background worker per subscribed module that consumes its queue, calls only
that module's handlers in a fresh DI scope, acks on success, retries failures after a delay, and
parks messages that keep failing. `search` indexing runs again — off the request path.

**Builds on:** tutorials [2](https://www.rabbitmq.com/tutorials/tutorial-two-dotnet) (manual
acks, prefetch) and [4](https://www.rabbitmq.com/tutorials/tutorial-four-dotnet) (bindings), and
the [dead letter exchanges](https://www.rabbitmq.com/docs/dlx), [TTL](https://www.rabbitmq.com/docs/ttl)
and [quorum queues](https://www.rabbitmq.com/docs/quorum-queues) docs.

```
src/shared/SharedInfrastructure/Messaging/
├── RabbitMqTopology.cs               ← + DeclareConsumerAsync: main, retry and dead-letter queues
├── DeathHeader.cs                    ← reads the attempt count from x-death
├── ModuleHandlers.cs                 ← invokes INotificationHandler<T> from one assembly only
├── RabbitMqConsumerWorker.cs         ← BackgroundService per module
└── Setup.cs                          ← AddRabbitMqConsumer registers the worker
```

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
- **Removed bindings stay.** Dropping an event from `AddRabbitMqConsumer` doesn't unbind it;
  unbind it in the UI, or call `QueueUnbindAsync` once.
- **Decision:** a fixed 10 s delay. Exponential backoff needs one retry queue per delay (e.g.
  `search.retry.10s`, `.1m`, `.5m`) and picking the queue by attempt — a good exercise once this
  works.

## 3.2 Counting attempts

Each time a message is dead-lettered, the broker adds or updates an entry in its `x-death`
header: which queue it left, why (`rejected`, `expired`, …), and how many times. The number of
times it was rejected from the main queue is the number of failed attempts.

`src/shared/SharedInfrastructure/Messaging/DeathHeader.cs`:

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

`src/shared/SharedInfrastructure/Messaging/ModuleHandlers.cs`:

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
- **Several handlers, one message.** If a module has two handlers for an event and the second
  throws, the retry runs the first one again. Every handler on a brokered event must be safe to
  repeat — that's at-least-once delivery, not a quirk of this code.

## 3.4 The worker

`src/shared/SharedInfrastructure/Messaging/RabbitMqConsumerWorker.cs`:

```csharp
public sealed class RabbitMqConsumerWorker<TModuleRoot>(
    IEnumerable<RabbitMqSubscription> subscriptions,
    RabbitMqConnection connection,
    RabbitMqOptions options,
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
        if (!options.Enabled)
        {
            return;
        }

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

        // one unacked message at a time: in order, and a slow embedding call can't
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

- **Manual acks.** `autoAck: false` means the broker keeps the message until you ack it. If the
  API crashes while the embedding call is running, the message is redelivered on the next start.
- **New scope per message.** Handlers get a fresh `SearchDbContext` and scoped services, like the
  `PeriodicTimer` workers (`StravaActivityWorker`). There's no HTTP request and no current user —
  events carry `UserId` for exactly this reason (see `docs/search/02-indexing.md`).
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
  `HttpClient` timeout stalls the whole queue. Give the embedding client a timeout of a few
  seconds, as `02-indexing.md` already recommends.

### Ordering caveat

prefetch 1 keeps messages in order *until one fails*. A message waiting 10 s in `search.retry`
can be overtaken by a newer edit of the same habit; when it comes back it re-indexes the older
text. While Ollama is down every message fails, so this is rare in practice, and the next edit
fixes it. If it ever matters: put a timestamp or version in the events and have
`SearchIndexService` skip messages older than what's stored.

---

## Verify

1. Start the API. In the UI, **Queues** shows `search`, `search.retry`, `search.dlq` (type
   *quorum*); `search` has **1 consumer** and, on its page, bindings from `dailu.integration` for
   the three event names. **Connections** shows `dailu-api` with two channels (publisher and
   search consumer).
2. Debug the first message: `GetServices<INotificationHandler<…>>()` returns the search handler
   (3.3).
3. Edit a habit's name. The request returns without waiting for Ollama; within a second the row
   in `search.search_index` updates, and the `search` queue's message rate graph shows one
   delivery and one ack.
4. **Retry.** Stop Ollama, edit a tag. The log shows `attempt 1/5`; `search.retry` holds the
   message for 10 s, then it's back in `search` and fails again. Start Ollama before attempt 5:
   the next delivery succeeds and the tag is indexed. Look at the `x-death` header in the
   debugger on the way.
5. **Dead letter.** Keep Ollama stopped through 5 attempts: the message lands in `search.dlq`.
   **Get messages** on it shows the original payload and an `x-last-error` header. To replay it,
   copy the payload and publish it to `dailu.integration` from the UI with the same `type`
   property and the event name as routing key — or simply edit the tag again.
6. **Crash safety.** Put a breakpoint in the search handler, edit a habit, and stop the API while
   it's paused. `search` shows the message as *Unacked*, then *Ready* once the connection drops;
   start the API and it's processed.
7. **Broker restart.** `docker compose restart dailo.rabbitmq` while the API runs. The log shows
   recovery; editing a habit afterwards still indexes it, and the queues kept their messages.
8. **Broker not running at startup.** Stop RabbitMQ, start the API: the worker logs "Can't start
   consuming search; retrying in 10 s" and the API serves requests. Start RabbitMQ: consumption
   starts on its own.
9. `RabbitMq:Enabled = false`: no consumer, no queues touched, indexing synchronous again.

Commit: `Consume search integration events from RabbitMQ`.

---

## Where to go next

- **Outbox.** Close the commit-then-publish gap with the [outbox guide](../outbox-inbox/README.md).
  Its dispatcher publishes through `IIntegrationEventBus`, so subscribed events reach RabbitMQ
  from the outbox table instead of directly from the request — and a broker outage no longer
  loses them.
- **More subscribers.** Move another slow handler by subscribing its module (`ai-coach` cleanup,
  for example). Remember the rule from 2.6: every module handling a brokered event subscribes.
- **Exponential backoff** with several retry queues (3.1).
- **Observability.** Add the message id and event type to the log scope in `OnReceivedAsync`;
  later, propagate the trace context in message headers so a request and the background work it
  triggered show up as one trace in the existing OpenTelemetry setup.
- **Aspire.** When you move to the AppHost, `AddRabbitMQ(...).WithManagementPlugin()` replaces
  the compose service and injects the connection string; `RabbitMqConnection` is the only class
  that has to change.

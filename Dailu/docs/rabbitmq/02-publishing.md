# Phase 2 — Publishing

**Goal:** integration events that some module has subscribed to are serialized to JSON and
published to the `dailu.integration` topic exchange, with publisher confirms. All other events
keep going through `InMemoryIntegrationEventBus` exactly as today.

**Builds on:** tutorials [3](https://www.rabbitmq.com/tutorials/tutorial-three-dotnet) and
[5](https://www.rabbitmq.com/tutorials/tutorial-five-dotnet) (exchanges, topic routing),
[7](https://www.rabbitmq.com/tutorials/tutorial-seven-dotnet) (publisher confirms), and the
[confirms docs](https://www.rabbitmq.com/docs/confirms).

```
src/shared/Dailu.Events/
└── IntegrationEventTypes.cs          ← event name ⇄ CLR type (shared with the outbox guide)

src/shared/SharedInfrastructure/Messaging/
├── IntegrationEventJson.cs           ← one JsonSerializerOptions for both sides
├── RabbitMqTopology.cs               ← exchange name; queue declarations come in phase 3
├── RabbitMqPublisher.cs              ← one confirm-enabled channel, publishes one event
├── RabbitMqSubscription.cs           ← "queue X in module Y wants events A, B, C"
├── RabbitMqRoutes.cs                 ← which event types go to the broker
├── RoutingIntegrationEventBus.cs     ← IIntegrationEventBus: broker or in-memory per event
└── Setup.cs                          ← + AddRabbitMqConsumer<TModuleRoot>(...)
```

```
EventDispatcher ──► IIntegrationEventBus = RoutingIntegrationEventBus
                     ├─ RabbitMqRoutes.IsBrokered(type) == false ──► InMemoryIntegrationEventBus (unchanged)
                     └─ true ──► RabbitMqPublisher
                                   exchange  = "dailu.integration"
                                   routing   = "TagNameChangedIntegrationEvent"
                                   props     = type, message_id, content_type, persistent, timestamp
                                   body      = JSON
                                   await confirm
```

---

## 2.1 Event names

The consumer has to turn a message back into a CLR type, and the routing key has to be stable.
`src/shared/Dailu.Events/IntegrationEventTypes.cs`:

```csharp
public static class IntegrationEventTypes
{
    private static readonly FrozenDictionary<string, Type> ByName = typeof(IntegrationEventTypes)
        .Assembly.GetTypes()
        .Where(t => t is { IsClass: true, IsAbstract: false }
            && typeof(IIntegrationEvent).IsAssignableFrom(t))
        .ToFrozenDictionary(t => t.Name);

    public static string NameOf(Type type) =>
        ByName.TryGetValue(type.Name, out var known) && known == type
            ? type.Name
            : throw new InvalidOperationException($"{type} is not an integration event in Dailu.Events.");

    public static Type Resolve(string name) =>
        ByName.TryGetValue(name, out var type)
            ? type
            : throw new InvalidOperationException($"Unknown integration event '{name}'.");
}
```

If you've done [outbox phase 1](../outbox-inbox/01-outbox.md) this file already exists — reuse
it. `SharedInfrastructure` needs a project reference to `Dailu.Events` for it.

- **The class name is now a wire contract.** Renaming `TagNameChangedIntegrationEvent` changes
  its routing key and its `type` property; messages still sitting in a queue under the old name
  can't be resolved and get parked (phase 3). Rename only with empty queues, or keep the old name
  via an attribute if you ever need to.
- **Decision:** the routing key is the bare type name. A dotted scheme (`habit.updated`,
  `habit.*`) would let you bind by pattern, but nothing here needs wildcards yet.

## 2.2 Don't use `IEvent.EventId` as the message id

`SharedKernel/Event/IEvent.cs` declares:

```csharp
Guid EventId => Guid.CreateVersion7();
DateTime OccurredOn => DateTime.Now;
```

These are default interface members with expression bodies — **they run on every access**. Each
read of `EventId` returns a new Guid, and `OccurredOn` is local time "now", not when the event
happened. Anything that needs a stable id (RabbitMQ's `message_id`, the outbox, an inbox) would
silently get a different one each time.

For this guide, generate the message id once in the publisher (2.4). Fixing `IEvent` itself
(e.g. an abstract `IntegrationEvent` base record with `init` properties set once) is a separate
change that the outbox work will want too.

These members also don't end up in the JSON: `System.Text.Json` serializes the record's own
properties, not default interface members. That's what you want.

## 2.3 Serialization

`src/shared/SharedInfrastructure/Messaging/IntegrationEventJson.cs`:

```csharp
public static class IntegrationEventJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
}
```

- **Web defaults** — camelCase, case-insensitive reads. The payload is readable in the
  management UI.
- **StrictId `Id`** (`TagNameChangedIntegrationEvent.TagId`, `HabitId`, …) — the `StrictId`
  package ships an `IdJsonConverter`, so `Id` should serialize as its string form and come back
  equal. Confirm it in the Verify step before relying on it; if it doesn't round-trip, add the
  converter to `Options.Converters` explicitly.

## 2.4 Publisher

`src/shared/SharedInfrastructure/Messaging/RabbitMqTopology.cs`:

```csharp
public static class RabbitMqTopology
{
    public const string Exchange = "dailu.integration";
}
```

`src/shared/SharedInfrastructure/Messaging/RabbitMqPublisher.cs`:

```csharp
public sealed class RabbitMqPublisher(RabbitMqConnection connection) : IAsyncDisposable
{
    private readonly SemaphoreSlim _lock = new(1, 1);
    private IChannel? _channel;

    public async Task PublishAsync(IIntegrationEvent integrationEvent, CancellationToken ct)
    {
        var type = integrationEvent.GetType();
        var name = IntegrationEventTypes.NameOf(type);

        var properties = new BasicProperties
        {
            MessageId = Guid.CreateVersion7().ToString(),     // once per publish, see 2.2
            Type = name,
            ContentType = "application/json",
            DeliveryMode = DeliveryModes.Persistent,          // survive a broker restart
            Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds()),
        };
        var body = JsonSerializer.SerializeToUtf8Bytes(integrationEvent, type, IntegrationEventJson.Options);

        await _lock.WaitAsync(ct);
        try
        {
            var channel = await GetChannelAsync(ct);

            // with confirmation tracking on, this completes only after the broker acked the
            // message, and throws if it was nacked or (mandatory) couldn't be routed
            await channel.BasicPublishAsync(
                RabbitMqTopology.Exchange,
                routingKey: name,
                mandatory: true,
                basicProperties: properties,
                body: body,
                cancellationToken: ct
            );
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<IChannel> GetChannelAsync(CancellationToken ct)
    {
        if (_channel is { IsOpen: true })
        {
            return _channel;
        }

        if (_channel is not null)
        {
            // closed by a channel-level error (e.g. a failed declare); those don't auto-recover
            await _channel.DisposeAsync();
        }

        var amqpConnection = await connection.GetAsync(ct);
        _channel = await amqpConnection.CreateChannelAsync(
            new CreateChannelOptions(
                publisherConfirmationsEnabled: true,
                publisherConfirmationTrackingEnabled: true
            ),
            ct
        );

        await _channel.ExchangeDeclareAsync(
            RabbitMqTopology.Exchange,
            ExchangeType.Topic,
            durable: true,
            autoDelete: false,
            cancellationToken: ct
        );

        return _channel;
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel is not null)
        {
            await _channel.CloseAsync();
            await _channel.DisposeAsync();
        }

        _lock.Dispose();
    }
}
```

- **Durable exchange + persistent messages + durable (quorum) queues** — all three are needed
  for a message to survive a broker restart. Phase 3 declares the queues.
- **Publisher confirms.** Without them, `BasicPublishAsync` returns as soon as the bytes are on
  the socket; a broker that's out of disk or restarting can still lose the message. With
  `publisherConfirmationTrackingEnabled`, the 7.x client awaits the broker's ack for you and
  throws a `PublishException` on a nack. That's the 7.x replacement for tutorial 7's manual
  `WaitForConfirmsOrDie` / outstanding-confirms bookkeeping.
- **`mandatory: true`.** If no queue is bound for the routing key — the consumer module was never
  started, or you made a typo in a binding — the broker returns the message instead of silently
  dropping it, and the publish throws. Check which exception type your client version uses for a
  return (`PublishReturnException` in recent 7.x) when you test it in the Verify step.
- **One channel behind a lock.** A channel must not be used for concurrent publishes from several
  threads. Requests publish concurrently, so access is serialized; at ~1–2 ms per confirmed
  publish that's fine for this app. A channel pool is the next step if it ever isn't.
- **Exchange declared by the publisher.** `ExchangeDeclareAsync` is idempotent — re-declaring
  with the same arguments is a no-op — so it's safe on every new channel.

## 2.5 Subscriptions and routes

The publisher must know *which* events go to the broker. The answer comes from the consumers:
an event is brokered as soon as some module subscribes a queue to it.

`src/shared/SharedInfrastructure/Messaging/RabbitMqSubscription.cs`:

```csharp
/// <summary>A module's queue and the integration events bound to it.</summary>
public sealed record RabbitMqSubscription(
    string Queue,
    Assembly Module,                    // handlers are only invoked from this assembly
    FrozenSet<Type> EventTypes
)
{
    public string RetryQueue => $"{Queue}.retry";
    public string DeadLetterQueue => $"{Queue}.dlq";
}
```

`src/shared/SharedInfrastructure/Messaging/RabbitMqRoutes.cs`:

```csharp
public sealed class RabbitMqRoutes(IEnumerable<RabbitMqSubscription> subscriptions, RabbitMqOptions options)
{
    private readonly FrozenSet<Type> _brokered = options.Enabled
        ? subscriptions.SelectMany(s => s.EventTypes).ToFrozenSet()
        : FrozenSet<Type>.Empty;

    public bool IsBrokered(Type eventType) => _brokered.Contains(eventType);
}
```

Add the registration helper to `Messaging/Setup.cs`:

```csharp
public static IServiceCollection AddRabbitMqConsumer<TModuleRoot>(
    this IServiceCollection services,
    string queue,
    params Type[] eventTypes
)
{
    foreach (var eventType in eventTypes)
    {
        IntegrationEventTypes.NameOf(eventType);        // fail at startup, not on first message
    }

    services.AddSingleton(
        new RabbitMqSubscription(queue, typeof(TModuleRoot).Assembly, eventTypes.ToFrozenSet())
    );

    // phase 3: services.AddHostedService<RabbitMqConsumerWorker<TModuleRoot>>();

    return services;
}
```

and to `AddRabbitMq()`:

```csharp
services.AddSingleton<RabbitMqPublisher>();
services.AddSingleton<RabbitMqRoutes>();
```

`TModuleRoot` is the module's application-root marker (`ISearchApplicationRoot`), the same type
already passed to `AddHandlerAssembly<ISearchApplicationRoot>()` — handlers live in that
assembly.

## 2.6 The routing bus

`src/shared/SharedInfrastructure/Messaging/RoutingIntegrationEventBus.cs`:

```csharp
public sealed class RoutingIntegrationEventBus(
    InMemoryIntegrationEventBus inMemory,
    RabbitMqPublisher rabbitMq,
    RabbitMqRoutes routes,
    ILogger<RoutingIntegrationEventBus> logger
) : IIntegrationEventBus
{
    public async ValueTask PublishAsync(
        IIntegrationEvent integrationEvent,
        CancellationToken cancellationToken = default
    )
    {
        if (!routes.IsBrokered(integrationEvent.GetType()))
        {
            await inMemory.PublishAsync(integrationEvent, cancellationToken);
            return;
        }

        try
        {
            await rabbitMq.PublishAsync(integrationEvent, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // the command has already committed; failing the request now wouldn't undo it
            logger.LogError(
                ex,
                "Failed to publish {EventType} to RabbitMQ; the event is lost",
                integrationEvent.GetType().Name
            );
        }
    }
}
```

In `src/Dailu.Infrastructure/CQRS/Setup.cs` replace

```csharp
services.AddScoped<IIntegrationEventBus, InMemoryIntegrationEventBus>();
```

with

```csharp
services.AddRabbitMq();
services.AddScoped<InMemoryIntegrationEventBus>();
services.AddScoped<IIntegrationEventBus, RoutingIntegrationEventBus>();
```

- **Brokered means *only* brokered.** A brokered event is no longer published in-process, so a
  handler for it in a module *without* a queue subscription would stop running. Rule: once an
  event is subscribed by one module, every module that handles it subscribes too. Today only
  `search` handles the three search events, so nothing changes elsewhere.
- **Swallowing the publish failure** is the "durability gap" from the README, made explicit: the
  log line says the event is lost, and the outbox is the fix. The alternative — throwing — would
  turn a committed save into a 500 for the user and still not bring the event back.

## 2.7 Subscribe search

`src/modules/search/Search.Infrastructure/Setup.cs` → `AddSearchModule`:

```csharp
services.AddRabbitMqConsumer<ISearchApplicationRoot>(
    "search",
    typeof(HabitNameDescriptionChangedIntegrationEvent),
    typeof(HabitEntryNoteChangedIntegrationEvent),
    typeof(TagNameChangedIntegrationEvent)
);
```

From now on these three events go to RabbitMQ. There's no consumer until phase 3, so **search
indexing pauses** — messages pile up in the queue you create by hand below, and phase 3 drains
them.

---

## Verify

1. **Round-trip test.** In a unit test, serialize a `TagNameChangedIntegrationEvent` with
   `IntegrationEventJson.Options`, deserialize it with
   `IntegrationEventTypes.Resolve("TagNameChangedIntegrationEvent")`, and assert the records are
   equal — this is the StrictId check from 2.3.
2. **Unroutable.** Start the API, rename a tag. The request succeeds and the log shows "Failed to
   publish TagNameChangedIntegrationEvent" with a return/unroutable error: the exchange exists
   (**Exchanges** tab → `dailu.integration`) but no queue is bound yet. This is `mandatory` at
   work.
3. **A temporary queue.** In the UI: **Queues → Add a new queue**, name `search-temp`, type
   *Classic*. Open `dailu.integration` → **Bindings** → bind `search-temp` with routing key `#`
   (matches everything).
4. Rename a tag, edit a habit's description, edit an entry note. `search-temp` shows 3 messages.
   **Get messages** on it: `type`, `message_id`, `content_type`, `delivery_mode: 2` are set, and
   the payload is camelCase JSON with the ids as strings.
5. The edit requests are noticeably faster than before (no embedding call), and
   `search.search_index` did **not** change — expected until phase 3.
6. Complete a habit entry: `HabitEntryCompletedIntegrationEvent` isn't subscribed by any queue,
   so the habit module's handler still runs in-process and the habit updates immediately.
7. `docker compose stop dailo.rabbitmq`, rename a tag: the request still succeeds, the error is
   logged. Start the broker again; the next publish works without restarting the API
   (automatic recovery on the existing connection, new channel in `GetChannelAsync`).
8. Set `RabbitMq:Enabled` to `false`, restart: renaming a tag indexes it synchronously again.
   Set it back.
9. **Delete `search-temp`** (and its binding) before phase 3. Phase 3 declares its own queues
   with specific arguments; a leftover queue with the same name but different arguments makes
   the declare fail with `PRECONDITION_FAILED`.

Commit: `Publish subscribed integration events to RabbitMQ`.

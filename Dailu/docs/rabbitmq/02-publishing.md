# Phase 2 — Publishing

**Goal:** every integration event is serialized to JSON and published to the `dailu.integration`
topic exchange, with publisher confirms. Each consuming module's subscription is discovered from
its handlers. With `RabbitMq:IsEnabled = false` the API keeps using `InMemoryIntegrationEventBus`
exactly as today. Tests get a `FakeIntegrationEventBus`.

**Builds on:** tutorials [3](https://www.rabbitmq.com/tutorials/tutorial-three-dotnet) and
[5](https://www.rabbitmq.com/tutorials/tutorial-five-dotnet) (exchanges, topic routing),
[7](https://www.rabbitmq.com/tutorials/tutorial-seven-dotnet) (publisher confirms), and the
[confirms docs](https://www.rabbitmq.com/docs/confirms).

```
src/shared/Dailu.Events/
└── IntegrationEventTypes.cs          ← event name ⇄ CLR type (shared with the outbox guide)

src/shared/SharedKernel/Event/
└── IntegrationEventPublishException.cs   ← thrown by the bus when a publish fails

src/shared/SharedInfrastructure/Pipeline/
└── EventDispatchingBehavior.cs       ← catches publish failures on the request path

src/Dailu.Infrastructure/Messaging/
├── IntegrationEventJson.cs           ← one JsonSerializerOptions for both sides
├── RabbitMqTopology.cs               ← exchange name; queue declarations come in phase 3
├── RabbitMqPublisher.cs              ← one confirm-enabled channel, publishes one event
├── RabbitMqSubscription.cs           ← "queue X in module Y handles events A, B, C"
├── RabbitMqIntegrationEventBus.cs    ← IIntegrationEventBus → RabbitMqPublisher
└── Setup.cs                          ← + AddRabbitMqConsumer<TModuleRoot>(queue)

src/Dailu.Infrastructure/Event/Setup.cs   ← IsEnabled ? RabbitMqIntegrationEventBus : InMemoryIntegrationEventBus
src/api/Dailu.Api/Program.cs              ← one AddRabbitMqConsumer per consuming module

src/tests/Test.SharedKernel/Event/
└── FakeIntegrationEventBus.cs        ← records published events for assertions
```

```
EventDispatcher ──► IIntegrationEventBus
                     ├─ IsEnabled == false ──► InMemoryIntegrationEventBus (unchanged)
                     └─ IsEnabled == true  ──► RabbitMqIntegrationEventBus
                                                ├─ no module handles this event ──► skipped (debug log)
                                                └─ RabbitMqPublisher
                                                     exchange  = "dailu.integration"
                                                     routing   = "TagNameChangedIntegrationEvent"
                                                     props     = type, message_id, app_id, content_type, persistent, timestamp
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
it. `Dailu.Infrastructure` needs a project reference to `Dailu.Events` for it.

- **The class name is now a wire contract.** Renaming `TagNameChangedIntegrationEvent` changes
  its routing key and its `type` property; messages still sitting in a queue under the old name
  can't be resolved and get parked (phase 3). Rename only with empty queues, or keep the old name
  via an attribute if you ever need to.
- **Decision:** the routing key is the bare type name. A dotted scheme (`habit.updated`,
  `habit.*`) would let you bind by pattern, but nothing here needs wildcards yet.

## 2.2 Events carry data; the envelope carries metadata

`SharedKernel/Event/IEvent.cs` used to declare:

```csharp
Guid EventId => Guid.CreateVersion7();
DateTime OccurredOn => DateTime.Now;
string? EventType => GetType().AssemblyQualifiedName;
```

These are default interface members with expression bodies — **they run on every access**. Each
read of `EventId` returns a new Guid, `OccurredOn` is local time "now" rather than when anything
happened, and none of them are serialized, so a consumer never sees the original values. Nothing
in the codebase reads them.

**Remove them.** `IEvent` becomes a plain marker:

```csharp
public interface IEvent : INotification;
```

and metadata moves to the **envelope** — the AMQP message properties now, the outbox row later:

| Metadata | Where it lives | Who sets it |
|---|---|---|
| Message id | AMQP `MessageId`; later the outbox row's id | `RabbitMqPublisher` (2.4), once per publish; later the outbox, once per event |
| Event type | AMQP `Type` | `IntegrationEventTypes.NameOf` (2.1) |
| Source | AMQP `AppId` = `"dailu-api"` | `RabbitMqPublisher` |
| When it was sent | AMQP `Timestamp` | `RabbitMqPublisher`, from `DateTimeOffset.UtcNow` |
| When it happened, in business terms | **An explicit property on the event**, only where a handler needs it — like `HabitEntryCompletedIntegrationEvent.CompletedAtUtc` | The code that raises the event |

Handlers that need the message id (the inbox, in outbox phase 2) get it from a scoped
`IIntegrationMessageContext` that the consumer worker fills from
`delivery.BasicProperties.MessageId` before calling them — the same design the
[outbox guide](../outbox-inbox/README.md#decisions-already-made) already uses. Nothing needs it
yet, so add it when the inbox does.

- **Why not a base record with `init` properties** (`IntegrationEvent { EventId, OccurredOnUtc }`,
  as Microsoft's eShop sample does)? It works, but it puts delivery metadata into every business
  contract, changes the base type of every event record, and makes record equality include the
  id. CloudEvents, AWS EventBridge, Stripe and GitHub webhooks, and the .NET messaging
  frameworks (MassTransit's `ConsumeContext`, NServiceBus's `IMessageHandlerContext`, Wolverine's
  `Envelope`) all keep metadata next to the payload instead.
- **The names follow [CloudEvents](https://cloudevents.io/)**: `id`, `type`, `source`, `time` map
  to `MessageId`, `Type`, `AppId`, `Timestamp`. If you ever need a different transport, the
  CloudEvents bindings for Kafka and HTTP use the same four attributes.
- **Message id vs. event identity.** CloudEvents defines `id` as the identity of the event, kept
  across resends. Direct publishing creates the id at publish time, so if a consumer retries a
  handler that publishes (e.g. the `habit` activity handlers), the re-derived event gets a new
  id. That's acceptable here — `habit-entry` deduplicates by `(HabitId, ExternalId)` — and the
  outbox fixes it in general: the row id is created at commit and reused on every retry.
- **Times are UTC.** Anywhere you do need a time, use `DateTime.UtcNow` or `TimeProvider`, never
  `DateTime.Now`.

### Checklist

Nothing in the codebase reads `EventId`, `OccurredOn` or `EventType`, and nothing else uses
`DateTime.Now`, so these steps can't break anything.

**Now, before the rest of this phase**

1. **Strip `IEvent` to a marker.** In `src/shared/SharedKernel/Event/IEvent.cs`, delete the three
   members and build the solution.
2. **Check which events need a business time.** For each event in `Dailu.Events`, ask whether a
   handler needs to know *when* it happened. Today:
   - `HabitEntryCompletedIntegrationEvent` (`CompletedAtUtc`) and
     `IntegrationActivitiesDetectedIntegrationEvent` (`OccurredAtUtc` per item) already carry
     theirs.
   - The three search events don't need one yet. They will if you fix the ordering caveat in
     phase 3: add an `UpdatedAtUtc` or the entity's `Version` and have the handler skip older
     messages.

   Add a time when a handler uses it, not "just in case".

**In this phase**

3. **Set the envelope once per publish** in `RabbitMqPublisher` (2.4): `MessageId`, `Type`,
   `AppId`, `Timestamp` in UTC.

**Later, in outbox phase 2 (the inbox)**

4. **Add `IIntegrationMessageContext`.**
   - The interface (`Guid MessageId { get; }`) goes in `SharedKernel/Event`, so `*.Application`
     handlers can use it.
   - A scoped implementation with a setter goes in `SharedInfrastructure`, registered once.
   - The consumer worker sets it from `delivery.BasicProperties.MessageId` in the new scope,
     before `ModuleHandlers.InvokeAsync`. The outbox dispatcher sets it from the outbox row id.
   - Only handlers that deduplicate (the inbox base class) read it.
5. **Use the outbox row id as the message id.** Give `RabbitMqPublisher.PublishAsync` an optional
   `messageId` parameter that the outbox dispatcher passes. A retried publish then keeps the same
   id, which is what makes inbox deduplication reliable.

**Result**

| Concern | Before | After |
|---|---|---|
| Event contract | Data plus three computed members that look like metadata | Data only, business times explicit where needed |
| Message id | New on every read, never transmitted | Created once by the publisher (later the outbox), sent as AMQP `message_id` |
| Type name | `AssemblyQualifiedName`, unused | `IntegrationEventTypes`, stable class name |
| Time | Local "now" on every read | UTC `Timestamp` at send time; business time in the payload |
| Handler access to metadata | None | `IIntegrationMessageContext`, only for handlers that need it |

## 2.3 Serialization

`src/Dailu.Infrastructure/Messaging/IntegrationEventJson.cs`:

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
- **Every event is serialized now**, not just the search ones. The round-trip test in Verify
  should cover all of `Dailu.Events`, including `IntegrationActivitiesDetectedIntegrationEvent`
  and `HabitAutomationEntriesDetectedIntegrationEvent`, which carry collections.

## 2.4 Publisher

`src/Dailu.Infrastructure/Messaging/RabbitMqTopology.cs`:

```csharp
public static class RabbitMqTopology
{
    public const string Exchange = "dailu.integration";
}
```

`src/Dailu.Infrastructure/Messaging/RabbitMqPublisher.cs`:

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
            AppId = "dailu-api",                              // CloudEvents "source", see 2.2
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
- **`mandatory: true`.** If no queue is bound for the routing key — the consumer's worker hasn't
  declared its queue yet, or a binding is missing — the broker returns the message instead of
  silently dropping it, and the publish throws. Check which exception type your client version
  uses for a return (`PublishReturnException` in recent 7.x) when you test it in the Verify step.
  Events that *no* module handles never get this far — the bus skips them (2.6).
- **One channel behind a lock.** A channel must not be used for concurrent publishes from several
  threads. Requests publish concurrently, so access is serialized; at ~1–2 ms per confirmed
  publish that's fine for this app. A channel pool is the next step if it ever isn't.
- **Exchange declared by the publisher.** `ExchangeDeclareAsync` is idempotent — re-declaring
  with the same arguments is a no-op — so it's safe on every new channel.

## 2.5 Subscriptions, discovered from handlers

Each consuming module gets one queue, bound to every integration event the module has a handler
for. Instead of listing the events by hand, read them from the handler types, so a new handler
can't be forgotten in the binding list.

`src/Dailu.Infrastructure/Messaging/RabbitMqSubscription.cs`:

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

Add the registration helper to `Messaging/Setup.cs`:

```csharp
public static IServiceCollection AddRabbitMqConsumer<TModuleRoot>(
    this IServiceCollection services,
    string queue
)
{
    if (!services.GetOptions<RabbitMqOptions>().IsEnabled)
    {
        return services;                // in-memory bus runs every handler already
    }

    var module = typeof(TModuleRoot).Assembly;

    var eventTypes = module
        .GetTypes()
        .Where(t => t is { IsClass: true, IsAbstract: false })
        .SelectMany(t => t.GetInterfaces())
        .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEventHandler<>))
        .Select(i => i.GetGenericArguments()[0])
        .Where(e => typeof(IIntegrationEvent).IsAssignableFrom(e))
        .ToFrozenSet();

    if (eventTypes.Count == 0)
    {
        throw new InvalidOperationException(
            $"{module.GetName().Name} has no integration event handlers; don't give it a queue."
        );
    }

    foreach (var eventType in eventTypes)
    {
        IntegrationEventTypes.NameOf(eventType);        // fail at startup, not on first message
    }

    services.AddSingleton(new RabbitMqSubscription(queue, module, eventTypes));

    // phase 3: services.AddHostedService<RabbitMqConsumerWorker<TModuleRoot>>();

    return services;
}
```

and to `AddRabbitMq()`:

```csharp
services.AddSingleton<RabbitMqPublisher>();
```

- `TModuleRoot` is the module's application-root marker (`ISearchApplicationRoot`), the same
  type already passed to `AddHandlerAssembly<ISearchApplicationRoot>()` — handlers live in that
  assembly.
- **`IEventHandler<T>`** is what Dailu's handlers implement, so that's what the scan looks for.
  Phase 3 *invokes* them through `INotificationHandler<T>`, the interface Mediator registers.
- **Disabled means no subscriptions.** `GetOptions` binds the section without validating it, the
  same check `AddEvents` makes. When RabbitMQ is off, nothing is registered and the in-memory bus
  runs every handler as before.

## 2.6 The bus

**The bus always throws on a failed publish; each caller decides what that means.** The bus
can't know whether it was called from an HTTP request (the command already committed — failing
the request undoes nothing) or from a consumer (failing makes the incoming message retry, which
can fix it). So the policy lives at the call site:

| Caller | On a publish failure |
|---|---|
| `EventDispatchingBehavior` — the request path, after the command committed | Catches it, logs "the event is lost", returns the response. The user's save succeeded |
| A handler running in a consumer (phase 3) | Lets it propagate → the worker nacks → the incoming message is retried in 10 s |
| A background job, e.g. `StravaActivityService` | Lets it propagate → that job's own error handling (the next poll) applies |

### A dedicated exception

The request path must catch *publish* failures only — not a failing domain event handler, which
also runs inside `IEventDispatcher.SendAsync` and should keep surfacing as a 500 like today. Give
publish failures their own type.

`src/shared/SharedKernel/Event/IntegrationEventPublishException.cs`:

```csharp
/// <summary>The integration event couldn't be handed to the transport.</summary>
public sealed class IntegrationEventPublishException(string eventType, Exception innerException)
    : Exception($"Failed to publish {eventType}.", innerException)
{
    public string EventType { get; } = eventType;
}
```

It lives in `SharedKernel` because both sides need it: the bus in `Dailu.Infrastructure` throws
it, and `EventDispatchingBehavior` in `SharedInfrastructure` catches it.

### The bus

`src/Dailu.Infrastructure/Messaging/RabbitMqIntegrationEventBus.cs`:

```csharp
public sealed class RabbitMqIntegrationEventBus(
    RabbitMqPublisher publisher,
    IEnumerable<RabbitMqSubscription> subscriptions,
    ILogger<RabbitMqIntegrationEventBus> logger
) : IIntegrationEventBus
{
    public async ValueTask PublishAsync(
        IIntegrationEvent integrationEvent,
        CancellationToken cancellationToken = default
    )
    {
        var eventType = integrationEvent.GetType();

        if (!subscriptions.Any(s => s.EventTypes.Contains(eventType)))
        {
            // nobody handles it (e.g. IdentityUserProfileUpdatedIntegrationEvent today);
            // publishing would only trip mandatory and log a false "event lost"
            logger.LogDebug("No module handles {EventType}; not published", eventType.Name);
            return;
        }

        try
        {
            await publisher.PublishAsync(integrationEvent, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // broker unreachable, nacked, or returned as unroutable — the caller decides
            throw new IntegrationEventPublishException(eventType.Name, ex);
        }
    }
}
```

### Catching it on the request path

`src/shared/SharedInfrastructure/Pipeline/EventDispatchingBehavior.cs` dispatches the events a
command collected, after the command has committed. Catch the publish exception there:

```csharp
public abstract class EventDispatchingBehavior<TMessage, TResponse, TDbContext>(
    IEventDispatcher eventDispatcher,
    TDbContext dbContext,
    ILogger logger
) : IPipelineBehavior<TMessage, TResponse>
    where TMessage : notnull, IMessage
    where TDbContext : IAppDbContextBase
{
    public async ValueTask<TResponse> Handle(
        TMessage message,
        MessageHandlerDelegate<TMessage, TResponse> next,
        CancellationToken cancellationToken
    )
    {
        var response = await next(message, cancellationToken);

        var events = dbContext.ConsumeEvents();
        if (events.Count == 0)
        {
            return response;
        }

        try
        {
            await eventDispatcher.SendAsync(events, cancellationToken);
        }
        catch (IntegrationEventPublishException ex)
        {
            // the command has already committed; failing the request now wouldn't undo it
            logger.LogError(ex, "Failed to publish {EventType}; the event is lost", ex.EventType);
        }

        return response;
    }
}
```

Each module's derived behavior (`HabitEventDispatchingBehavior`, `TagEventDispatchingBehavior`,
… — six of them) takes an `ILogger<ItsOwnType<TMessage, TResponse>>` and passes it to the base
constructor. `SharedInfrastructure` gets `Microsoft.Extensions.Logging.Abstractions`
transitively through EF Core.

- **One failed event stops the rest.** `SendAsync` publishes the events in order; if the second
  of three fails, the third isn't published either. The log line names the one that failed. The
  outbox fixes this properly — every event becomes its own row with its own retries.
- **Only `IntegrationEventPublishException` is caught.** A domain event handler that throws, or a
  bug in `EventDispatcher`, still fails the request as before.

In `src/Dailu.Infrastructure/Event/Setup.cs` pick the bus with the switch:

```csharp
public static IServiceCollection AddEvents(this IServiceCollection services)
{
    services.AddScoped<IEventDispatcher, EventDispatcher>();

    if (services.GetOptions<RabbitMqOptions>().IsEnabled)
    {
        services.AddRabbitMq();
        services.AddScoped<IIntegrationEventBus, RabbitMqIntegrationEventBus>();
    }
    else
    {
        services.AddScoped<IIntegrationEventBus, InMemoryIntegrationEventBus>();
    }

    return services;
}
```

- **No in-memory fallback per event.** With RabbitMQ on, *every* handled integration event goes
  to the broker, and handlers run only from a consumer. That's why every module with handlers
  needs a queue (2.7) — a handler in a module without one never runs.
- **The request path's log line is the "durability gap"** from the README, made explicit: the
  event is lost, and the outbox is the fix. Throwing there instead would turn a committed save
  into a 500 for the user and still not bring the event back.
- **In a consumer, throwing is what saves the event.** A handler like
  `StravaActivitiesDetectedEventHandler` only reads and publishes. If the publish fails, the
  exception makes the worker retry the incoming message, and the retry publishes again. If the
  bus swallowed the error instead, the handler would return normally, the message would be
  acked, and the automation entries would be gone.
- **`InMemoryIntegrationEventBus` doesn't throw `IntegrationEventPublishException`.** It runs the
  handlers directly, so a failing handler fails the request exactly as today — the switch keeps
  the old behaviour when RabbitMQ is off.
- **`InMemoryIntegrationEventBus` stays.** It's the bus when RabbitMQ is off and the one
  cross-module tests use.

## 2.7 Subscribe the modules

`src/api/Dailu.Api/Program.cs`, after the `Add*Module(...)` calls:

```csharp
builder
    .Services.AddRabbitMqConsumer<IHabitApplicationRoot>("habit")
    .AddRabbitMqConsumer<IHabitEntryApplicationRoot>("habit-entry")
    .AddRabbitMqConsumer<IHabitUserApplicationRoot>("habit-user")
    .AddRabbitMqConsumer<ISearchApplicationRoot>("search");
```

The handlers these pick up today:

| Queue | Events |
|---|---|
| `habit` | `HabitEntryCompletedIntegrationEvent`, `IntegrationActivitiesDetectedIntegrationEvent` (4 handlers: GitHub, Google Health activities, Google Health steps, Strava) |
| `habit-entry` | `HabitAutomationEntriesDetectedIntegrationEvent` |
| `habit-user` | `IdentityUserCreatedIntegrationEvent` |
| `search` | `HabitNameDescriptionChangedIntegrationEvent`, `HabitEntryNoteChangedIntegrationEvent`, `TagNameChangedIntegrationEvent` |

- **Why `Program.cs` and not `Event/Setup.cs`.** The marker types live in each module's
  `*.Application` project. `Dailu.Api` already sees them through the module `*.Infrastructure`
  references; `Dailu.Infrastructure` doesn't, and shouldn't.
- **`identity` and `tag` have no integration event handlers**, so they get no queue —
  `AddRabbitMqConsumer` would throw for them.
- **When a module gets its first integration event handler**, add its line here. Until you do,
  its handler never runs. A good exercise: at startup, compare the assemblies of all registered
  `INotificationHandler<T>` (with `T : IIntegrationEvent`) against the subscriptions and log an
  error for any module that's missing.

From now on every handled integration event goes to RabbitMQ, and there's no consumer until
phase 3. **All cross-module reactions pause** — registration doesn't create a `HabitUser`,
completions don't update habits, search doesn't index. Run the Verify steps, then set
`IsEnabled` back to `false` in Development until phase 3 is done.

## 2.8 A fake bus for tests

Tests shouldn't need a broker. Two kinds of tests, two buses:

| Test | Bus |
|---|---|
| "Did command X publish event Y?" | `FakeIntegrationEventBus` — records, runs nothing |
| A cross-module flow ("register → `HabitUser` exists") | `InMemoryIntegrationEventBus` — runs handlers in-process |

`src/tests/Test.SharedKernel/Event/FakeIntegrationEventBus.cs`:

```csharp
public sealed class FakeIntegrationEventBus : IIntegrationEventBus
{
    private readonly ConcurrentQueue<IIntegrationEvent> _published = new();

    public IReadOnlyCollection<IIntegrationEvent> Published => _published;

    public IEnumerable<TEvent> PublishedOf<TEvent>()
        where TEvent : IIntegrationEvent => _published.OfType<TEvent>();

    public ValueTask PublishAsync(
        IIntegrationEvent integrationEvent,
        CancellationToken cancellationToken = default
    )
    {
        _published.Enqueue(integrationEvent);
        return ValueTask.CompletedTask;
    }

    public void Clear() => _published.Clear();
}
```

`Test.SharedKernel.csproj` needs a project reference to `SharedKernel`.

When integration tests boot the API with a `WebApplicationFactory`, set `RabbitMq__IsEnabled` to
`false` — nothing RabbitMQ-related gets registered — and, where a test wants the fake, swap it in:

```csharp
builder.ConfigureTestServices(services =>
{
    services.RemoveAll<IIntegrationEventBus>();
    services.AddSingleton<FakeIntegrationEventBus>();
    services.AddSingleton<IIntegrationEventBus>(sp => sp.GetRequiredService<FakeIntegrationEventBus>());
});
```

- **Singleton, not scoped**, so the test resolves the same instance afterwards and asserts on
  `Published`. A scoped registration would give a new, empty instance per request.
- **Use the switch, don't strip RabbitMQ registrations by hand.** Removing the connection, the
  publisher and every consumer `BackgroundService` in `ConfigureTestServices` breaks each time a
  new one is added.

---

## Verify

1. **Round-trip test.** In a unit test, for every type in `Dailu.Events`: serialize a sample
   instance with `IntegrationEventJson.Options`, deserialize it with
   `IntegrationEventTypes.Resolve(name)`, and assert the records are equal — this is the StrictId
   check from 2.3. Records with collections compare by reference, so compare those properties
   with `SequenceEqual`.
2. **Subscriptions.** With `IsEnabled: true`, start the API with a breakpoint after `Build()` and
   resolve `IEnumerable<RabbitMqSubscription>`: four entries, with exactly the events from the
   table in 2.7.
3. **Unroutable.** Rename a tag. The request succeeds and the log shows "Failed to publish
   TagNameChangedIntegrationEvent" with a return/unroutable error: the exchange exists
   (**Exchanges** tab → `dailu.integration`) but no queue is bound yet. This is `mandatory` at
   work.
4. **A temporary queue.** In the UI: **Queues → Add a new queue**, name `all-temp`, type
   *Classic*. Open `dailu.integration` → **Bindings** → bind `all-temp` with routing key `#`
   (matches everything).
5. Rename a tag, edit a habit's description, edit an entry note, complete an entry, register a
   new user. `all-temp` gets at least one message per action. **Get messages** on it: `type`, `message_id`, `app_id`, `timestamp`,
   `content_type`, `delivery_mode: 2` are set, and the payload is camelCase JSON with the ids as
   strings.
6. **Nothing reacted.** The habit's `LastCompletedAtUtc` didn't change, the new user has no
   `HabitUser` row, and `search.search_index` didn't change — expected until phase 3. The edit
   requests are noticeably faster than before (no embedding call).
7. **Unhandled event.** If you can trigger `IdentityUserProfileUpdatedIntegrationEvent`, it
   doesn't appear in `all-temp` and the debug log says "No module handles".
8. `docker compose stop dailo.rabbitmq`, rename a tag: the request still succeeds, the error is
   logged. Start the broker again; the next publish works without restarting the API
   (automatic recovery on the existing connection, new channel in `GetChannelAsync`).
9. Set `RabbitMq:IsEnabled` to `false`, restart: renaming a tag indexes it synchronously again,
   and registering creates the `HabitUser` row immediately. **Leave it `false`** until phase 3.
10. **Delete `all-temp`** (and its binding) before phase 3. Phase 3 declares its own queues with
    specific arguments; leftover queues are confusing in the UI and a queue with the same name
    but different arguments makes the declare fail with `PRECONDITION_FAILED`.

Commit: `Publish integration events to RabbitMQ`.

# Phase 2 — Publishing

**Goal:** every integration event is serialized to JSON and published to the `dailu.integration`
topic exchange, with publisher confirms. Each consuming module's subscription is discovered from
its handlers. With `RabbitMq:IsEnabled = false` the API keeps using `InMemoryIntegrationEventBus`
exactly as today. Tests get a `FakeIntegrationEventBus`.

**Builds on:** tutorials [3](https://www.rabbitmq.com/tutorials/tutorial-three-dotnet) and
[5](https://www.rabbitmq.com/tutorials/tutorial-five-dotnet) (exchanges, topic routing),
[7](https://www.rabbitmq.com/tutorials/tutorial-seven-dotnet) (publisher confirms, especially
the "handling publisher confirms asynchronously" strategy), and the
[confirms docs](https://www.rabbitmq.com/docs/confirms).

```
src/shared/Dailu.Events/
└── IntegrationEventTypes.cs          ← event name ⇄ CLR type (shared with the outbox guide)

src/shared/SharedKernel/Event/
└── IntegrationEventPublishException.cs   ← thrown by the bus when a publish fails

src/shared/SharedInfrastructure/Pipeline/
└── EventDispatchingBehavior.cs       ← catches publish failures on the request path

src/shared/SharedInfrastructure/Event/
├── IntegrationEventSubscription.cs            ← "queue X in module Y handles events A, B, C"
└── IntegrationEventSubscriptionExtensions.cs  ← AddIntegrationEventSubscription<TModuleRoot>(queue)

src/Dailu.Infrastructure/Messaging/
├── IntegrationEventJson.cs           ← one JsonSerializerOptions for both sides
├── RabbitMqTopology.cs               ← exchange name; queue declarations come in phase 3
├── RabbitMqPublisher.cs              ← one confirm-enabled channel, publishes one event
└── RabbitMqIntegrationEventBus.cs    ← IIntegrationEventBus → RabbitMqPublisher

src/Dailu.Infrastructure/Event/Setup.cs   ← IsEnabled ? RabbitMqIntegrationEventBus : InMemoryIntegrationEventBus
src/modules/*/*.Infrastructure/Setup.cs   ← each module declares its own subscription

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

**Decision:** the publisher tracks confirms itself — tutorial 7's *"handling publisher confirms
asynchronously"* strategy. The lock only covers *sending*; waiting for the broker's ack happens
outside it, so many messages can be in flight at once. The 7.x client can do this bookkeeping for
you (`publisherConfirmationTrackingEnabled: true`), but writing it once is the best way to learn
what a confirm actually is. The rest of the guide only sees `PublishAsync`, so swapping to the
built-in tracking later changes nothing outside this class.

Check every API name below against `RabbitMQ.Client` 7.2.2 as you write it —
`GetNextPublishSequenceNumberAsync`, the `BasicAcksAsync` / `BasicNacksAsync` /
`BasicReturnAsync` / `ChannelShutdownAsync` events and their argument types.

```
PublishAsync ── lock ── seq = next sequence number ── pending[seq] = TCS ── send (header x-publish-seq) ── unlock
             └─ await TCS (timeout, cancellation)
                         ▲
broker ── basic.return (x-publish-seq) ── mark pending[seq] as returned
       ── basic.ack  (tag, multiple)   ── for each seq ≤ tag: returned ? fail "unroutable" : succeed
       ── basic.nack (tag, multiple)   ── for each seq ≤ tag: fail "nacked"
       ── channel shutdown             ── fail every pending, clear
```

`src/Dailu.Infrastructure/Messaging/RabbitMqPublisher.cs`:

```csharp
public sealed class RabbitMqPublisher(RabbitMqConnection connection) : IAsyncDisposable
{
    private const string SequenceHeader = "x-publish-seq";
    private static readonly TimeSpan ConfirmTimeout = TimeSpan.FromSeconds(10);

    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly ConcurrentDictionary<ulong, PendingConfirm> _pending = new();
    private IChannel? _channel;

    public async Task PublishAsync(IIntegrationEvent integrationEvent, CancellationToken ct)
    {
        var type = integrationEvent.GetType();
        var name = IntegrationEventTypes.NameOf(type);
        var body = JsonSerializer.SerializeToUtf8Bytes(integrationEvent, type, IntegrationEventJson.Options);
        var pending = new PendingConfirm(name);
        ulong sequence;

        await _lock.WaitAsync(ct);
        try
        {
            var channel = await GetChannelAsync(ct);

            // take the number and send under the same lock, so the broker's numbering
            // (one per publish on this channel) matches ours
            sequence = await channel.GetNextPublishSequenceNumberAsync(ct);

            var properties = new BasicProperties
            {
                MessageId = Guid.CreateVersion7().ToString(),     // once per publish, see 2.2
                Type = name,
                AppId = "dailu-api",                              // CloudEvents "source", see 2.2
                ContentType = "application/json",
                DeliveryMode = DeliveryModes.Persistent,          // survive a broker restart
                Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds()),
                // a returned message has no delivery tag; this is how OnReturnAsync finds it
                Headers = new Dictionary<string, object?> { [SequenceHeader] = (long)sequence },
            };

            _pending[sequence] = pending;
            try
            {
                // returns once the frames are written, *not* when the broker confirms
                await channel.BasicPublishAsync(
                    RabbitMqTopology.Exchange,
                    routingKey: name,
                    mandatory: true,
                    basicProperties: properties,
                    body: body,
                    cancellationToken: ct
                );
            }
            catch
            {
                _pending.TryRemove(sequence, out _);
                throw;
            }
        }
        finally
        {
            _lock.Release();
        }

        // outside the lock: other publishes go out while we wait for our ack
        try
        {
            await pending.Confirmed.Task.WaitAsync(ConfirmTimeout, ct);
        }
        catch (Exception ex) when (ex is TimeoutException or OperationCanceledException)
        {
            // we've stopped waiting; don't leave the entry behind. A late ack finds nothing,
            // which is harmless
            _pending.TryRemove(sequence, out _);
            throw;
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
                publisherConfirmationsEnabled: true,          // broker sends acks/nacks
                publisherConfirmationTrackingEnabled: false   // ...and we match them ourselves
            ),
            ct
        );

        // once per channel; an auto-recovered channel keeps its handlers
        _channel.BasicAcksAsync += OnAckAsync;
        _channel.BasicNacksAsync += OnNackAsync;
        _channel.BasicReturnAsync += OnReturnAsync;
        _channel.ChannelShutdownAsync += OnShutdownAsync;

        await _channel.ExchangeDeclareAsync(
            RabbitMqTopology.Exchange,
            ExchangeType.Topic,
            durable: true,
            autoDelete: false,
            cancellationToken: ct
        );

        return _channel;
    }

    private Task OnAckAsync(object sender, BasicAckEventArgs e)
    {
        foreach (var pending in Take(e.DeliveryTag, e.Multiple))
        {
            if (pending.Returned)
            {
                pending.Confirmed.TrySetException(new InvalidOperationException(
                    $"{pending.EventType} is unroutable: no queue is bound for it."));
            }
            else
            {
                pending.Confirmed.TrySetResult();
            }
        }

        return Task.CompletedTask;
    }

    private Task OnNackAsync(object sender, BasicNackEventArgs e)
    {
        foreach (var pending in Take(e.DeliveryTag, e.Multiple))
        {
            pending.Confirmed.TrySetException(new InvalidOperationException(
                $"The broker nacked {pending.EventType}."));
        }

        return Task.CompletedTask;
    }

    private Task OnReturnAsync(object sender, BasicReturnEventArgs e)
    {
        // the broker sends basic.return *before* the basic.ack for the same message
        if (e.BasicProperties.Headers?.TryGetValue(SequenceHeader, out var raw) == true
            && raw is long sequence
            && _pending.TryGetValue((ulong)sequence, out var pending))
        {
            pending.Returned = true;
        }

        return Task.CompletedTask;
    }

    private Task OnShutdownAsync(object sender, ShutdownEventArgs e)
    {
        // no acks will come for these; sequence numbers restart on a recovered channel
        FailAll(new InvalidOperationException($"Channel closed before the broker confirmed: {e.ReplyText}"));
        return Task.CompletedTask;
    }

    // multiple = true confirms every sequence number up to and including tag
    private List<PendingConfirm> Take(ulong tag, bool multiple)
    {
        var sequences = multiple ? _pending.Keys.Where(s => s <= tag).ToList() : [tag];
        var taken = new List<PendingConfirm>(sequences.Count);

        foreach (var sequence in sequences)
        {
            if (_pending.TryRemove(sequence, out var pending))
            {
                taken.Add(pending);
            }
        }

        return taken;
    }

    private void FailAll(Exception error)
    {
        foreach (var sequence in _pending.Keys)
        {
            if (_pending.TryRemove(sequence, out var pending))
            {
                pending.Confirmed.TrySetException(error);
            }
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel is not null)
        {
            await _channel.CloseAsync();
            await _channel.DisposeAsync();
        }

        FailAll(new ObjectDisposedException(nameof(RabbitMqPublisher)));
        _lock.Dispose();
    }

    private sealed class PendingConfirm(string eventType)
    {
        public string EventType { get; } = eventType;

        // continuations must not run on the client's dispatch thread, or one slow caller
        // would hold up every other ack
        public TaskCompletionSource Confirmed { get; } =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public volatile bool Returned;
    }
}
```

- **Durable exchange + persistent messages + durable (quorum) queues** — all three are needed
  for a message to survive a broker restart. Phase 3 declares the queues.
- **Publisher confirms.** Without them, `BasicPublishAsync` returns as soon as the bytes are on
  the socket; a broker that's out of disk or restarting can still lose the message. With
  confirms on, the broker numbers every publish on the channel (1, 2, 3, …) and later sends
  `basic.ack` or `basic.nack` with that number. `publisherConfirmationTrackingEnabled: false`
  means the client hands those to the events above instead of completing the publish task
  itself.
- **What the lock protects now.** Creating the channel (no two channels from a race), and the
  pair "take the next sequence number, send". If two publishes interleaved between those steps,
  our numbers wouldn't match the broker's. Sending is microseconds; the ack wait — the slow
  part — is outside the lock.
- **`multiple: true`.** The broker may confirm many messages with one frame: "everything up to
  and including 57". `Take` completes all of them.
- **`mandatory: true` and returns.** If no queue is bound for the routing key — the consumer's
  worker hasn't declared its queue yet, or a binding is missing — the broker sends
  `basic.return` and *then* `basic.ack`. The ack only means "I processed it", not "I routed
  it", so a returned message must fail even though it was acked. A return carries no sequence
  number, which is why every message carries `x-publish-seq`. Events that *no* module handles
  never get this far — the bus skips them (2.6).
- **Return before ack is an ordering assumption.** The broker guarantees it on the wire;
  confirm in Verify step 3 that the client also raises the events in that order. If the ack
  ever wins, an unroutable publish would *succeed* — the test catches it.
- **Channel shutdown fails everything pending.** After a connection drop no acks arrive for
  messages sent on the old channel, and automatic recovery restarts the numbering at 1. Failing
  and clearing `_pending` prevents callers from hanging and old numbers from colliding with new
  ones.
- **Timeout and cancellation.** `WaitAsync(ConfirmTimeout, ct)` stops waiting after 10 s or when
  the request is cancelled; the `TimeoutException` becomes `IntegrationEventPublishException` in
  the bus. The `catch` removes the pending entry — otherwise an ack that never comes would leave
  it in `_pending` until the channel shuts down, a slow leak in a long-running process. A
  cancelled request's message may still be confirmed by the broker; nobody is waiting for it
  any more, and `OperationCanceledException` passes through the bus unwrapped.
- **The first connect happens under the lock.** On the first publish, `GetChannelAsync` may
  open the connection. If the broker is down, `CreateConnectionAsync` blocks until its
  connection timeout, and every other publish queues behind the lock for that long.
  `RequestedConnectionTimeout` in `RabbitMqConnection` (phase 1, 1.4) keeps that to 5 s. Once
  the connection exists, automatic recovery takes over and this doesn't happen again.
- **No limit on messages in flight.** Requests publish one or a few events each, so that's fine
  here. An outbox dispatcher draining a large backlog could put thousands in flight at once —
  when you build it, cap its batch size, or acquire a `SemaphoreSlim(maxInFlight)` before each
  publish and release it when that message's task completes.
- **`RunContinuationsAsynchronously`.** Without it, `TrySetResult` inside `OnAckAsync` would run
  the caller's code — the rest of the HTTP request — on the client's event-dispatch thread,
  delaying every ack behind it.
- **Order.** Messages still leave in the order the lock is taken, so a single request's events
  stay in order. Events from *different* concurrent requests have no meaningful order anyway.
- **Exchange declared by the publisher.** `ExchangeDeclareAsync` is idempotent — re-declaring
  with the same arguments is a no-op — so it's safe on every new channel.
- **Switching to built-in tracking later** means `publisherConfirmationTrackingEnabled: true`,
  dropping the events, `_pending` and `PendingConfirm`, and awaiting `BasicPublishAsync` itself.
  Nothing outside this class changes.

## 2.5 Subscriptions, discovered from handlers

Each consuming module gets one queue, bound to every integration event the module has a handler
for. Instead of listing the events by hand, read them from the handler types, so a new handler
can't be forgotten in the binding list.

The work is split in two:

| Part | Lives in | Knows about RabbitMQ? |
|---|---|---|
| **Declaring** a subscription: "module Y, queue X, handles events A, B, C" | `SharedInfrastructure/Event`, called from each module's own `Setup.cs` | no — it's a record in DI |
| **Running** it: queues, bindings, the consumer | `Dailu.Infrastructure/Messaging` (publisher here, the worker in phase 3) | yes |

Every module's `*.Infrastructure` references `SharedInfrastructure`, so the declaration side has
to stay transport-free — no `RabbitMqOptions`, no `RabbitMQ.Client` types, no reference to
`Dailu.Events`. The host side reads the declarations through `IEnumerable<IntegrationEventSubscription>`.

`src/shared/SharedInfrastructure/Event/IntegrationEventSubscription.cs`:

```csharp
/// <summary>A module's queue and the integration events bound to it.</summary>
public sealed record IntegrationEventSubscription(
    string Queue,
    Assembly Module,                    // handlers are only invoked from this assembly
    FrozenSet<Type> EventTypes
);
```

`src/shared/SharedInfrastructure/Event/IntegrationEventSubscriptionExtensions.cs`:

```csharp
public static class IntegrationEventSubscriptionExtensions
{
    public static IServiceCollection AddIntegrationEventSubscription<TModuleRoot>(
        this IServiceCollection services,
        string queue
    )
    {
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
            return services;            // nothing to consume; the line can stay for when a handler arrives
        }

        services.AddSingleton(new IntegrationEventSubscription(queue, module, eventTypes));

        return services;
    }
}
```

and to `AddRabbitMq()` in `Dailu.Infrastructure/Messaging/Setup.cs`:

```csharp
services.AddSingleton<RabbitMqPublisher>();
```

- **Why not `AddRabbitMqConsumer`.** The method no longer adds a consumer — it states what the
  module handles. Whether that's consumed from RabbitMQ, or ignored because the in-memory bus
  runs handlers directly, is the host's business.
- `TModuleRoot` is the module's application-root marker (`ISearchApplicationRoot`), the same
  type already passed to `AddHandlerAssembly<ISearchApplicationRoot>()` — handlers live in that
  assembly.
- **`IEventHandler<T>`** is what Dailu's handlers implement, so that's what the scan looks for.
  Phase 3 *invokes* them through `INotificationHandler<T>`, the interface Mediator registers.
- **No `IsEnabled` check.** Subscriptions are registered whether RabbitMQ is on or off. They're a
  few records in DI; with the switch off nothing reads them — `InMemoryIntegrationEventBus`
  doesn't, and the phase 3 worker isn't registered. That's what lets the declaration live in a
  project that can't see `RabbitMqOptions`.
- **No handlers → no subscription, not an error.** Every module calls this, including `identity`
  and `tag`, which have no integration event handlers today. The day one of them gets a handler,
  it gets a queue without touching any other file.
- **Event names are checked on the host side.** `IntegrationEventTypes` lives in `Dailu.Events`,
  which `SharedInfrastructure` doesn't reference. The phase 3 worker calls
  `IntegrationEventTypes.NameOf` for every subscribed event in its constructor, which runs when
  the host starts — still a startup failure, not one on the first message.
- **Queue names stay unique by hand.** Two modules passing the same name would share one queue
  and steal each other's messages. The worker's constructor is a good place to check that too
  (`GroupBy(s => s.Queue)`).

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
    IEnumerable<IntegrationEventSubscription> subscriptions,
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

Each module declares its own subscription in its `*.Infrastructure/Setup.cs`, right next to the
`AddHandlerAssembly` call it already has. For `search`, in `AddSearchModule`:

```csharp
services.AddHandlerAssembly<ISearchApplicationRoot>();
services.AddIntegrationEventSubscription<ISearchApplicationRoot>("search");
```

The same line, with the module's own marker and queue name, goes into:

| `Setup.cs` | Call |
|---|---|
| `Habit.Infrastructure` | `AddIntegrationEventSubscription<IHabitApplicationRoot>("habit")` |
| `HabitEntry.Infrastructure` | `AddIntegrationEventSubscription<IHabitEntryApplicationRoot>("habit-entry")` |
| `HabitUser.Infrastructure` | `AddIntegrationEventSubscription<IHabitUserApplicationRoot>("habit-user")` |
| `Search.Infrastructure` | `AddIntegrationEventSubscription<ISearchApplicationRoot>("search")` |
| `Identity.Infrastructure` | `AddIntegrationEventSubscription<IIdentityApplicationRoot>("identity")` — registers nothing today |
| `Tag.Infrastructure` | `AddIntegrationEventSubscription<ITagApplicationRoot>("tag")` — registers nothing today |

The handlers these pick up today:

| Queue | Events |
|---|---|
| `habit` | `HabitEntryCompletedIntegrationEvent`, `IntegrationActivitiesDetectedIntegrationEvent` (4 handlers: GitHub, Google Health activities, Google Health steps, Strava) |
| `habit-entry` | `HabitAutomationEntriesDetectedIntegrationEvent` |
| `habit-user` | `IdentityUserCreatedIntegrationEvent` |
| `search` | `HabitNameDescriptionChangedIntegrationEvent`, `HabitEntryNoteChangedIntegrationEvent`, `TagNameChangedIntegrationEvent` |

- **Why in the module and not in `Program.cs`.** The module already owns its handler
  registration (`AddHandlerAssembly`); its subscription is the same fact seen from the broker's
  side. Keeping both lines together means a module can't be wired for handlers but forgotten for
  its queue, and the host doesn't need a list of every module's marker type.
- **`identity` and `tag` have no integration event handlers**, so their call registers nothing
  and they get no queue. When one of them gets its first handler, the queue appears on the next
  start.
- **Handlers outside the marker's assembly.** The scan only looks at `TModuleRoot`'s assembly.
  `HabitUser.Github`, `.Strava` and `.GoogleHealth` have their own markers but no integration
  event handlers today; if one ever gets one, give that assembly its own call and queue (one
  queue per handler assembly, since the worker invokes handlers from exactly one assembly).

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
   resolve `IEnumerable<IntegrationEventSubscription>`: four entries (none for `identity` and
   `tag`), with exactly the events from the table in 2.7. It's the same with `IsEnabled: false` —
   subscriptions don't depend on the switch.
3. **Unroutable.** Rename a tag. The request succeeds and the log shows "Failed to publish
   TagNameChangedIntegrationEvent" with the inner error "…is unroutable: no queue is bound for
   it": the exchange exists (**Exchanges** tab → `dailu.integration`) but no queue is bound yet.
   This is `mandatory` at work, and it proves `OnReturnAsync` ran *before* `OnAckAsync` — if the
   rename logged nothing, the ack won and the return-then-ack assumption from 2.4 doesn't hold
   for your client version. Put breakpoints in both handlers once and watch the order and the
   `x-publish-seq` header.
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
8. **Concurrency.** Fire about 50 tag renames in parallel (a loop in a script, or several
   requests in a `.http` file run together). Every request succeeds, `all-temp` gains 50
   messages, and nothing logs "event is lost". Set a breakpoint in `OnAckAsync` once: you'll see
   `Multiple = true` acks covering several sequence numbers at a time.
9. **Channel loss.** Start the same burst and `docker compose stop dailo.rabbitmq` while it
   runs. Every in-flight publish fails within a moment ("Channel closed before the broker
   confirmed") — nothing waits for the 10 s timeout, no request hangs. Start the broker again; the
   next publish works without restarting the API (automatic recovery on the existing connection,
   or a new channel in `GetChannelAsync`), and the sequence numbers start from 1 again.
10. Set `RabbitMq:IsEnabled` to `false`, restart: renaming a tag indexes it synchronously again,
    and registering creates the `HabitUser` row immediately. **Leave it `false`** until phase 3.
11. **Delete `all-temp`** (and its binding) before phase 3. Phase 3 declares its own queues with
    specific arguments; leftover queues are confusing in the UI and a queue with the same name
    but different arguments makes the declare fail with `PRECONDITION_FAILED`.

Commit: `Publish integration events to RabbitMQ`.

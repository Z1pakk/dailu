# RabbitMQ integration guide

A step-by-step guide for moving **every integration event onto RabbitMQ**. Commands publish
their integration events to a broker, and each module that handles events consumes its own queue
in a background worker inside the API process. Handlers no longer run inside the HTTP request: a
habit / tag / entry-note save stops waiting for Ollama, and a failing handler is retried instead
of being lost.

The broker plumbing lives in `Dailu.Infrastructure/Messaging`, which only the API host
references, so no module depends on RabbitMQ. Modules keep publishing through
`IIntegrationEventBus` and keep writing ordinary `IEventHandler<T>` classes. Plain
`RabbitMQ.Client` is used on purpose — the point is to learn RabbitMQ itself (exchanges, queues,
bindings, acks, confirms, dead-lettering), not a framework that hides it.

No Aspire in this guide: RabbitMQ runs from `docker-compose.yml` like Postgres, and the API reads
its connection settings from `appsettings`.

You implement it yourself, phase by phase. Each phase ends with a **Verify** step.

| Phase | File | What you end up with |
|---|---|---|
| 1 | [01-broker.md](01-broker.md) | RabbitMQ running in Docker with the management UI, a `RabbitMq` options section with an `IsEnabled` switch, and a single shared connection in the API |
| 2 | [02-publishing.md](02-publishing.md) | Every integration event serialized to JSON and published to a topic exchange with publisher confirms; module subscriptions discovered from their handlers; a fake bus for tests |
| 3 | [03-consuming.md](03-consuming.md) | A consumer worker per module (`habit`, `habit-entry`, `habit-user`, `search`), retries with a delay and a dead-letter queue, and handlers made safe to run twice |

**Do phases 2 and 3 back to back.** Once phase 2 is switched on, every integration event goes to
the broker, and nothing consumes it until phase 3. Registering stops creating a `HabitUser`,
completing an entry stops updating the habit, and search stops indexing. Keep
`RabbitMq:IsEnabled` set to `false` in between (see phase 1) except while running phase 2's
Verify steps.

Before starting, work through the official tutorials listed in [Learning
RabbitMQ](#learning-rabbitmq) — at least 1, 2, 4, 5 and 7. Each phase links back to the
tutorial it builds on.

---

## Why

```
today   command ──► SaveChanges ──► EventDispatchingBehavior ──► InMemoryIntegrationEventBus
                                                                  └─► every handler, in the request
                                                                      (search ──► Ollama, 100s of ms;
                                                                       one throws ──► the rest never run,
                                                                       nothing retries)
```

```
target  command ──► SaveChanges ──► EventDispatchingBehavior ──► RabbitMqIntegrationEventBus
                                                                  └─► publish + confirm (~1 ms) ──► request returns
                                                                         │
                                         exchange "dailu.integration" (topic, routing key = event name)
                                              │             │                │              │
                                           "habit"    "habit-entry"    "habit-user"     "search"
                                              │             │                │              │
                                      RabbitMqConsumerWorker<TModuleRoot>, one per module
                                        scope per message ──► that module's handlers only
                                          ├─ ok      ──► ack
                                          └─ throws  ──► nack ──► "<queue>.retry" (TTL 10 s) ──► back to "<queue>"
                                                         after 5 attempts ──► "<queue>.dlq" (parked, inspect by hand)
```

With `RabbitMq:IsEnabled = false` the API registers `InMemoryIntegrationEventBus` instead and
starts no consumers — today's behaviour, for running without Docker.

## Concepts in one paragraph each

- **Exchange, queue, binding.** Publishers never write to a queue directly; they publish to an
  *exchange* with a *routing key*. *Bindings* tell the exchange which queues get a copy. A
  **topic** exchange matches routing keys against binding patterns, so each module's queue binds
  the event names it handles — the publisher doesn't know or care who listens.
- **One queue per consuming module.** Each module gets its own copy of every event it handles and
  processes it at its own pace. The worker for a queue only calls handlers from *that* module's
  assembly, so modules can't trigger each other's handlers twice.
- **Publisher confirms.** `BasicPublishAsync` returning doesn't mean the broker has the message.
  With confirms enabled, the broker acks once the message is safely in the queue (persisted for
  durable queues); the client awaits that ack and throws if it's nacked.
- **Consumer acknowledgements.** With `autoAck: false` the broker keeps a delivered message until
  the consumer acks it. Crash mid-handler and the message is redelivered. That makes delivery
  **at-least-once** — every handler must be safe to run twice. `SearchIndexService` already is
  (upsert by entity, content hash skips unchanged text); the other modules' handlers need
  checking (phase 3, 3.6).
- **Prefetch (QoS).** How many unacked messages the broker pushes to one consumer at once.
  `prefetch = 1` processes one message at a time, in order — slow, but simple and predictable.
- **Dead-letter exchange (DLX) + TTL for retries.** A message rejected with `requeue: false` is
  routed to the queue's DLX instead of being dropped. Point it at a retry queue with a message
  TTL whose own DLX points back at the main queue, and you get "try again in 10 seconds" without
  a timer in your code. The broker records each trip in the `x-death` header, which is how the
  worker counts attempts and finally parks a message in a dead-letter queue.
- **Quorum queues.** The recommended durable queue type in RabbitMQ 4 (classic mirrored queues
  are gone). On a single node it behaves like a durable queue; the same declaration keeps working
  if you ever run a cluster.

## Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Client library | **`RabbitMQ.Client` 7.x** (async API) | Learning goal; MassTransit/Wolverine hide the topology. MassTransit v9 is also commercially licensed |
| Which events | **All integration events** go through the broker | One delivery model for every handler; no per-event routing to keep in sync |
| Where the code lives | **`Dailu.Infrastructure/Messaging`**; bus selection in `Dailu.Infrastructure/Event/Setup.cs` | Only `Dailu.Api` and `Dailu.MigrationsRunner` reference `Dailu.Infrastructure`, so no module can depend on RabbitMQ |
| Who registers consumers | **`Dailu.Api/Program.cs`**, one `AddRabbitMqConsumer<TModuleRoot>("queue")` per module | The module marker types live in `*.Application`, which `Dailu.Infrastructure` can't see; the API host sees every module |
| Subscriptions | **Discovered from the module's handlers** (`IEventHandler<T>` where `T : IIntegrationEvent`) | Adding a handler can't silently miss its binding |
| Switch | **`RabbitMq:IsEnabled`**: `true` → RabbitMQ bus and consumers, `false` → `InMemoryIntegrationEventBus`, nothing RabbitMQ registered | Run the API without Docker; base `appsettings.json` stays off until production has a broker |
| Hosting | **Consumers run in the API process** as `BackgroundService`s | Modular monolith: one deployable. Moving a worker to its own host later only changes where `AddRabbitMqConsumer` is called |
| Topology | **One topic exchange `dailu.integration`; one quorum queue per module**; routing key = event type name | Standard fan-out-per-consumer layout; adding a consumer never touches the publisher |
| Who declares what | **Publisher declares the exchange, each consumer declares its own queues and bindings** | Declarations are idempotent; no separate "provisioning" step to forget |
| Serialization | **`System.Text.Json`**, event type name in the AMQP `type` property, a fresh `message_id` per publish | Readable in the management UI; same type registry as the outbox guide |
| Ordering | **prefetch 1, one consumer per queue** | Events carry full state; parallel consumers could apply an older edit after a newer one |
| Retries | **nack → retry queue (TTL 10 s) → main queue; 5 attempts, then `<queue>.dlq`** | An Ollama restart doesn't lose events; a poison message doesn't loop forever |
| Publish failures | **The bus throws `IntegrationEventPublishException`; the caller decides** — `EventDispatchingBehavior` logs it (the command already committed), a consumer lets it propagate and retries | The bus can't tell a request from a consumer; swallowing inside a consumer would ack a message whose follow-up event was never sent |
| Handler contract | **Throw = retry, return = done** | A transient failure (Ollama down) must throw; a permanent one (wrong vector size) is logged and returned, retrying won't fix it |
| Tests | **`FakeIntegrationEventBus`** in `Test.SharedKernel` records events; cross-module tests use `InMemoryIntegrationEventBus` | No broker in tests; asserting "this command published X" stays one line |
| Durability gap | **Accepted for now** — see below | Fixed by the [outbox guide](../outbox-inbox/README.md), whose dispatcher publishes through this bus |

### What changes for users of the app

Handlers now run a moment *after* the request returns. Most of the time nobody notices, but three
flows become eventually consistent:

- **Registration.** `IdentityUserCreatedIntegrationEventHandler` creates the `HabitUser` row. A
  request the frontend sends right after signup can arrive before that row exists. Decide in
  phase 3 whether those reads create the user on first use or the client retries.
- **Completing an entry.** `HabitEntryCompletedIntegrationEvent` updates the habit's
  `LastCompletedAtUtc` and milestone. The UI can briefly show the old values.
- **Search.** A renamed habit shows up in search results a moment later.

### What this does *not* fix

The broker makes handlers asynchronous and retryable, but the event is still published *after*
the command commits. If the process dies between commit and publish, or RabbitMQ is down at that
moment, the event is lost — exactly the gap described in
[outbox-inbox/README.md](../outbox-inbox/README.md#why-the-current-flow-isnt-enough). With every
event on the broker, a lost event can now mean a user without a `HabitUser` row, not just a stale
search entry, so **do the outbox next**. Its `OutboxDispatcherWorker` publishes through
`IIntegrationEventBus`, which after this guide sends events to RabbitMQ.

## Prerequisites

- Docker (the same `docker-compose.yml` that runs Postgres).
- `search` phase 2 working: the three handlers in `Search.Application/EventHandlers` index data
  through `ISearchIndexService` when you save a habit, tag or entry note.
- The event plumbing: `EventDispatchingBehavior`, `EventDispatcher`, `IIntegrationEventBus`,
  `InMemoryIntegrationEventBus`, and the contracts in `src/shared/Dailu.Events`.
- `Dailu.Infrastructure/Event/Setup.cs` → `AddEvents()`, called from `AddInfrastructure()`, owns
  the `IEventDispatcher` and `IIntegrationEventBus` registrations.

## Conventions used in this guide

- Paths are relative to the repo root (`Dailu/`).
- Snippets are **starting points**, not guaranteed to compile as-is. They target
  `RabbitMQ.Client` 7.x — older tutorials and courses use the 6.x synchronous API (`IModel`,
  `BasicPublish`, `EventingBasicConsumer`); the 7.x names are `IChannel`, `BasicPublishAsync`,
  `AsyncEventingBasicConsumer`.
- Namespace for everything under `src/Dailu.Infrastructure/Messaging` is
  `Dailu.Infrastructure.Messaging`.
- Lines marked **Decision** are choices you can change without breaking later phases.

---

## Learning RabbitMQ

### Start here (free, official)

The official tutorials have a C# version of each step and use the 7.x client. Do them in a
scratch console project, not in Dailu.

| Tutorial | Teaches | Used in |
|---|---|---|
| [1. Hello World](https://www.rabbitmq.com/tutorials/tutorial-one-dotnet) | connection, channel, declare a queue, publish, consume | phase 1 |
| [2. Work queues](https://www.rabbitmq.com/tutorials/tutorial-two-dotnet) | manual acks, durability, prefetch (fair dispatch) | phase 3 |
| [3. Publish/Subscribe](https://www.rabbitmq.com/tutorials/tutorial-three-dotnet) | exchanges, fanout, one queue per consumer | phase 2 |
| [4. Routing](https://www.rabbitmq.com/tutorials/tutorial-four-dotnet) | direct exchanges, binding keys | phase 3 |
| [5. Topics](https://www.rabbitmq.com/tutorials/tutorial-five-dotnet) | topic exchanges, pattern bindings | phase 2–3 |
| [7. Publisher confirms](https://www.rabbitmq.com/tutorials/tutorial-seven-dotnet) | knowing the broker actually has your message | phase 2 |

Tutorial 6 (RPC) is worth reading but isn't used here — request/response between modules stays
on `*.DataTransfer`.

### Reference docs — read when a phase points to them

- [AMQP 0-9-1 model explained](https://www.rabbitmq.com/tutorials/amqp-concepts) — the mental
  model behind exchanges, queues, bindings and message properties. Read it once, early.
- [.NET client API guide](https://www.rabbitmq.com/client-libraries/dotnet-api-guide) —
  connections, channels, automatic recovery, thread-safety rules.
- [Consumer acknowledgements and publisher confirms](https://www.rabbitmq.com/docs/confirms)
- [Dead letter exchanges](https://www.rabbitmq.com/docs/dlx) and
  [TTL](https://www.rabbitmq.com/docs/ttl) — the retry mechanism in phase 3.
- [Quorum queues](https://www.rabbitmq.com/docs/quorum-queues)
- [Reliability guide](https://www.rabbitmq.com/docs/reliability) and
  [production checklist](https://www.rabbitmq.com/docs/production-checklist) — for later, before
  running this anywhere but your machine.
- [rabbitmq-dotnet-client on GitHub](https://github.com/rabbitmq/rabbitmq-dotnet-client) — the
  repo has the v6 → v7 migration notes, useful when a course shows the old API.

### Courses and books (paid)

- **Pluralsight — [RabbitMQ by Example](https://www.pluralsight.com/courses/rabbitmq-by-example)**
  (Stephen Haunts). C#, scenario-based, covers exchange types and RPC. Older client API, but the
  concepts map 1:1.
- **Udemy — [RabbitMQ and Messaging Concepts](https://www.udemy.com/course/rabbitmq-and-messaging-concepts/)**
  (Mustafa Kök). About 4 hours, C# and Java samples, last updated 2022 — again the 6.x API.
- **Book — *RabbitMQ in Depth*** (Gavin Roy, Manning). The best explanation of *why* RabbitMQ
  behaves the way it does (delivery guarantees, performance trade-offs). Python examples, but
  language barely matters.
- **Book — *Enterprise Integration Patterns*** (Hohpe & Woolf), and the free summaries at
  [enterpriseintegrationpatterns.com](https://www.enterpriseintegrationpatterns.com/). The
  vocabulary for what this guide builds: *Publish-Subscribe Channel*, *Dead Letter Channel*,
  *Idempotent Receiver*, *Guaranteed Delivery*.

Check update dates and prices on the course pages before buying; none of them covers the 7.x
async client, so do the official tutorials either way.

### Suggested order

1. Read *AMQP 0-9-1 model explained*.
2. Tutorials 1, 2, 3, 4, 5, 7 in a scratch project; poke at the management UI while they run.
3. Phase 1 of this guide.
4. Read the confirms page, then phase 2.
5. Read the DLX and TTL pages, then phase 3.
6. Then the outbox guide — with every event on the broker, it's the next thing to build.

# RabbitMQ integration guide

A step-by-step guide for moving **slow integration event handlers off the request path** by
publishing those events to RabbitMQ and consuming them in a background worker inside the API
process. The first users are the three `search` indexing handlers — each one calls the embedding
model, so today every habit / tag / entry-note save waits for Ollama.

It's shared infrastructure (`SharedInfrastructure/Messaging`), not a feature of one module. Any
module can subscribe its handlers the same way. Plain `RabbitMQ.Client` is used on purpose — the
point is to learn RabbitMQ itself (exchanges, queues, bindings, acks, confirms, dead-lettering),
not a framework that hides it.

No Aspire in this guide: RabbitMQ runs from `docker-compose.yml` like Postgres, and the API reads
its connection settings from `appsettings`.

You implement it yourself, phase by phase. Each phase ends with a **Verify** step.

| Phase | File | What you end up with |
|---|---|---|
| 1 | [01-broker.md](01-broker.md) | RabbitMQ running in Docker with the management UI, a `RabbitMq` options section, and a single shared connection in the API |
| 2 | [02-publishing.md](02-publishing.md) | Opted-in integration events serialized to JSON and published to a topic exchange with publisher confirms; all other events still in-memory |
| 3 | [03-consuming.md](03-consuming.md) | A reusable consumer worker per module, `search` handlers running in the background, retries with a delay and a dead-letter queue |

Before starting, work through the official tutorials listed in [Learning
RabbitMQ](#learning-rabbitmq) — at least 1, 2, 4, 5 and 7. Each phase links back to the
tutorial it builds on.

---

## Why

```
today   command ──► SaveChanges ──► EventDispatchingBehavior ──► InMemoryIntegrationEventBus
                                                                  └─► search handler ──► Ollama (100s of ms)
                                                                                         ▲ the HTTP request waits here
```

```
target  command ──► SaveChanges ──► EventDispatchingBehavior ──► RoutingIntegrationEventBus
                                                                  ├─ not opted in ──► in-memory, as today
                                                                  └─ opted in ──► RabbitMQ publish (~1 ms) ──► request returns
                                                                                     │
                                         exchange "dailu.integration" (topic, routing key = event name)
                                                                                     │
                                                       queue "search" ◄──────────────┘
                                                             │
                                        RabbitMqConsumerWorker<ISearchApplicationRoot>
                                          scope per message ──► search handlers only
                                            ├─ ok      ──► ack
                                            └─ throws  ──► nack ──► "search.retry" (TTL 10 s) ──► back to "search"
                                                           after 5 attempts ──► "search.dlq" (parked, inspect by hand)
```

## Concepts in one paragraph each

- **Exchange, queue, binding.** Publishers never write to a queue directly; they publish to an
  *exchange* with a *routing key*. *Bindings* tell the exchange which queues get a copy. A
  **topic** exchange matches routing keys against binding patterns, so `search` binds the three
  event names it cares about, and a future `ai-coach` queue can bind different ones — the
  publisher doesn't know or care who listens.
- **One queue per consuming module.** Each module gets its own copy of every event it subscribes
  to and processes it at its own pace. The worker for a queue only calls handlers from *that*
  module's assembly, so modules can't trigger each other's handlers twice.
- **Publisher confirms.** `BasicPublishAsync` returning doesn't mean the broker has the message.
  With confirms enabled, the broker acks once the message is safely in the queue (persisted for
  durable queues); the client awaits that ack and throws if it's nacked.
- **Consumer acknowledgements.** With `autoAck: false` the broker keeps a delivered message until
  the consumer acks it. Crash mid-handler and the message is redelivered. That makes delivery
  **at-least-once** — handlers must be safe to run twice. `SearchIndexService` already is
  (upsert by entity, content hash skips unchanged text).
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
| Hosting | **Consumers run in the API process** as `BackgroundService`s | Modular monolith: one deployable. Moving a worker to its own host later only changes where `AddRabbitMqConsumer` is called |
| Which events | **Opt-in per event**, by a module subscribing to it | Events not subscribed by any queue keep the in-memory path. Other handlers (automation entries, user creation) currently rely on running inside the request; move them deliberately, one at a time |
| Topology | **One topic exchange `dailu.integration`; one quorum queue per module**; routing key = event type name | Standard fan-out-per-consumer layout; adding a consumer never touches the publisher |
| Who declares what | **Publisher declares the exchange, each consumer declares its own queues and bindings** | Declarations are idempotent; no separate "provisioning" step to forget |
| Serialization | **`System.Text.Json`**, event type name in the AMQP `type` property, a fresh `message_id` per publish | Readable in the management UI; same type registry as the outbox guide |
| Ordering | **prefetch 1, one consumer per queue** | Events carry full state; parallel consumers could apply an older edit after a newer one |
| Retries | **nack → retry queue (TTL 10 s) → main queue; 5 attempts, then `<queue>.dlq`** | An Ollama restart doesn't lose events; a poison message doesn't loop forever |
| Handler contract | **Throw = retry, return = done** | A transient failure (Ollama down) must throw; a permanent one (wrong vector size) is logged and returned, retrying won't fix it |
| Durability gap | **Accepted for now** — see below | Fixed by the [outbox guide](../outbox-inbox/README.md), whose dispatcher can publish through this bus |

### What this does *not* fix

The broker makes the slow part asynchronous and retryable, but the event is still published
*after* the command commits. If the process dies between commit and publish, or RabbitMQ is down
at that moment, the event is lost — exactly the gap described in
[outbox-inbox/README.md](../outbox-inbox/README.md#why-the-current-flow-isnt-enough). Doing the
outbox afterwards is straightforward: its `OutboxDispatcherWorker` already publishes through
`IIntegrationEventBus`, which after this guide sends opted-in events to RabbitMQ.

## Prerequisites

- Docker (the same `docker-compose.yml` that runs Postgres).
- `search` phase 2 working: the three handlers in `Search.Application/EventHandlers` index data
  through `ISearchIndexService` when you save a habit, tag or entry note.
- The event plumbing: `EventDispatchingBehavior`, `EventDispatcher`, `IIntegrationEventBus`,
  `InMemoryIntegrationEventBus`, and the contracts in `src/shared/Dailu.Events`.

## Conventions used in this guide

- Paths are relative to the repo root (`Dailu/`).
- Snippets are **starting points**, not guaranteed to compile as-is. They target
  `RabbitMQ.Client` 7.x — older tutorials and courses use the 6.x synchronous API (`IModel`,
  `BasicPublish`, `EventingBasicConsumer`); the 7.x names are `IChannel`, `BasicPublishAsync`,
  `AsyncEventingBasicConsumer`.
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
6. Optionally a course or *RabbitMQ in Depth* for depth; then the outbox guide.

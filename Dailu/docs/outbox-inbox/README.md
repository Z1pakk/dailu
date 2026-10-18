# Outbox / inbox implementation guide

A step-by-step guide for making Dailu's **integration events durable and safe to retry**, using
the transactional outbox (publishing side) and inbox (consuming side) patterns — two small
Postgres tables per module and one generic background dispatcher, no message broker.

It's shared infrastructure, not a feature of one module. The first consumers that need it are
[`search`](../search/README.md) (a missed event means a permanently stale search index) and
[`ai-coach`](../ai-coach/README.md) (e.g. cleaning up conversations when an account goes away),
but any module can opt in the same way.

**When to build this.** Not up front. `search` phase 2 deliberately starts with plain in-process
handlers. Come here when one of these is true:

- an integration event handler does slow or flaky work (an embedding call, an external API) and
  you want it off the request path and retried on failure;
- a missed event causes a bug that nobody will notice or fix by hand (stale index, orphaned rows);
- you're about to swap `InMemoryIntegrationEventBus` for a real broker (see
  [module-isolation-improvements.md](../module-isolation-improvements.md)).

If you've done the [RabbitMQ guide](../rabbitmq/README.md), the dispatcher below still publishes
through `IIntegrationEventBus` — subscribed events then go from the outbox table to RabbitMQ, and
the "publish after commit" gap that guide accepts is closed. The transport decision below then
reads "outbox table → dispatcher → RabbitMQ" instead of "no broker".

You implement it yourself, phase by phase. Each phase ends with a **Verify** step.

| Phase | File | What you end up with |
|---|---|---|
| 1 | [01-outbox.md](01-outbox.md) | Integration events written to a per-module `outbox_messages` table in the same transaction as the change, and a background dispatcher that publishes them with retries |
| 2 | [02-inbox.md](02-inbox.md) | A per-consumer `inbox_messages` table and an idempotent handler base class, so redelivered events are harmless |
| 3 | [03-adopting.md](03-adopting.md) | `habit`, `tag`, `habit-entry` publishing through the outbox; `search` and `ai-coach` consuming through the inbox |

---

## Why the current flow isn't enough

Today (ADR 004), `EventDispatchingBehavior` waits for the command to finish, then publishes the
collected integration events through `InMemoryIntegrationEventBus`, in the same request:

```
command ──► SaveChangesAsync (commit) ──► EventDispatchingBehavior ──► IPublisher ──► other modules' handlers
                                │
                     crash here, or a handler throws ──► event is gone, nothing retries it
```

The business change is committed *before* the event is published, and publishing is a separate,
in-memory step. Three ways that loses events:

1. **Crash or deploy** between commit and publish — the change exists, the event never did.
2. **A handler throws** (DB hiccup, Ollama down) — the change is committed, the handler's work
   isn't, and nothing ever tries again.
3. **One handler throws, others never run** — all handlers for an event run in one publish
   call.

ADR 004 accepted this and deferred the fix: "Future ADR should address outbox pattern if
reliability guarantees become necessary."

## How it fits together

```
 Publishing module (habit, tag, habit-entry, …)                Consuming module (search, ai-coach, …)
 ──────────────────────────────────────────────                ──────────────────────────────────────
 command ──► SaveChangesAsync ─┬─► business rows  ┐ one
                               └─► outbox_messages┘ transaction
                                         │
               OutboxDispatcherWorker<TDbContext> (every few seconds)
                 claim unprocessed rows ──► new DI scope per message
                   ──► set IIntegrationMessageContext.MessageId
                   ──► IIntegrationEventBus.PublishAsync ──────────────► IdempotentIntegrationEventHandler
                   ──► success: mark processed                            inbox check (message id + handler)
                       failure: attempts++, back off, retry later         ├─ seen: no-op
                                                                          └─ new: do work + inbox row,
                                                                             one transaction
```

## Concepts in one paragraph each

- **Transactional outbox.** Instead of publishing an event *after* saving, write the event as a
  row into the publishing module's own `outbox_messages` table, *in the same `SaveChangesAsync`
  call* as the business change. Either both commit or neither does, so an event can no longer be
  lost to a crash — recording it is no longer a separate step from saving the change that caused
  it. A background dispatcher then reads unprocessed rows and publishes them, marking each one
  processed only after publishing succeeded.
- **At-least-once delivery.** The dispatcher can crash after a handler succeeded but before it
  marked the row processed; on restart it publishes the same row again. Retrying on failure has
  the same effect: if handler A succeeded and handler B threw, the retry runs A again too. So the
  outbox guarantees "at least once", never "exactly once". That's not a flaw to engineer away —
  it's the price of durability, and the inbox is how consumers pay it.
- **Inbox (idempotent consumer).** Each consuming module records `(message id, handler)` in its
  own `inbox_messages` table, in the same transaction as the handler's work. Before doing
  anything, the handler checks that table; if the pair is already there, the delivery is a
  duplicate and the handler returns. "Did I process this?" and "did I do the work?" can never
  disagree, because they commit together.
- **Why both.** Outbox without inbox retries into double-processing. Inbox without outbox has
  nothing to deduplicate, because the event can still be lost before it ever reaches the
  consumer. Outbox makes delivery durable; inbox makes redelivery harmless.

## Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Transport | **Postgres tables + a polling `BackgroundService`**, no broker | Consistent with ADR 004's "no distributed messaging overhead"; same database, same backups, nothing new to run |
| Table ownership | **Per module**: `habit.outbox_messages`, `search.inbox_messages`, … | A module never reads another module's schema; the outbox lives next to the data it describes so they share a transaction |
| Adoption | **Opt-in per `DbContext`** (`UseOutbox`), and per handler (base class) | Modules switch one at a time; everything not opted in keeps working exactly as today |
| Message id transport | A scoped **`IIntegrationMessageContext`**, not a `MessageId` property on every event | Existing event records and handlers stay untouched; only handlers that want idempotency read it |
| Inbox key | **`(message_id, handler)`**, not just `message_id` | Two handlers in the same module can receive the same message; each must be tracked separately |
| Retries | **Exponential backoff, max attempts, then parked** (dead letter = row left unprocessed) | A provider outage of a few minutes shouldn't exhaust retries in 25 seconds; a poison message shouldn't loop forever |
| Domain events | **Unchanged** — still published in-process, immediately | They're same-module and already covered by the command's own transaction; nothing to gain from routing them through the outbox |

## Prerequisites

- The existing event plumbing: `EventDispatchingBehavior`, `EventDispatcher`,
  `InMemoryIntegrationEventBus`, `AppDbContextBase`, integration event contracts in
  `src/shared/Dailu.Events`.
- At least one consumer that justifies it — typically `search` phase 2 done and working.

## Conventions used in this guide

- Paths are relative to the repo root (`Dailu/`).
- Code follows the existing patterns: typed `Id<T>`, snake_case tables, the `PeriodicTimer` +
  `IServiceScopeFactory` worker shape from `StravaActivityWorker`.
- Snippets are **starting points**, not guaranteed to compile as-is.
- Lines marked **Decision** are choices you can change without breaking later phases.

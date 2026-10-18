# Phase 2: the inbox (consuming side)

Goal: a consuming module records every `(message id, handler)` it has processed in its own
`inbox_messages` table, in the same transaction as the handler's work, so the outbox's
at-least-once redeliveries become no-ops.

```
dispatcher ──► PublishAsync(event)   [IIntegrationMessageContext.MessageId = outbox row id]
                    │
        IdempotentIntegrationEventHandler<TEvent, TDbContext>.Handle
                    │
          MessageId == null? ──yes──► HandleOnceAsync (in-memory path, no dedup possible)
                    │ no
          inbox has (MessageId, handler)? ──yes──► return (duplicate delivery)
                    │ no
          ExecuteTransactionalAsync:
             add inbox row + HandleOnceAsync(event) ──► one commit
```

**Why a handler can be delivered the same message twice.** From phase 1: the dispatcher can crash
between "publish succeeded" and "mark processed", and a failure in *any* handler for an event
retries the whole publish, re-running the handlers that already succeeded. Without an inbox, a
handler that appends (creates a row, sends an email, increments a counter) does it twice.

**Why key on the handler too, not just the message.** One message is delivered to every handler
subscribed to its type — possibly two in the same module (say, `search` indexing a habit and
`search` invalidating a cache for it). If handler A succeeds and handler B fails, the retry must
skip A but run B. A message-id-only key would skip both.

---

## Step 2.1: The `InboxMessage` entity

`src/shared/SharedKernel/Inbox/InboxMessage.cs`:

```csharp
public class InboxMessage : BaseEntity<Id<InboxMessage>>
{
    public required Guid MessageId { get; init; }      // the outbox row id, from IIntegrationMessageContext
    public required string Handler { get; init; }      // handler type's full name
    public DateTime ProcessedAtUtc { get; init; }
}
```

`SharedInfrastructure/Inbox/InboxMessageConfiguration.cs`:

```csharp
builder.ToTable("inbox_messages");                     // search.inbox_messages, ai_coach.inbox_messages, …
builder.Property(x => x.Handler).HasMaxLength(300);
builder.HasIndex(x => new { x.MessageId, x.Handler }).IsUnique();
```

**The unique index is part of the design, not just a speed-up.** If two dispatchers ever deliver
the same message concurrently (several instances, phase 1), both handlers pass the "seen?" check;
the second commit then fails on the unique index, its transaction rolls back, and the outbox
retries it — at which point the check correctly says "seen".

Every consuming module gets its **own** inbox table in its own schema. A shared inbox would mean
one module reading another's table, which the isolation rules forbid.

---

## Step 2.2: An inbox on the module's db interface

`src/shared/SharedKernel/Inbox/IInbox.cs` — kept EF-free, since `SharedKernel` has no EF
reference and Application-layer handlers only see their module's db interface:

```csharp
public interface IInbox
{
    Task<bool> HasProcessedAsync(Guid messageId, string handler, CancellationToken ct);
    void MarkProcessed(Guid messageId, string handler);
}
```

Implement it once in `AppDbContextBase`:

```csharp
public Task<bool> HasProcessedAsync(Guid messageId, string handler, CancellationToken ct) =>
    Set<InboxMessage>().AnyAsync(x => x.MessageId == messageId && x.Handler == handler, ct);

public void MarkProcessed(Guid messageId, string handler) =>
    Set<InboxMessage>().Add(new InboxMessage
    {
        MessageId = messageId,
        Handler = handler,
        ProcessedAtUtc = timeProvider?.GetUtcNow().UtcDateTime ?? DateTime.UtcNow,
    });
```

These throw at runtime if the context hasn't mapped `InboxMessage`, which is the right failure:
the module forgot step 2.4.

---

## Step 2.3: The idempotent handler base class

`src/shared/SharedKernel/Inbox/IdempotentIntegrationEventHandler.cs`:

```csharp
public abstract class IdempotentIntegrationEventHandler<TEvent, TDbContext>(
    TDbContext db,
    IIntegrationMessageContext messageContext
) : IEventHandler<TEvent>
    where TEvent : IIntegrationEvent
    where TDbContext : IAppDbContextBase, IInbox
{
    protected TDbContext Db { get; } = db;

    public async ValueTask Handle(TEvent @event, CancellationToken ct)
    {
        if (messageContext.MessageId is not { } messageId)
        {
            // Came through the in-memory path (publisher not on the outbox yet): nothing to dedupe on.
            await HandleOnceAsync(@event, ct);
            return;
        }

        var handler = GetType().FullName!;
        if (await Db.HasProcessedAsync(messageId, handler, ct))
        {
            return;
        }

        await Db.ExecuteTransactionalAsync(async () =>
        {
            Db.MarkProcessed(messageId, handler);
            await HandleOnceAsync(@event, ct);
        }, ct);
    }

    // Do the work against Db. Throw on failure — the outbox retries. Don't swallow exceptions here.
    protected abstract ValueTask HandleOnceAsync(TEvent @event, CancellationToken ct);
}
```

`ExecuteTransactionalAsync` (already on `IAppDbContextBase`) wraps the inbox row and everything
`HandleOnceAsync` writes — including any `SaveChangesAsync` it calls itself — in one transaction,
and saves once more at the end. So "marked as processed" and "work done" commit together or not
at all.

Rules for subclasses:

- **Throw on failure.** This is the opposite of the plain in-process handlers (like `search`
  phase 2), which had to swallow errors because nothing would retry. Here a swallowed exception
  means a silently lost event; a thrown one means a retry.
- **Only write through `Db`.** Writes to another DbContext, an external API, or an email aren't
  covered by the transaction. If you must call out, make that call itself idempotent (an
  upsert, an idempotency key), because a retry after a later failure will repeat it.
- **Keep it reasonably short.** The transaction is open for the duration of `HandleOnceAsync`. A
  few hundred milliseconds (an embedding call) is fine at this scale; a multi-second LLM call is
  not — split that into "record the work to do" here and a separate worker.
- **Use the event's `UserId`.** There's no signed-in user in the dispatcher scope (phase 1).

---

## Step 2.4: Opting a consumer in

For a consuming module (`search`, `ai-coach`, …):

1. Map the table in its DbContext's `OnModelCreating`:
   `modelBuilder.ApplyConfiguration(new InboxMessageConfiguration());`
2. Add `IInbox` to its db interface: `public interface ISearchDbContext : IAppDbContextBase, IInbox`.
   `AppDbContextBase` already implements it.
3. Create the migration (`InboxMessages_Create`).
4. Change each handler that should be idempotent to derive from
   `IdempotentIntegrationEventHandler<TEvent, IModuleDbContext>` and move its body into
   `HandleOnceAsync`.

Handlers that don't derive from the base class keep working; they just aren't deduplicated.

---

## Step 2.5: Purge old inbox rows

An inbox row only needs to outlive the longest possible redelivery window — at most the
outbox's retry horizon (a few hours with the phase 1 backoff) plus however long you might take
to requeue a parked message by hand. Purge rows older than 30 days, same shape as the outbox
purge:

```csharp
await db.Set<InboxMessage>()
    .Where(x => x.ProcessedAtUtc < now.AddDays(-30))
    .ExecuteDeleteAsync(ct);
```

If you ever requeue a parked outbox message older than that, the consumer will process it as
new — which is what you want for a message that never succeeded anyway.

---

## ✅ Verify

Using `search` as the consumer (phase 3.2):

1. Rename a habit. `search.inbox_messages` gets exactly one row with the outbox message id and
   `Search.Application…HabitChangedIntegrationEventHandler`.
2. Force a redelivery by hand:
   ```sql
   UPDATE habit.outbox_messages SET processed_at_utc = NULL, next_attempt_at_utc = now()
   WHERE id = '<that id>';
   ```
   The dispatcher publishes it again, the handler returns early (no embedding call in the logs),
   and there's still one inbox row and one `search_index` row.
3. Make the handler throw after doing its writes. No inbox row and no partial `search_index`
   change are committed; the outbox row's `attempts` goes up. Remove the throw, and the next
   retry commits both.
4. With two handlers subscribed to the same event, make only the second one fail. On retry, the
   first one is skipped (its inbox row exists) and only the second runs.

Commit: `feat(shared): idempotent integration event handlers via inbox`.

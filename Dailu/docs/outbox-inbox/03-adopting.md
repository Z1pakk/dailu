# Phase 3: adopting it in `habit`, `tag`, `habit-entry`, `search`, and `ai-coach`

Goal: the events that feed `search` (and anything `ai-coach` reacts to) go through the outbox,
and their consumers deduplicate through the inbox. Each module switches independently; do them
one at a time and verify as you go.

```
habit / tag / habit-entry                         search                                   ai-coach
───────────────────────────                       ──────                                   ────────
UseOutbox = true                                  inbox_messages                           inbox_messages
outbox_messages ──► OutboxDispatcherWorker ──►    HabitChanged/TagChanged/                 handlers for the events
                                                  HabitEntryNoteChanged handlers           it reacts to
                                                  (idempotent, throw on failure,
                                                   embed inline — now off the request path)
```

**Order matters: consumers first, then publishers.** A consumer on the inbox base class still
works with in-memory delivery (`MessageId == null` → no dedup). A publisher on the outbox
*requires* consumers to tolerate redelivery. So: phase 3.2/3.3 (consumers), then 3.1 (publishers).
The steps are numbered by data flow, not by the order you do them.

---

## Step 3.1: Publishers — `habit`, `tag`, `habit-entry`

For each of the three modules:

1. In its DbContext: `protected override bool UseOutbox => true;` and
   `modelBuilder.ApplyConfiguration(new OutboxMessageConfiguration());`
2. In its `Setup.cs`: `services.AddOutbox<HabitDbContext>();` (or `TagDbContext` /
   `HabitEntryDbContext`).
3. Migration: `OutboxMessages_Create`.

Nothing in the aggregates or command handlers changes — `HabitChangedIntegrationEvent` and
friends are still raised next to the existing `RaiseDomainEvent(...)` calls;
`AppDbContextBase.SaveChangesAsync` now diverts them into the outbox.

**Update the backfill commands** (`search` phase 2.4: `RepublishHabitsCommand`,
`RepublishTagsCommand`, `RepublishEntryNotesCommand`). They called `eventDispatcher.SendAsync(...)`
per record, which embedded every record inline inside the backfill request. Switch them to:

```csharp
foreach (var habit in page)
{
    dbContext.EnqueueIntegrationEvent(new HabitChangedIntegrationEvent(...));
}
await dbContext.SaveChangesAsync(ct);    // one commit per page of 500
```

The backfill now finishes in seconds — it only writes outbox rows — and the dispatcher works
through them at 50 per tick in the background, with retries if the embedding provider hiccups.

**Other events from these modules.** Everything they publish moves to the outbox, not just the
three search events — e.g. `HabitEntryCompletedIntegrationEvent`. Check each existing consumer of
those events: it now runs in a background scope with no signed-in user, a few seconds later, and
possibly more than once. Move each onto the inbox base class (step 3.2's pattern) unless its work
is naturally idempotent (an upsert keyed by the event's ids).

**Direct publishers stay as they are for now.** `HabitAutomationEntriesDetectedIntegrationEventHandler`
in `habit-entry` calls `ConsumeEvents()` + `eventDispatcher.SendAsync(...)` itself; with
`UseOutbox` on, the integration events it raises through aggregates go into the outbox on its
`SaveChangesAsync`, and `ConsumeEvents()` only returns domain events. That's the behavior you
want — confirm it in the verify step. `habit-user`'s sync services (`StravaActivityService`
etc.) publish via `SendAsync` without a DbContext and keep using the in-memory path until
`habit-user` opts in.

---

## Step 3.2: Consumer — `search`

1. Opt in per [inbox step 2.4](02-inbox.md#step-24-opting-a-consumer-in): map `InboxMessageConfiguration`, make
   `ISearchDbContext : IAppDbContextBase, IInbox`, migration `InboxMessages_Create`.
2. Rewrite the three handlers on the base class. They **stop swallowing exceptions** — that was
   only there because nothing retried:

```csharp
public sealed class HabitEntryNoteChangedIntegrationEventHandler(
    ISearchDbContext db,
    IIntegrationMessageContext messageContext,
    ISearchIndexWriter writer
) : IdempotentIntegrationEventHandler<HabitEntryNoteChangedIntegrationEvent, ISearchDbContext>(db, messageContext)
{
    protected override async ValueTask HandleOnceAsync(HabitEntryNoteChangedIntegrationEvent e, CancellationToken ct)
    {
        await writer.ApplyAsync(
            new SearchIndexDocument(
                e.UserId, SearchEntityType.EntryNote, e.EntryId, e.HabitId,
                e.Notes, e.CompletedAtUtc, e.IsArchived),
            ct);
    }
}
```

`ISearchIndexWriter` is unchanged from `search` phase 2. It resolves the same scoped
`ISearchDbContext`, so its `SaveChangesAsync` runs inside the base class's transaction together
with the inbox row.

**Still no indexing worker.** This is the payoff of doing the outbox before anything else: the
handler now runs inside the outbox dispatcher, in the background, so the inline embedding call no
longer slows down the request that saved the habit — and if Ollama is down, the event is retried
with backoff instead of logged and forgotten. A separate `Pending` status column plus a
`SearchIndexingWorker` would buy you batching (32 texts per embedding call instead of 1), which
only matters for very large backfills. Add it only if a backfill against a hosted provider hits
rate limits.

**Ordering.** Because a failed message backs off while newer ones go ahead, an older "rename to
A" could be applied after a newer "rename to B". The events carry the full current state, so
the fix is cheap: also put `OccurredAtUtc` (from the event's source change) on the event, store
it on the `search_index` row, and have `SearchIndexWriter` ignore documents older than what's
stored. Skip this until you see it happen — it needs a failure *and* two edits to the same record
within the retry window.

**Monitoring** (replaces the "indexing failures" warning count from `ai-coach` phase 4):

```sql
-- backlog: should hover near 0
SELECT count(*) FROM habit.outbox_messages WHERE processed_at_utc IS NULL;
-- parked: should be 0; alert if not
SELECT count(*) FROM habit.outbox_messages WHERE processed_at_utc IS NULL AND attempts >= 10;
```

(and the same for `tag` and `habit_entry`).

---

## Step 3.3: Consumer — `ai-coach`

`ai-coach` doesn't need any events for phases 1–4 of its guide: it reads everything it needs
on demand through `*.DataTransfer` and `Search.DataTransfer`. The first one it's likely to need
is **account deletion** (`ai-coach` phase 4 requires deleting `ai_coach.*` rows when an account
is deleted). When `identity` publishes such an event, consume it through the inbox from day
one:

1. Opt in per [inbox step 2.4](02-inbox.md#step-24-opting-a-consumer-in): `IAiCoachDbContext : IAppDbContextBase, IInbox`, map
   `InboxMessageConfiguration`, migration `InboxMessages_Create`.
2. The handler:

```csharp
public sealed class UserDeletedIntegrationEventHandler(
    IAiCoachDbContext db,
    IIntegrationMessageContext messageContext
) : IdempotentIntegrationEventHandler<IdentityUserDeletedIntegrationEvent, IAiCoachDbContext>(db, messageContext)
{
    protected override async ValueTask HandleOnceAsync(IdentityUserDeletedIntegrationEvent e, CancellationToken ct)
    {
        await Db.Conversations
            .Where(x => x.UserId == e.UserId)
            .ExecuteDeleteAsync(ct);       // messages cascade
    }
}
```

`ExecuteDeleteAsync` runs inside the base class's transaction, so the delete and the inbox row
commit together. (This handler is naturally idempotent — deleting what's already deleted is a
no-op — so the inbox is belt-and-braces here. Use it anyway: it keeps every consumer the same
shape, and the next handler might not be.)

`search` needs the same handler to delete the user's `search.search_index` rows — same shape,
`Db.SearchIndex.Where(x => x.UserId == e.UserId).ExecuteDeleteAsync(ct)`.

**If `identity` publishes it, `identity` should publish it through the outbox** — an account
deletion that leaves conversations behind is a privacy bug, exactly the kind of missed event this
guide exists to prevent. `IdentityDbContext` has its own `SaveChangesAsync` (phase 1.2), so
port the `UseOutbox` split there, and register `AddOutbox<IdentityDbContext>()`.

---

## Step 3.4: Record the decision

ADR 004 ends with "Future ADR should address outbox pattern if reliability guarantees become
necessary." Close that loop: add `docs/adr/010_outbox_inbox.md` (from `000_template.md`) stating
that integration events from opted-in modules go through a per-module transactional outbox with
at-least-once delivery, and consumers that need exactly-once *effects* use the inbox base class.
Link it from ADR 004's consequences, and tick the "Close the outbox gap" item in
[module-isolation-improvements.md](../module-isolation-improvements.md).

---

## ✅ Verify

1. `search` phase 2's verify list still passes, except step 1 now takes up to ~5 s instead of
   being immediate.
2. Saving a habit or entry is as fast as it was before `search` existed — no embedding call on
   the request path (check the request span in your traces).
3. Stop Ollama, rename a habit: the request succeeds, the `habit.outbox_messages` row retries
   with growing gaps. Start Ollama: the next retry indexes it — no backfill needed.
4. Run the habits backfill twice: the first run writes one outbox row per habit and returns
   quickly; the second run's messages all hit the `ContentHash` check (no embedding calls), and
   `search.inbox_messages` has one row per message, no duplicates.
5. A habit-automation run (Strava → `HabitAutomationEntriesDetected`) still creates entries,
   and their integration events show up in `habit_entry.outbox_messages`, not published inline.
6. Delete a test account: its `ai_coach` conversations and `search.search_index` rows are gone
   within a few seconds, and each consumer has one inbox row for the deletion message.

Commit per module, e.g. `feat(habit): publish integration events via outbox`,
`feat(search): consume indexing events via inbox`.

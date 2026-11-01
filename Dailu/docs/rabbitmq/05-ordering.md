# Phase 5 — Stale messages after a retry

**Goal:** a message that comes back from `<queue>.retry` after a newer event for the same entity
was already handled is recognised as stale and skipped. The newer state stays.

**Builds on:** phases 3 and 4. Fixes the "Ordering caveat" from phase 3, 3.7.

```
src/shared/Dailu.Events/IntegrationEvents/
├── HabitNameDescriptionChangedIntegrationEvent.cs   ← + ChangedAtUtc
├── HabitEntryNoteChangedIntegrationEvent.cs         ← + ChangedAtUtc
└── TagNameChangedIntegrationEvent.cs                ← + ChangedAtUtc

src/modules/habit/Habit.Domain/Aggregates/HabitAggregate.cs            ← raise with the new values; stamp the time
src/modules/habit-entry/HabitEntry.Domain/Aggregates/HabitEntryAggregate.cs   ← stamp the time
src/modules/tag/Tag.Domain/Aggregates/TagAggregate.cs                  ← stamp the time

src/modules/search/
├── Search.Domain/Entities/SearchIndexEntryEntity.cs           ← + SourceChangedAtUtc
├── Search.Application/Features/Indexing/SearchIndexService.cs ← skip older; tombstone instead of delete
└── Search.Infrastructure/Database/Migrations/…                ← new column

src/modules/habit-entry/HabitEntry.Application/EventHandlers/
└── HabitAutomationEntriesDetected/…Handler.cs                 ← an accumulating total never goes down
```

---

## 5.1 The problem, per handler

```
t = 0 s    rename habit "Run" → "Walk"     ──► search: Ollama down, attempt 1 fails ──► search.retry
t = 3 s    rename habit "Walk" → "Swim"    ──► search: Ollama back, indexed "Swim"
t = 10 s   "Walk" comes back from retry    ──► indexed "Walk"   ✗ the index is now older than the habit
```

prefetch 1 keeps a queue in order only until a message goes to the retry queue. Which handlers
care?

| Handler | Applies a newer-wins state? | Effect of a stale message | Fix |
|---|---|---|---|
| The three `search` handlers | yes: the entity's text | the index shows older text, or a removed entry comes back | **5.3 – 5.5** |
| `HabitEntryCompletedIntegrationEventHandler` | yes: `LastCompletedAtUtc` | none: `HabitAggregate.Complete` ignores an older completion | nothing |
| `IdentityUserCreatedIntegrationEventHandler` | no, create only | none (with the existence check from 3.7) | nothing |
| `HabitAutomationEntriesDetected…Handler`, one-shot entries | no, create or skip | none | nothing |
| `HabitAutomationEntriesDetected…Handler`, `AllowUpdate` entries (a day's step count) | yes: the running total | the day's total **goes down** to an older count | **5.6** |
| The four `IntegrationActivitiesDetected` handlers (`habit`) | no: they derive entries and publish | ordering is decided in `habit-entry` | nothing |

## 5.2 What to compare

A stale-message check needs a value that **grows with every change** of the entity and travels in
the event.

| Candidate | Usable? |
|---|---|
| `Aggregate.Version` / `BaseEntity.Version` | **No.** It's a `Guid` concurrency token, a new random value on every save; it says "changed", not "newer" |
| AMQP `Timestamp` | **No.** Whole seconds only, and it's *publish* time set by the publisher (2.2), not the time of the change |
| `LastModifiedAtUtc` | **No.** `AuditInterceptor` sets it inside `SaveChanges`, after the event was already raised |
| **A `ChangedAtUtc` on the event, stamped when the aggregate changes** | **Yes**, with the limits in 5.7 |
| A `long Revision` on the aggregate, `+1` per change | Yes, and exact, but it's a column and a migration in every module that raises these events. See 5.7 |

**Decision:** `ChangedAtUtc`. It follows the rule from 2.2: business times are explicit
properties on the event, only where a handler needs them. A handler needs it now.

## 5.3 Fix first: the habit rename event carries the old text

In `HabitAggregate.Update`, the event is raised **before** the new values are assigned:

```csharp
if (nameDescriptionChanged)
{
    RaiseDomainEvent(new HabitNameDescriptionChangedIntegrationEvent(Id.ToId(), UserId, Name, Description, IsArchived));
}

Name = request.Name;               // ← too late: the event already has the old Name
Description = request.Description;
```

So `search` indexes the name the habit had **before** the rename. Ordering can't help with that,
because every message is wrong. Raise the event after the assignments, or pass `request.Name`
and `request.Description`. Fix this before anything else in this phase, and check the other
aggregates' `Update` methods for the same pattern. `HabitEntryAggregate.Update` passes the new
`notes`, so it's fine.

## 5.4 Stamp the change time on the event

Add the property to the three events:

```csharp
public record TagNameChangedIntegrationEvent(Id TagId, Guid UserId, string Name, DateTime ChangedAtUtc)
    : IIntegrationEvent;
```

The same `DateTime ChangedAtUtc` goes last on `HabitNameDescriptionChangedIntegrationEvent` and
`HabitEntryNoteChangedIntegrationEvent`.

The aggregates don't have a clock, so the method that changes them takes the time:

```csharp
public static Result<TagAggregate> Create(Guid userId, string name, string? description, DateTime nowUtc)
{
    ...
    aggregate.RaiseDomainEvent(
        new TagNameChangedIntegrationEvent(aggregate.Id.ToId(), aggregate.UserId, aggregate.Name, nowUtc)
    );
}
```

Callers pass `timeProvider.GetUtcNow().UtcDateTime`. That means the command handlers, plus
`HabitAutomationEntriesDetectedIntegrationEventHandler`, which calls `HabitEntryAggregate.Create`
and `Update` and so needs `TimeProvider` injected. The compiler lists every call site once the
parameter exists.

| Aggregate | Methods that get `nowUtc` |
|---|---|
| `HabitAggregate` | `Create`, `Update` |
| `HabitEntryAggregate` | `Create`, `Update` |
| `TagAggregate` | `Create` (it has no rename today; when it gets one, same parameter) |

- **One `nowUtc` per command.** Read the clock once in the handler and pass the same value to
  every aggregate it changes, so events from one command don't get times a few ticks apart.
- **Replace `DateTime.UtcNow` in the aggregates while you're there.** `HabitEntryAggregate`
  checks `completedAtUtc > DateTime.UtcNow`; compare against `nowUtc` instead, so tests can
  control time.
- **Old messages without the property.** Messages already in a queue or a DLQ when you deploy
  deserialize with `ChangedAtUtc = default` (`0001-01-01`). The check in 5.5 treats them as
  oldest, so they're skipped if anything newer was indexed. That's the right outcome. Drain or
  replay the queues before deploying if you'd rather not think about it.

## 5.5 Search: skip older, keep a tombstone

### The entity

Add to `SearchIndexEntryEntity`:

```csharp
/// <summary>
/// ChangedAtUtc of the event this row was last written from. An event older than this is stale.
/// </summary>
public DateTime SourceChangedAtUtc { get; set; }
```

Add a migration for the column. Existing rows get `0001-01-01`, so the first new event for each
entity always applies.

### The check

`SearchIndexModel` gets `DateTime ChangedAtUtc`, filled from the event by each handler. Then, in
`SearchIndexService.AddAsync`:

```csharp
var existingIndex = await dbContext
    .SearchIndexEntries.IgnoreQueryFilters()            // a tombstone counts too, see below
    .FirstOrDefaultAsync(x => x.EntityType == model.EntityType && x.EntityId == model.EntityId, ct);

if (existingIndex is not null && model.ChangedAtUtc < existingIndex.SourceChangedAtUtc)
{
    // a retried message overtaken by a newer one; the stored state is already newer
    return Result.Success();
}
```

and set `existingIndex.SourceChangedAtUtc = model.ChangedAtUtc` on **every** path that writes the
row, including the "same text, same model" shortcut.

- **`<`, not `<=`.** The same message delivered twice has the same time. It must still pass,
  and the content-hash check then makes it a no-op.
- **Return `Success`, not a failure.** A stale message is handled correctly by doing nothing.
  Throwing would retry it, and a failure result would log an error for a normal case. A
  `LogDebug` line helps while you verify this phase.

### Tombstones instead of deletes

Today an archived or emptied entity is **removed** from the index. After that, a stale message
from before the archive finds no row, has nothing to compare against, and brings the entry back:

```
t = 0 s    edit note            ──► fails ──► search.retry
t = 3 s    archive the entry    ──► row removed
t = 10 s   the edit returns     ──► no row ──► indexed again   ✗ an archived entry is searchable
```

So keep the row as a **tombstone**: soft-delete it and record the time. `BaseEntity` already has
`IsDeleted`, and `SoftDeleteConvention` hides soft-deleted rows from every EF query.

```csharp
if (normalizedText is null || model.IsArchived)
{
    if (existingIndex is not null && !existingIndex.IsDeleted)
    {
        existingIndex.IsDeleted = true;
        existingIndex.SourceChangedAtUtc = model.ChangedAtUtc;
        await dbContext.SaveChangesAsync(ct);
    }

    return Result.Success();
}
```

When a newer event brings the entity back (unarchived, or new text), the same row is reused:
set `IsDeleted = false` along with the new text and embedding.

- **`IgnoreQueryFilters()` in the lookup** is what makes the tombstone visible to the check.
  Without it, a soft-deleted row looks like "no row" and the bug above comes back.
- **The search endpoint must exclude tombstones.** EF queries do automatically. Raw SQL does
  not — the vector and trigram queries (search guide, phase 3) need `AND NOT is_deleted`.
- **Tombstones keep their embedding.** That's wasted space, but a row with a stale vector is
  harmless because it's never returned. If it matters later, clear `Text` and `Embedding` on the
  tombstone (make `Embedding` nullable for that).
- **No unique-index conflict.** The tombstone is the same row the entity will reuse, so the
  `(EntityType, EntityId)` uniqueness holds.

## 5.6 habit-entry: an accumulating total never goes down

`AllowUpdate` entries are re-reported running totals under a stable `ExternalId`, such as a day's
step count from Google Health. Two polls a few minutes apart publish 4 000, then 6 500. If the
first one is retried and arrives last, the entry drops back to 4 000.

A day's running total only grows, so in `HabitAutomationEntriesDetectedIntegrationEventHandler`:

```csharp
if (!entry.AllowUpdate)
{
    continue;
}

if (entry.Value < existing.Value)
{
    // an older poll overtaken by a newer one; a running total doesn't decrease
    continue;
}
```

- **This relies on the meaning of `AllowUpdate`.** Its doc comment defines it as "an accumulating
  total under a stable id". If a source ever needs to *correct* a value downwards, this rule
  blocks it. Then add an `ObservedAtUtc` to `HabitAutomationEntryDetected`, store it on the
  entry, and compare times as in 5.5.
- **Notes follow the value.** The skipped message's notes are skipped too. That's what you want:
  they belong to the older count.

## 5.7 Limits

- **Clock skew between API instances.** `ChangedAtUtc` comes from the clock of whichever instance
  handled the command. With one instance there's no skew. With several, two edits of the same
  entity *milliseconds apart* on different machines could be ordered wrongly. Compare that with
  the problem being fixed: a message delayed by **10 s or more** in the retry queue. Skew of a
  few ms doesn't change the outcome there.
- **Two changes in the same tick** get the same time, and both are applied in arrival order.
  `DateTime` has 100 ns resolution and one command reads the clock once, so this needs two
  commands for the same entity at practically the same instant.
- **The exact alternative** is a `long Revision` on each aggregate that raises these events,
  incremented by every method that changes it, persisted, and carried in the event in place of
  `ChangedAtUtc`. The comparison in 5.5 stays the same. It removes both limits above at the cost
  of a column and a migration in `habit`, `habit-entry` and `tag`. Switch if you ever run
  several API instances and see wrong ordering in practice.
- **The outbox doesn't change any of this.** It makes publishing reliable, not ordered across
  retries. The checks here keep working when events come from the outbox.

---

## Verify

1. **Rename fix (5.3).** Rename a habit "Run" → "Walk". The `search_index` row for it says
   "Walk", not "Run".
2. **Stale rename is skipped.** Stop Ollama. Rename "Walk" → "Swim": attempt 1 fails, the message
   waits in `search.retry`. Start Ollama, and within the retry delay rename "Swim" → "Cycle": the
   row says "Cycle". When the "Swim" message comes back, the log shows it skipped and the row
   still says "Cycle".
3. **Duplicate still passes.** In the UI, publish the latest `HabitNameDescriptionChanged…`
   payload a second time: no error, no new embedding call (the hash matches), the row unchanged.
4. **Tombstone.** Stop Ollama, edit an entry's note, start Ollama, archive the entry within the
   retry delay. The row is now `is_deleted = true`. When the note edit returns, it's skipped and
   the row stays deleted; the entry doesn't appear in search.
5. **Unarchive.** Unarchive the entry: the same row comes back with `is_deleted = false` and
   fresh text, no second row.
6. **Steps.** Publish two `HabitAutomationEntriesDetectedIntegrationEvent`s by hand for the same
   `ExternalId` with `AllowUpdate: true`, values 6500 then 4000. The entry keeps 6500.

Commit: `Skip stale integration events after retries`.

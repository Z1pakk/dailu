# Phase 2: indexing habits, tags, and entry notes

Goal: habits, tags, and habit entry notes each get an **embedding** stored in
`search.search_index` — one table, tagged by `entity_type`, not three parallel tables. New,
edited, and old records are covered.

This phase deliberately uses the **plain, existing integration event flow** — no outbox, no
inbox, no background worker. The `search` handler receives the event in-process, embeds the text
right there, and upserts the row. That's the smallest thing that works; the
[outbox/inbox guide](../outbox-inbox/README.md) is the later hardening step that makes delivery
durable and moves the embedding off the request path.

```
Habit created/renamed      ──► HabitChangedIntegrationEvent         ─┐
Tag created/renamed        ──► TagChangedIntegrationEvent            ├─► EventDispatchingBehavior
HabitEntry notes changed   ──► HabitEntryNoteChangedIntegrationEvent ┘   (after SaveChanges, same request)
                                                      │
                                         InMemoryIntegrationEventBus
                                                      │
                          Search event handler ──► ISearchIndexWriter
                                normalize + hash ──► IEmbeddingGenerator ──► upsert row with vector
```

**What an integration event is.** In a modular monolith, each module owns its own tables and is
never allowed to query another module's schema directly — that's the isolation rule the
architecture tests enforce. So when a habit is renamed, `search` can't just `JOIN` against the
habit table to notice. Instead, the `habit` module publishes a small, self-contained message (the
integration event) describing *what changed*, and any module that cares — here, `search` —
subscribes and reacts. This is the existing mechanism from ADR 004: `EventDispatchingBehavior`
collects the events after the command's `SaveChangesAsync` and `InMemoryIntegrationEventBus`
publishes them through Mediator, still inside the same HTTP request.

**Decision: embed inline in the handler, for now.** Embedding calls take 50–500 ms locally, and
that time is added to the request that saved the habit/tag/entry, because the in-memory bus runs
handlers synchronously. For a single user editing a handful of records that's acceptable, and it
avoids a worker, a status column, and a retry loop. Revisit it (via the outbox/inbox guide) when
any of these bite:

- saving a habit or entry feels slow because of the embedding call;
- the embedding provider is down or rate-limited (`429`) often enough that rows go stale;
- you need a guarantee that every change eventually lands in the index.

**What you give up, explicitly.** ADR 004 already calls this out: in-process integration events
have no durability and no retry. If the process crashes between the habit being saved and the
handler finishing, or the embedding call fails, that change simply isn't indexed. The index is
then stale for that record until it's edited again or the backfill (step 2.4) is re-run. Search
is a convenience feature, so that's tolerable for now — but it's the reason the outbox/inbox
guide exists.

**Decision: one table, an `entity_type` discriminator.** Habits, tags, and entry notes are all "a
short piece of text that belongs to a user and should be searchable." They don't need separate
tables or separate query code — only a column that says what each row is and which record it
points back to.

---

## Step 2.1: Three integration events

`src/shared/Dailu.Events/HabitEntryNoteChangedIntegrationEvent.cs` (if it doesn't already exist
from earlier work on this module):

```csharp
public sealed record HabitEntryNoteChangedIntegrationEvent(
    Guid EntryId,
    Guid UserId,
    Guid HabitId,
    string? Notes,              // null/empty => remove from the index
    DateTime CompletedAtUtc,
    bool IsArchived
) : IIntegrationEvent;
```

`src/shared/Dailu.Events/HabitChangedIntegrationEvent.cs`:

```csharp
public sealed record HabitChangedIntegrationEvent(
    Guid HabitId,
    Guid UserId,
    string Name,
    string? Description,
    bool IsArchived
) : IIntegrationEvent;
```

`src/shared/Dailu.Events/TagChangedIntegrationEvent.cs`:

```csharp
public sealed record TagChangedIntegrationEvent(
    Guid TagId,
    Guid UserId,
    string Name,
    bool IsArchived
) : IIntegrationEvent;
```

**Why new events instead of reusing existing ones?** `search` must never read the habit, tag,
or habit-entry databases directly (module isolation), so each event has to carry everything the
index needs to build its `Text` column without a follow-up query. It also carries `UserId`
explicitly — don't rely on `ICurrentUserService` in the handler. It happens to be set today
because the handler runs inside the user's request, but it won't be once these events are
delivered from a background dispatcher (outbox/inbox guide) or a backfill.

Raise each from its owning aggregate (`HabitAggregate`, `TagAggregate`, `HabitEntryAggregate`),
next to the existing `RaiseDomainEvent(...)` calls, **only when a field the index cares about
actually changed** (name/description/notes, or archived state), to avoid re-embedding identical
text.

---

## Step 2.2: Recap — the table you're filling

Phase 1 (step 1.8) already created everything this phase writes to: `SearchEntityType`,
`SearchIndexEntryEntity`, its EF configuration, `ISearchDbContext.SearchIndex`, and the
`search.search_index` table. Phase 1 (step 1.6) also created the two services the writer below
depends on: `IEmbeddingTextFormatter` (adds `search_document: ` before embedding) and
`IAiModelInfo` (the model name to stamp on each row and the expected vector size).

No new migration in this phase.

---

## Step 2.3: The index writer and the event handlers

All three handlers do the same thing — "make the row for this entity match this text" — so put
that logic in one place and keep the handlers as thin mappers.

`Search.Application/Indexing/ISearchIndexWriter.cs`:

```csharp
public sealed record SearchIndexDocument(
    Guid UserId,
    SearchEntityType EntityType,
    Guid EntityId,
    Guid? HabitId,
    string? Text,               // raw text; null/empty => remove
    DateTime? OccurredAtUtc,
    bool IsArchived             // archived => remove
);

public interface ISearchIndexWriter
{
    Task ApplyAsync(SearchIndexDocument document, CancellationToken ct);
}
```

`Search.Application/Indexing/SearchIndexWriter.cs`:

```csharp
public sealed class SearchIndexWriter(
    ISearchDbContext db,
    IEmbeddingGenerator<string, Embedding<float>> embedder,
    IEmbeddingTextFormatter formatter,          // adds "search_document: " etc.
    IAiModelInfo modelInfo                      // exposes the configured embedding model name
) : ISearchIndexWriter
{
    public async Task ApplyAsync(SearchIndexDocument doc, CancellationToken ct)
    {
        var existing = await db.SearchIndex.FirstOrDefaultAsync(
            x => x.EntityType == doc.EntityType && x.EntityId == doc.EntityId, ct);

        var text = SearchText.Normalize(doc.Text);       // trim, collapse whitespace, cap length

        if (text is null || doc.IsArchived)
        {
            if (existing is not null)
            {
                db.SearchIndex.Remove(existing);
                await db.SaveChangesAsync(ct);
            }
            return;
        }

        var hash = SearchText.Hash(text);
        if (existing is not null
            && existing.ContentHash == hash
            && existing.EmbeddingModel == modelInfo.EmbeddingModel)
        {
            return;   // same text, same model — the stored vector is still right
        }

        var embedding = await embedder.GenerateVectorAsync(formatter.ForDocument(text), cancellationToken: ct);
        if (embedding.Length != modelInfo.EmbeddingDimensions)
        {
            throw new InvalidOperationException(
                $"Embedding model returned {embedding.Length} dimensions, expected {modelInfo.EmbeddingDimensions}.");
        }

        var row = existing ?? db.SearchIndex.Add(new SearchIndexEntryEntity
        {
            Id = Id<SearchIndexEntryEntity>.NewId(),
            UserId = doc.UserId,
            EntityType = doc.EntityType,
            EntityId = doc.EntityId,
            Text = text,
            ContentHash = hash,
            Embedding = null!,
            EmbeddingModel = null!,
        }).Entity;

        row.HabitId = doc.HabitId;
        row.OccurredAtUtc = doc.OccurredAtUtc;
        row.Text = text;
        row.ContentHash = hash;
        row.Embedding = new Vector(embedding);
        row.EmbeddingModel = modelInfo.EmbeddingModel;

        await db.SaveChangesAsync(ct);
    }
}
```

Put `SearchText` (normalize + SHA-256 hash) in `Search.Application` too, and register
`ISearchIndexWriter` as scoped in `Search.Infrastructure/Setup.cs`.

Then one handler per event, for example
`Search.Application/EventHandlers/HabitEntryNoteChanged/HabitEntryNoteChangedIntegrationEventHandler.cs`:

```csharp
public sealed class HabitEntryNoteChangedIntegrationEventHandler(
    ISearchIndexWriter writer,
    ILogger<HabitEntryNoteChangedIntegrationEventHandler> logger
) : INotificationHandler<HabitEntryNoteChangedIntegrationEvent>
{
    public async ValueTask Handle(HabitEntryNoteChangedIntegrationEvent e, CancellationToken ct)
    {
        try
        {
            await writer.ApplyAsync(
                new SearchIndexDocument(
                    e.UserId, SearchEntityType.EntryNote, e.EntryId, e.HabitId,
                    e.Notes, e.CompletedAtUtc, e.IsArchived),
                ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Failed to index entry note {EntryId}; index is stale until re-indexed", e.EntryId);
        }
    }
}
```

`HabitChangedIntegrationEventHandler` and `TagChangedIntegrationEventHandler` are the same shape
with `SearchEntityType.Habit` / `SearchEntityType.Tag`, `HabitId = null`, `OccurredAtUtc = null`,
and `Text` built from name (+ description, for habits).

**Why the handler swallows failures instead of throwing.** These handlers run *after* the
originating command already committed — `EventDispatchingBehavior` publishes once `next(...)` has
returned. Throwing here can't roll the rename back; it would only turn a successful save into a
`500` for the user, and could stop other modules' handlers for the same event from running. A
logged warning plus a stale index row is the honest outcome with no retry mechanism. (The
outbox/inbox guide flips this: once there's a dispatcher that retries, handlers *should* throw.)

**Why hash the text.** `ContentHash` answers "is the text unchanged?" cheaply: the backfill in
step 2.4 re-sends every record, and most of them are already correct. Comparing a fixed-length
hash avoids a pointless embedding call (the expensive part) for each of those. The
`EmbeddingModel` comparison next to it is what makes re-indexing after a model change work —
same text, different model, so re-embed.

- **What to embed — per entity type:**
  - `Habit`: name, and description if present (`"Morning run — 5k before work"`).
  - `Tag`: just the name.
  - `EntryNote`: the note text. Optionally prefix it with the date
    (`"2026-09-20: felt tired, skipped stretching"`), which helps when the note is later shown
    as context.
- **`Text` is also what partial/fuzzy matching runs on** (phase 3's text leg). Keep
  `SearchText.Normalize` to whitespace and length only — don't lowercase, strip punctuation, or
  remove stop words. `pg_trgm` and `ILIKE` handle case themselves, and anything removed here is
  text the user can no longer find by typing it.
- **Habit name on entry notes:** don't denormalize it into `Text`. A rename would then have to
  re-embed every note of that habit. Consumers add the habit name when they display results,
  using `HabitId` and `Habit.DataTransfer`.
- **`nomic-embed-text` prefixes:** always go through `IEmbeddingTextFormatter` (phase 1, step
  1.6) — stored text as `ForDocument(text)` here, queries as `ForQuery(text)` in phase 3, for
  every entity type, not just notes.
- **Keep the request bounded.** Give the embedding `HttpClient` a short timeout (a few seconds)
  in `AiSetup.cs`, so a hung Ollama makes indexing fail fast and get logged instead of holding
  the user's save request open.

---

## Step 2.4: Backfill existing records

Old habits, tags, and entries never raised the new events. Add a command **inside each owning
module** that re-publishes its event for every existing record, page by page — for example,
inside `habit-entry`:

```csharp
// HabitEntry.Application/Features/RepublishEntryNotes/RepublishEntryNotesCommand.cs
// Pages through habit_entries WHERE notes IS NOT NULL (keyset pagination on id, 500 per page)
// and calls eventDispatcher.SendAsync(new HabitEntryNoteChangedIntegrationEvent(...)) for each.
```

Do the same for habits (`RepublishHabitsCommand` in `habit`) and tags (`RepublishTagsCommand` in
`tag`). `eventDispatcher.SendAsync(...)` publishes straight through the in-memory bus, so each
record is embedded inline, one call at a time. That's slow for thousands of records, but it's a
one-off — don't optimize it.

**Why in each owning module and not in `search`?** `search` would otherwise need a
data-transfer method that reads *all users'* records without a user filter. The backfill is
each owning module's own concern; `search` only ever sees events.

Trigger each once, either from a development-only endpoint (`if (app.Environment.IsDevelopment())`)
or a one-off startup flag (`Ai:BackfillOnStartup=true`). They're idempotent thanks to the
`ContentHash` + `EmbeddingModel` check, so running them twice is harmless — which also makes the
backfill your **repair tool**: if indexing failed while Ollama was down, re-run it.

### Re-indexing when the embedding model changes

**Why vectors from different models aren't comparable.** Cosine distance only means something
between two vectors produced by the *same* model — the 768 numbers are coordinates in a space
that model itself defined during training; a different model (or even a different version of
the same model) defines a differently-shaped space, where "close" and "far" mean something
else entirely. Mixing vectors from two models and comparing them with cosine distance doesn't
error, it just silently returns meaningless rankings — a much worse failure than a crash,
because nothing tells you it's wrong. That's why every row stores `EmbeddingModel` and every
query filters on it: it's a guard against comparing vectors that were never meant to be compared.

After changing `Ai:Embedding:Model`, re-run the three backfills. The writer sees a different
`EmbeddingModel` on every row and re-embeds it. Until that finishes, search's semantic leg (which filters on
`embedding_model = configuredModel`, phase 3) only returns rows already re-embedded — fewer
meaning-based results for a while, never wrong ones. The text leg doesn't depend on the model,
so partial and fuzzy matches keep finding every row throughout.

---

## ✅ Verify

1. Rename a habit. Immediately after the request returns:
   ```sql
   SELECT entity_type, entity_id, embedding_model, vector_dims(embedding)
   FROM search.search_index ORDER BY COALESCE(last_modified_at_utc, created_at_utc) DESC LIMIT 5;
   ```
   It should show `Habit | <habit id> | nomic-embed-text | 768`.
2. Create an entry with notes "legs sore after the long run", and a tag named "Running club" —
   both get indexed the same way.
3. Resave a note with the same text, and nothing happens (no embedding call in the logs, thanks
   to the hash check). Change it, and the row's `text` and vector update.
4. Archive a habit, and its row disappears.
5. Stop Ollama, then rename a habit. The rename still succeeds (no `500`), a warning is logged,
   and the index row keeps the old name. Start Ollama, run the habits backfill, and the row
   catches up.
6. Run all three backfills. Every existing habit, tag, and note-bearing entry gets a row, and
   running them again makes no embedding calls.

Commit: `feat(search): embed habits, tags, and entry notes via integration events`.

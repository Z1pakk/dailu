# Phase 2: indexing entry notes (the "R" in RAG)

Goal: every habit entry that has notes gets an **embedding** stored in `ai_coach.note_embeddings`.
New, edited and old entries are covered, with no slowdown for the user who saves the entry.

```
HabitEntry saved ──► HabitEntryNoteChangedIntegrationEvent ──► AiCoach handler: upsert row (status = Pending)
                                                                              │
                                        NoteIndexingWorker (every few seconds) ◄┘
                                          batch of Pending rows ──► IEmbeddingGenerator ──► vector saved (Indexed)
```

**Decision: embed in the background, not inside the request.** Embedding calls take 50–500 ms
locally, and hosted free tiers can return `429`. A background worker keeps entry saving fast and
lets failed embeddings retry.

---

## Step 2.1: A new integration event

`src/shared/Dailu.Events/HabitEntryNoteChangedIntegrationEvent.cs`:

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

**Why a new event?** `HabitEntryCompletedIntegrationEvent` only carries `HabitId` and a date.
Ai-coach must never read the habit-entry database directly (module isolation), so the event has
to carry everything the index needs.

Raise it from `HabitEntryAggregate` (`src/modules/habit-entry/HabitEntry.Domain/Aggregates`):

- In `Create(...)`, next to the existing `RaiseDomainEvent(...)` call.
- In `Update(...)`, **only when `Notes` or `CompletedAtUtc` actually changed**, to avoid
  re-embedding identical text.
- In archive/unarchive if you add them later (`IsArchived = true` removes the note from search).

This covers entries created by the Strava/GitHub/Google Health automations too, because they
also go through the aggregate. Those notes (for example `[Run] Morning run (5.2 km)`) become
searchable as well.

---

## Step 2.2: The `NoteEmbedding` entity

`AiCoach.Domain/Entities/NoteEmbeddingEntity.cs`:

```csharp
public class NoteEmbeddingEntity : BaseEntity<Id<NoteEmbeddingEntity>>
{
    public required Guid UserId { get; set; }
    public required Guid HabitEntryId { get; set; }      // unique: one row per entry
    public required Guid HabitId { get; set; }
    public required string Text { get; set; }            // exactly what was embedded
    public required string ContentHash { get; set; }     // SHA-256 of Text, to skip unchanged notes
    public required DateTime OccurredAtUtc { get; set; }

    public Vector? Embedding { get; set; }               // Pgvector.Vector, null until indexed
    public string? EmbeddingModel { get; set; }          // e.g. "nomic-embed-text", for re-indexing
    public NoteEmbeddingStatus Status { get; set; }      // Pending | Indexed | Failed
    public int Attempts { get; set; }
    public string? LastError { get; set; }
}
```

EF configuration (`AiCoach.Infrastructure/Database/Configurations/NoteEmbeddingEntityConfiguration.cs`,
derived from `BaseEntityTypedConfiguration<>` like the others):

```csharp
builder.ToTable("note_embeddings");
builder.HasIndex(x => x.HabitEntryId).IsUnique();
builder.HasIndex(x => new { x.UserId, x.Status });
builder.Property(x => x.Embedding).HasColumnType("vector(768)");
builder.Property(x => x.Status).HasMaxLength(20).HasConversion<string>();
builder.Property(x => x.Text).HasMaxLength(4000);
builder.Property(x => x.LastError).HasMaxLength(1000);
```

**Decision: no HNSW index yet.** Every search is filtered by `user_id`, and one user has at most a
few thousand notes. Postgres can use the `(user_id, status)` index and compute the exact
distance for those rows in milliseconds, and exact search never misses results.
An approximate HNSW index applies the user filter *after* the index scan, so it can return
too few rows unless you enable pgvector's iterative scans. Add one later only if
`EXPLAIN ANALYZE` shows search getting slow:

```csharp
// later, if needed:
builder.HasIndex(x => x.Embedding).HasMethod("hnsw").HasOperators("vector_cosine_ops");
// and per search query: SET hnsw.iterative_scan = relaxed_order;
```

Add `DbSet<NoteEmbeddingEntity> NoteEmbeddings` to `IAiCoachDbContext`/`AiCoachDbContext`
and create the migration `NoteEmbedding_Create`.

---

## Step 2.3: Handle the event (enqueue only)

`AiCoach.Application/EventHandlers/HabitEntryNoteChanged/HabitEntryNoteChangedIntegrationEventHandler.cs`,
shaped like `IdentityUserCreatedIntegrationEventHandler` in habit-user:

```csharp
public sealed class HabitEntryNoteChangedIntegrationEventHandler(IAiCoachDbContext db)
    : INotificationHandler<HabitEntryNoteChangedIntegrationEvent>
{
    public async ValueTask Handle(HabitEntryNoteChangedIntegrationEvent e, CancellationToken ct)
    {
        var existing = await db.NoteEmbeddings
            .FirstOrDefaultAsync(x => x.HabitEntryId == e.EntryId, ct);

        var text = NoteText.Normalize(e.Notes);          // trim, collapse whitespace, cap length

        if (text is null || e.IsArchived)
        {
            if (existing is not null) db.NoteEmbeddings.Remove(existing);
            await db.SaveChangesAsync(ct);
            return;
        }

        var hash = NoteText.Hash(text);
        if (existing is { } row && row.ContentHash == hash && row.OccurredAtUtc == e.CompletedAtUtc)
        {
            return;                                       // nothing changed, keep the vector
        }

        // upsert: set Text/ContentHash/OccurredAtUtc/HabitId, Status = Pending, Attempts = 0, Embedding = null
        ...
        await db.SaveChangesAsync(ct);
    }
}
```

Put `NoteText` (normalize + SHA-256 hash) in `AiCoach.Application`.

- **What to embed:** the note text. Optionally prefix it with the date
  (`"2026-09-20: felt tired, skipped stretching"`), which helps the model when the note is later
  shown as context.
- **Habit name:** don't add it here. The worker runs without a signed-in user, and the habit
  lookup is user-scoped. The chat tools add habit names when they return results.
- **`nomic-embed-text` prefixes:** this model is trained with task prefixes. Embed stored notes
  as `"search_document: " + text` and queries as `"search_query: " + text`. Put this in one
  helper so switching models later means changing one place. Other embedding models don't use
  prefixes.

Two small abstractions keep provider details out of the Application layer. Define them in
`AiCoach.Application/Ai/` and implement them in `AiCoach.Infrastructure/Ai/` from `AiOptions`:

```csharp
public interface IEmbeddingTextFormatter      // model-specific prefixes live here only
{
    string ForDocument(string text);          // nomic: "search_document: " + text
    string ForQuery(string text);             // nomic: "search_query: " + text
}

public interface IAiModelInfo
{
    string EmbeddingModel { get; }            // AiOptions.Embeddings.Model
    int EmbeddingDimensions { get; }          // AiOptions.Embeddings.Dimensions (768)
}
```

---

## Step 2.4: The indexing worker

`AiCoach.Infrastructure/Workers/NoteIndexingWorker.cs`. Copy the `PeriodicTimer` +
`IServiceScopeFactory` pattern from `StravaActivityWorker`, with a 10-second period, and have it
send an `IndexPendingNotesCommand` that you put in `AiCoach.Application`:

```csharp
public sealed class IndexPendingNotesCommandHandler(
    IAiCoachDbContext db,
    IEmbeddingGenerator<string, Embedding<float>> embedder,
    IEmbeddingTextFormatter formatter,          // adds "search_document: " etc.
    IAiModelInfo modelInfo,                     // exposes the configured embedding model name
    ILogger<IndexPendingNotesCommandHandler> logger
) : ICommandHandler<IndexPendingNotesCommand, Result>
{
    private const int BatchSize = 32;
    private const int MaxAttempts = 5;

    public async ValueTask<Result> Handle(IndexPendingNotesCommand request, CancellationToken ct)
    {
        var batch = await db.NoteEmbeddings
            .Where(x => x.Status == NoteEmbeddingStatus.Pending)
            .OrderBy(x => x.CreatedAtUtc)
            .Take(BatchSize)
            .ToListAsync(ct);

        if (batch.Count == 0) return Result.Success();

        try
        {
            var embeddings = await embedder.GenerateAsync(
                batch.Select(x => formatter.ForDocument(x.Text)),
                cancellationToken: ct);

            for (var i = 0; i < batch.Count; i++)
            {
                batch[i].Embedding = new Vector(embeddings[i].Vector);
                batch[i].EmbeddingModel = modelInfo.EmbeddingModel;
                batch[i].Status = NoteEmbeddingStatus.Indexed;
                batch[i].LastError = null;
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Embedding batch of {Count} failed", batch.Count);
            foreach (var row in batch)
            {
                row.Attempts++;
                row.LastError = ex.Message[..Math.Min(ex.Message.Length, 1000)];
                if (row.Attempts >= MaxAttempts) row.Status = NoteEmbeddingStatus.Failed;
            }
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```

Things to get right:
- **Check the vector length.** If `embeddings[i].Vector.Length != 768`, fail loudly with a
  clear message ("embedding model returned N dimensions, expected 768"). Otherwise the insert
  fails with a confusing Postgres error.
- **Several app instances:** if production ever runs more than one API instance, two workers
  could pick the same rows. Then claim rows with raw SQL `... FOR UPDATE SKIP LOCKED`. With a
  single instance (today's setup) it isn't needed.
- **Rate limits:** batching (32 texts per call) already keeps you far under free-tier request
  limits. If the provider returns `429`, the rows simply retry on the next tick.

---

## Step 2.5: Backfill the existing entries

Old entries never raised the new event. Add a command **inside the habit-entry module** that
re-publishes it for every entry with notes, page by page:

```csharp
// HabitEntry.Application/Features/RepublishEntryNotes/RepublishEntryNotesCommand.cs
// Pages through habit_entries WHERE notes IS NOT NULL (keyset pagination on id, 500 per page)
// and calls eventDispatcher.SendAsync(new HabitEntryNoteChangedIntegrationEvent(...)) for each.
```

**Why here and not in ai-coach?** Ai-coach would otherwise need a data-transfer method that
reads *all users'* entries without a user filter. The backfill is a habit-entry concern; ai-coach
only ever sees events.

Trigger it once, either from a development-only endpoint (`if (app.Environment.IsDevelopment())`)
or from a one-off startup flag (`Ai:BackfillOnStartup=true`). It's idempotent thanks to
`ContentHash`, so running it twice is harmless.

### Re-indexing when the embedding model changes

Vectors from different models **aren't comparable**. At worker startup, run:

```sql
UPDATE ai_coach.note_embeddings
SET status = 'Pending', attempts = 0, embedding = NULL
WHERE embedding_model IS DISTINCT FROM @configuredModel;
```

(through `ExecuteUpdateAsync`). Search should also filter on `embedding_model = configuredModel`
so it never mixes old and new vectors during the re-index.

---

## ✅ Verify

1. Create an entry with notes "legs sore after the long run". Within about 10 s:
   ```sql
   SELECT habit_entry_id, status, embedding_model, vector_dims(embedding)
   FROM ai_coach.note_embeddings ORDER BY created_at_utc DESC LIMIT 5;
   ```
   It should show `Indexed | nomic-embed-text | 768`.
2. Edit the note, and the row goes back to `Pending` and then `Indexed`. Edit only the value, not
   the note, and nothing happens (thanks to the hash check).
3. Clear the note, and the row disappears.
4. Stop Ollama, then create an entry. The row stays `Pending`, `attempts` goes up, and once
   Ollama is back the row becomes `Indexed`.
5. Run the backfill. Every existing entry with notes gets a row, and running it again changes
   nothing.

Commit: `feat(ai-coach): embed habit entry notes in the background`.

# Phase 3: semantic search

Goal: `GET /ai-coach/search?q=...` returns the user's entries whose notes are closest **in
meaning** to the query, and the UI gets a search box. The same query code is reused in phase 4
as the coach's `search_notes` tool, so build it as a reusable service, not inside the endpoint.

```
"when did I feel exhausted?" ──► embed (search_query: ...) ──► pgvector cosine distance
                                                     WHERE user_id = @me AND status = Indexed
                                                     ORDER BY distance LIMIT 10
                                  ──► hydrate habit names (Habit.DataTransfer) ──► results
```

---

## Step 3.1: A note search service

`AiCoach.Application/Search/INoteSearchService.cs`:

```csharp
public sealed record NoteSearchHit(
    Guid HabitEntryId,
    Guid HabitId,
    string? HabitName,
    DateTime OccurredAtUtc,
    string Text,
    double Similarity          // 1 - cosine distance, 0..1 (higher = closer)
);

public interface INoteSearchService
{
    Task<IReadOnlyList<NoteSearchHit>> SearchAsync(
        string query,
        int take,
        DateTime? fromUtc = null,
        DateTime? toUtc = null,
        CancellationToken ct = default);
}
```

The implementation (`AiCoach.Application/Search/NoteSearchService.cs`):

```csharp
public sealed class NoteSearchService(
    IAiCoachDbContext db,
    IEmbeddingGenerator<string, Embedding<float>> embedder,
    IEmbeddingTextFormatter formatter,
    IAiModelInfo modelInfo,
    ICurrentUserService currentUser,
    IHabitLookupService habits          // AiCoach's own interface, implemented in AiCoach.Integrations
) : INoteSearchService
{
    private const double MinSimilarity = 0.35;   // tune it, see 3.4

    public async Task<IReadOnlyList<NoteSearchHit>> SearchAsync(
        string query, int take, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct)
    {
        var queryVector = new Vector(
            await embedder.GenerateVectorAsync(formatter.ForQuery(query), cancellationToken: ct));

        var userId = currentUser.UserId;

        var rows = await db.NoteEmbeddings.AsNoTracking()
            .Where(x => x.UserId == userId
                        && x.Status == NoteEmbeddingStatus.Indexed
                        && x.EmbeddingModel == modelInfo.EmbeddingModel
                        && (fromUtc == null || x.OccurredAtUtc >= fromUtc)
                        && (toUtc == null || x.OccurredAtUtc < toUtc))
            .Select(x => new
            {
                x.HabitEntryId, x.HabitId, x.OccurredAtUtc, x.Text,
                Distance = x.Embedding!.CosineDistance(queryVector),
            })
            .OrderBy(x => x.Distance)
            .Take(Math.Clamp(take, 1, 25))
            .ToListAsync(ct);

        var names = await habits.GetNamesAsync(rows.Select(r => r.HabitId).Distinct(), ct);

        return rows
            .Select(r => new NoteSearchHit(
                r.HabitEntryId, r.HabitId, names.GetValueOrDefault(r.HabitId),
                r.OccurredAtUtc, r.Text, 1 - r.Distance))
            .Where(h => h.Similarity >= MinSimilarity)
            .ToList();
    }
}
```

**The user filter is the security boundary.** `UserId == currentUser.UserId` is applied in
code, never taken from the request or from the model. Keep it that way in every query in this
module.

### `IHabitLookupService`: reaching the habit module the approved way

Follow the existing cross-module pattern (see `HabitEntry.Integrations/Habits/Services/HabitService.cs`):

- `AiCoach.Application/IntegratedServices/IHabitLookupService.cs` is the interface ai-coach owns
  (`GetNamesAsync`, and in phase 4 also `GetHabitsAsync`).
- `AiCoach.Integrations/Habits/HabitLookupService.cs` implements it by calling
  `IHabitDataTransferService.GetByIdsAsync(...)`. That method is already filtered to the current
  user.
- Register it in `AiCoach.Integrations/Setup.cs`, and reference `Habit.DataTransfer` from
  `AiCoach.Integrations.csproj`.

---

## Step 3.2: Query + endpoint

`AiCoach.Application/Features/SearchNotes/SearchNotesQuery.cs`: a thin Mediator query that
validates `q` (1–200 characters, not whitespace) with FluentValidation and calls
`INoteSearchService`.

`AiCoach.Api/Endpoints/SearchNotes/SearchNotes.cs`, shaped like `GetIntegrationSyncLogs`:

```csharp
app.MapGet("/search", async (string q, int? take, ISender sender, CancellationToken ct) => ...)
   .Produces<SearchNotesResponse>()
   .RequireAuthorization()
   .RequireRateLimiting(AiRateLimits.Search)      // see phase 6; add now or later
   .WithName("SearchNotes");
```

Map it in a new `AiCoachGroup : IEndpointGroup` with prefix `/ai-coach`.

Response item: `{ habitEntryId, habitId, habitName, occurredAtUtc, text, similarity }`.

---

## Step 3.3: The search UI (Angular)

A small feature module `src/app/modules/ai-coach/` (the coach page from phase 4 goes here too):

```
modules/ai-coach/
  ai-coach.routes.ts            path: 'coach' (and later 'coach/:conversationId')
  api/ai-coach.api.ts           searchNotes(q, take) → GET /ai-coach/search
  models/note-search-hit.model.ts
  ui/note-search/               search input + results list
```

- Add `...aiCoachRoutes` to the `app` children in `main/app.routes.ts`, and a menu item
  ("Coach") in `core/layout/main-layout/main-menu/main-menu.ts`.
- Search box: debounce 400 ms, minimum 3 characters, `switchMap` to cancel stale requests.
- Each result shows the habit name, the date, the note text, and a link to the entry (the entries
  list filtered to that habit and date is enough).
- The similarity score isn't meaningful to users. Use it for ordering only, or show it only in
  development.
- Show an empty state that sets expectations: "Search looks at the **notes** on your entries.
  Entries without notes won't show up."

---

## Step 3.4: Tune the threshold with real data

`MinSimilarity` depends on the embedding model: the values that count as "similar" differ a lot
between models. Tune it once:

1. Seed about 30 realistic notes, e.g. copy a few weeks of your own.
2. Run 10 queries you care about, e.g. "tired", "injury", "rainy day", "skipped because of
   work", and log the top 10 with scores.
3. Pick a threshold just below the lowest score that is still clearly relevant.
4. Put the value in config (`Ai:Search:MinSimilarity`) rather than a constant, because it
   changes when the embedding model changes.

**Optional hybrid search:** semantic search is weak on exact tokens such as numbers, repo
names, or "5k". Postgres full-text search (`to_tsvector`) combined with the vector score gives
the best of both. Skip this unless you see real misses.

---

## ✅ Verify

1. `GET /ai-coach/search?q=exhausted` finds a note that says "completely drained after work",
   which a keyword search wouldn't.
2. Signed in as a **second user**, the same query returns none of the first user's notes. Test
   this explicitly; it's the most important check in this phase.
3. An empty or whitespace `q` returns 400, and `take=1000` is capped at 25.
4. With Ollama stopped, the endpoint returns a clean error ("Search is temporarily
   unavailable"), not a stack trace. Map the exception in the query handler to
   `Result.Failure`.

Commit: `feat(ai-coach): semantic search over entry notes`.

# Phase 3: the search endpoint

Goal: `GET /search?q=...` returns the user's habits, tags, and entry notes whose text is closest
**in meaning** to the query, and the UI gets a search box. The same query code is exposed as
`Search.DataTransfer` so `ai-coach`'s `search_notes` tool can reuse it — build it as a reusable
service, not inside the endpoint.

```
"when did I feel exhausted?" ──► embed (search_query: ...) ──► pgvector cosine distance
                                                     WHERE user_id = @me AND embedding_model = @model
                                                     AND entity_type IN (@requestedTypes)
                                                     ORDER BY distance LIMIT 10
                                  ──► hydrate habit names (Habit.DataTransfer) ──► results
```

---

## Step 3.1: A search service

`Search.Application/Search/ISearchService.cs`:

```csharp
public sealed record SearchHit(
    SearchEntityType EntityType,
    Guid EntityId,
    Guid? HabitId,
    string? HabitName,          // only set for EntryNote hits
    string DisplayText,         // habit name, tag name, or the note text itself
    DateTime? OccurredAtUtc,    // only set for EntryNote hits
    double Similarity           // 1 - cosine distance, 0..1 (higher = closer)
);

public interface ISearchService
{
    Task<IReadOnlyList<SearchHit>> SearchAsync(
        string query,
        IReadOnlySet<SearchEntityType>? types,   // null = search everything
        int take,
        DateTime? fromUtc = null,                // only constrains EntryNote hits
        DateTime? toUtc = null,
        CancellationToken ct = default);
}
```

The implementation (`Search.Application/Search/SearchService.cs`):

```csharp
public sealed class SearchService(
    ISearchDbContext db,
    IEmbeddingGenerator<string, Embedding<float>> embedder,
    IEmbeddingTextFormatter formatter,
    IAiModelInfo modelInfo,
    ICurrentUserService currentUser,
    IHabitLookupService habits          // Search's own interface, implemented in Search.Integrations
) : ISearchService
{
    private const double MinSimilarity = 0.35;   // tune it, see 3.4

    public async Task<IReadOnlyList<SearchHit>> SearchAsync(
        string query, IReadOnlySet<SearchEntityType>? types, int take,
        DateTime? fromUtc, DateTime? toUtc, CancellationToken ct)
    {
        var queryVector = new Vector(
            await embedder.GenerateVectorAsync(formatter.ForQuery(query), cancellationToken: ct));

        var userId = currentUser.UserId;

        var rows = await db.SearchIndex.AsNoTracking()
            .Where(x => x.UserId == userId
                        && x.EmbeddingModel == modelInfo.EmbeddingModel
                        && (types == null || types.Contains(x.EntityType))
                        && (fromUtc == null || x.OccurredAtUtc == null || x.OccurredAtUtc >= fromUtc)
                        && (toUtc == null || x.OccurredAtUtc == null || x.OccurredAtUtc < toUtc))
            .Select(x => new
            {
                x.EntityType, x.EntityId, x.HabitId, x.OccurredAtUtc, x.Text,
                Distance = x.Embedding.CosineDistance(queryVector),
            })
            .OrderBy(x => x.Distance)
            .Take(Math.Clamp(take, 1, 25))
            .ToListAsync(ct);

        var habitIds = rows.Where(r => r.HabitId is not null).Select(r => r.HabitId!.Value).Distinct();
        var names = await habits.GetNamesAsync(habitIds, ct);

        return rows
            .Select(r => new SearchHit(
                r.EntityType, r.EntityId, r.HabitId,
                r.HabitId is { } id ? names.GetValueOrDefault(id) : null,
                r.Text, r.OccurredAtUtc, 1 - r.Distance))
            .Where(h => h.Similarity >= MinSimilarity)
            .ToList();
    }
}
```

**Why the `Where` runs before the distance computation, not after.** This is a `WHERE` clause
with an `ORDER BY` on a computed expression — Postgres evaluates the filters first (cheap,
indexed lookups on `user_id`/`entity_type`), narrowing to a small set of rows, and only
computes `CosineDistance` — the expensive part, one floating-point comparison per vector
dimension — for *those* rows. If the filter ran after the distance computation, the database
would compute cosine distance for every row belonging to every user before throwing most of the
results away. At a few thousand rows per user this barely matters, but the ordering is also
what makes the user filter a correctness guarantee rather than a performance nicety: there is no
path through this query where a row belonging to another user's data is even looked at.

**The user filter is the security boundary.** `UserId == currentUser.UserId` is applied in
code, never taken from the request or from the model. Keep it that way in every query in this
module.

### `IHabitLookupService`: reaching the habit module the approved way

Follow the existing cross-module pattern (see `HabitEntry.Integrations/Habits/Services/HabitService.cs`):

- `Search.Application/IntegratedServices/IHabitLookupService.cs` is the interface `search` owns
  (`GetNamesAsync`).
- `Search.Integrations/Habits/HabitLookupService.cs` implements it by calling
  `IHabitDataTransferService.GetByIdsAsync(...)`. That method is already filtered to the current
  user.
- Register it in `Search.Integrations/Setup.cs`, and reference `Habit.DataTransfer` from
  `Search.Integrations.csproj`.

Habit and tag hits don't need hydration at all — their `DisplayText` is already the indexed
name, no cross-module call required.

---

## Step 3.2: Query + endpoint

`Search.Application/Features/Search/SearchQuery.cs`: a thin Mediator query that validates `q`
(1–200 characters, not whitespace) with FluentValidation and calls `ISearchService`.

`Search.Api/Endpoints/Search/Search.cs`, shaped like `GetIntegrationSyncLogs`:

```csharp
app.MapGet("/search", async (string q, string? types, int? take, ISender sender, CancellationToken ct) => ...)
   .Produces<SearchResponse>()
   .RequireAuthorization()
   .RequireRateLimiting(AiRateLimits.Search)      // see ai-coach phase 4 for rate limit setup
   .WithName("Search");
```

`types` is an optional comma-separated list (`habit,tag,entry_note`); omit it to search
everything. Map it in a new `SearchGroup : IEndpointGroup` with prefix `/search`.

Response item: `{ entityType, entityId, habitId, habitName, displayText, occurredAtUtc, similarity }`.

### `Search.DataTransfer`: exposing this to `ai-coach`

Mirror `Habit.DataTransfer`: a thin project wrapping `ISearchService` behind an interface scoped
to the current user, for other modules to call:

```csharp
public interface ISearchDataTransferService
{
    Task<IReadOnlyList<SearchHit>> SearchAsync(
        string query, IReadOnlySet<SearchEntityType>? types, int take,
        DateTime? fromUtc, DateTime? toUtc, CancellationToken ct);
}
```

This is the **only** way `ai-coach`'s `search_notes` tool reaches this module's data — it never
queries `search.search_index` directly, the same isolation rule every other cross-module access
in this codebase follows.

---

## Step 3.3: The search UI (Angular)

A small feature module `src/app/modules/search/`:

```
modules/search/
  search.routes.ts              path: 'search'
  api/search.api.ts              search(q, types?, take?) → GET /search
  models/search-hit.model.ts
  ui/search-box/                 search input + grouped results list
```

- Add `...searchRoutes` to the `app` children in `main/app.routes.ts`, and a menu item
  ("Search") in `core/layout/main-layout/main-menu/main-menu.ts`.
- Search box: debounce 400 ms, minimum 3 characters, `switchMap` to cancel stale requests.
- Group results by `entityType` (Habits, Tags, Notes) with a small heading per group, in that
  order — habits and tags are usually what the user is looking for when they type a short query,
  notes dominate for longer, descriptive queries.
- Each result links appropriately: a habit result → the habit's detail page, a tag result → the
  habits filtered by that tag, a note result → the entries list filtered to that habit and date.
- The similarity score isn't meaningful to users. Use it for ordering only, or show it only in
  development.
- Show an empty state that sets expectations: "Search looks across your **habits, tags, and
  entry notes**."

---

## Step 3.4: Tune the threshold with real data

**Why a threshold is needed at all.** Cosine similarity always returns *some* number for any two
pieces of text — even "banana" and "quantum physics" get a similarity score, just a low one.
Without a cutoff, a query with no genuinely relevant results still returns its "closest" 10 rows,
which looks to the user like 10 wrong answers instead of an honest "nothing found." `MinSimilarity`
is that cutoff, and it's an empirical constant, not something derivable from the model's
documentation — it depends on exactly how *this* embedding model spreads unrelated text across
the similarity range, which varies model to model.

`MinSimilarity` depends on the embedding model: the values that count as "similar" differ a lot
between models, and may differ between short text (habit/tag names) and long text (notes). Tune
it once:

1. Seed about 30 realistic habits, tags, and notes — copy a few weeks of your own data.
2. Run 10 queries you care about across all three types, e.g. "running", "tired", "injury",
   "rainy day", and log the top 10 with scores.
3. Pick a threshold just below the lowest score that is still clearly relevant. If short-text
   results (habits/tags) consistently need a different threshold than notes, split
   `MinSimilarity` by `EntityType` rather than forcing one number to fit both.
4. Put the value(s) in config (`Ai:Search:MinSimilarity`) rather than a constant, because they
   change when the embedding model changes.

**Optional hybrid search, and why trigram is the natural complement.** Semantic search is weak
on exact tokens such as numbers, repo names, or short exact habit/tag names, because the
embedding model is optimized for *meaning*, not *spelling* — "5k" and "5000m" are semantically
close but character-wise unrelated, while a typo'd habit name ("Runing") stays character-wise
close but can drift in embedding space. Postgres trigram similarity (`pg_trgm`) works the
opposite way: it breaks text into overlapping 3-character chunks and compares those, so it's
strong exactly where embeddings are weak (typos, exact substrings) and weaker where embeddings
shine (synonyms, paraphrases). Combining both scores covers more cases than either alone,
especially for `Habit`/`Tag` rows. Skip this unless you see real misses once the search box is
in daily use — see the README's decision on this.

---

## ✅ Verify

1. `GET /search?q=exhausted` finds a note that says "completely drained after work", which a
   keyword search wouldn't.
2. `GET /search?q=running&types=habit,tag` only returns habit/tag matches, never notes.
3. Signed in as a **second user**, the same query returns none of the first user's data. Test
   this explicitly; it's the most important check in this phase.
4. An empty or whitespace `q` returns 400, and `take=1000` is capped at 25.
5. With Ollama stopped, the endpoint returns a clean error ("Search is temporarily
   unavailable"), not a stack trace. Map the exception in the query handler to `Result.Failure`.

Commit: `feat(search): unified search endpoint over habits, tags, and entry notes`.

# Phase 3: the search endpoint

Goal: `GET /search?q=...` returns the user's habits, tags, and entry notes that match the query
**by text** — including partial words (`runn`, `morn`) and typos (`Runing`) — **or by meaning**
(`exhausted` → "completely drained after work"), and the UI gets a search box. The same query
code is exposed as `Search.DataTransfer` so `ai-coach`'s `search_notes` tool can reuse it — build
it as a reusable service, not inside the endpoint.

```
                       ┌─► text leg:     WHERE user_id = @me AND entity_type IN (@types)
                       │                 AND (text ILIKE '%q%' OR word_similarity(q, text) >= @minWord)
                       │                 ORDER BY match score DESC LIMIT 20
"runing" / "exhausted" ┤
                       │   (skipped if q < 3 chars or embedding fails)
                       └─► semantic leg: embed (search_query: ...) ──► cosine distance
                                         WHERE user_id = @me AND embedding_model = @model
                                         AND entity_type IN (@types)
                                         ORDER BY distance LIMIT 20, drop < @minSimilarity
                                │
                     RRF merge by (entity_type, entity_id) ──► top `take`
                                │
                     hydrate habit names (Habit.DataTransfer) ──► results
```

**Why two queries instead of one SQL statement.** The semantic leg needs an embedding first (an
HTTP call to the model), and it can fail or be skipped independently; the text leg can't. Two
small, separately-limited queries over one user's rows are cheap, keep each leg's filter and
threshold readable, and make "text-only fallback" a matter of not running the second one.

---

## Step 3.1: A search service

`Search.Application/Search/ISearchService.cs`:

```csharp
[Flags]
public enum SearchMatch
{
    Text = 1,                   // matched as a substring or fuzzily (pg_trgm)
    Semantic = 2,               // matched by meaning (embedding)
}

public sealed record SearchHit(
    SearchEntityType EntityType,
    Guid EntityId,
    Guid? HabitId,
    string? HabitName,          // only set for EntryNote hits
    string DisplayText,         // habit name, tag name, or the note text itself
    DateTime? OccurredAtUtc,    // only set for EntryNote hits
    SearchMatch Match,          // which leg(s) found it — Text, Semantic, or both
    double Score                // fused RRF score; only meaningful for ordering
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
    IHabitLookupService habits,         // Search's own interface, implemented in Search.Integrations
    ILogger<SearchService> logger
) : ISearchService
{
    private const double MinSimilarity = 0.35;       // semantic leg cutoff — tune it, see 3.4
    private const double MinWordSimilarity = 0.3;    // text leg cutoff — tune it, see 3.4
    private const int MinSemanticQueryLength = 3;    // shorter queries are text-only
    private const int PerLegLimit = 20;              // candidates per leg before fusion
    private const int RrfK = 60;                     // standard RRF constant

    private sealed record Candidate(
        SearchEntityType EntityType, Guid EntityId, Guid? HabitId,
        DateTime? OccurredAtUtc, string Text);

    public async Task<IReadOnlyList<SearchHit>> SearchAsync(
        string query, IReadOnlySet<SearchEntityType>? types, int take,
        DateTime? fromUtc, DateTime? toUtc, CancellationToken ct)
    {
        query = query.Trim();
        take = Math.Clamp(take, 1, 25);

        var userId = currentUser.UserId;
        var scoped = db.SearchIndex.AsNoTracking()
            .Where(x => x.UserId == userId
                        && (types == null || types.Contains(x.EntityType))
                        && (fromUtc == null || x.OccurredAtUtc == null || x.OccurredAtUtc >= fromUtc)
                        && (toUtc == null || x.OccurredAtUtc == null || x.OccurredAtUtc < toUtc));

        var textHits = await TextLegAsync(scoped, query, ct);
        var semanticHits = await SemanticLegAsync(scoped, query, ct);

        var fused = Fuse(textHits, semanticHits).Take(take).ToList();

        var habitIds = fused.Where(f => f.Row.HabitId is not null).Select(f => f.Row.HabitId!.Value).Distinct();
        var names = await habits.GetNamesAsync(habitIds, ct);

        return fused
            .Select(f => new SearchHit(
                f.Row.EntityType, f.Row.EntityId, f.Row.HabitId,
                f.Row.HabitId is { } id ? names.GetValueOrDefault(id) : null,
                f.Row.Text, f.Row.OccurredAtUtc, f.Match, f.Score))
            .ToList();
    }

    // Partial words and typos. Model-independent: no embedding_model filter, so it keeps
    // finding every row even mid re-embedding (phase 2) or with the embedding provider down.
    private static async Task<List<Candidate>> TextLegAsync(
        IQueryable<SearchIndexEntryEntity> scoped, string query, CancellationToken ct)
    {
        var pattern = $"%{EscapeLike(query)}%";

        return await scoped
            .Where(x => EF.Functions.ILike(x.Text, pattern, @"\")
                        || EF.Functions.TrigramsWordSimilarity(query, x.Text) >= MinWordSimilarity)
            // exact substring matches first, then the closest fuzzy ones
            .OrderByDescending(x => EF.Functions.ILike(x.Text, pattern, @"\"))
            .ThenByDescending(x => EF.Functions.TrigramsWordSimilarity(query, x.Text))
            .Take(PerLegLimit)
            .Select(x => new Candidate(x.EntityType, x.EntityId, x.HabitId, x.OccurredAtUtc, x.Text))
            .ToListAsync(ct);
    }

    // Meaning. Skipped for very short queries; degrades to "no semantic hits" if the
    // embedding provider fails, so the search still answers with text matches.
    private async Task<List<Candidate>> SemanticLegAsync(
        IQueryable<SearchIndexEntryEntity> scoped, string query, CancellationToken ct)
    {
        if (query.Length < MinSemanticQueryLength)
            return [];

        Vector queryVector;
        try
        {
            queryVector = new Vector(
                await embedder.GenerateVectorAsync(formatter.ForQuery(query), cancellationToken: ct));
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Query embedding failed; returning text matches only");
            return [];
        }

        var rows = await scoped
            .Where(x => x.EmbeddingModel == modelInfo.EmbeddingModel)
            .Select(x => new
            {
                Row = new Candidate(x.EntityType, x.EntityId, x.HabitId, x.OccurredAtUtc, x.Text),
                Distance = x.Embedding.CosineDistance(queryVector),
            })
            .OrderBy(x => x.Distance)
            .Take(PerLegLimit)
            .ToListAsync(ct);

        return rows.Where(r => 1 - r.Distance >= MinSimilarity).Select(r => r.Row).ToList();
    }

    // Reciprocal rank fusion: only list positions matter, never the raw scores.
    private static IEnumerable<(Candidate Row, SearchMatch Match, double Score)> Fuse(
        List<Candidate> textHits, List<Candidate> semanticHits) =>
        textHits.Select((row, rank) => (row, match: SearchMatch.Text, rank))
            .Concat(semanticHits.Select((row, rank) => (row, match: SearchMatch.Semantic, rank)))
            .GroupBy(x => (x.row.EntityType, x.row.EntityId))
            .Select(g => (
                Row: g.First().row,
                Match: g.Aggregate((SearchMatch)0, (m, x) => m | x.match),
                Score: g.Sum(x => 1.0 / (RrfK + x.rank + 1))))
            .OrderByDescending(x => x.Score);

    private static string EscapeLike(string s) =>
        s.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_");
}
```

**How the text leg handles each kind of input:**

| Typed | Matches | Because |
|---|---|---|
| `run`, `runn`, `morn` | "Morning run" | `ILIKE '%runn%'` — plain substring, case-insensitive |
| `Runing`, `mornin run` | "Morning run" | `word_similarity` — most trigrams shared with a part of the text |
| `ru` | "Morning run", "Running club" | substring only; trigram similarity is unreliable this short, and the semantic leg is skipped |
| `exhausted` | nothing in this leg | no shared characters with "completely drained" — the semantic leg finds it |

**Why `word_similarity`, not `similarity`.** `similarity(a, b)` compares the *whole* strings, so
`runing` against a 200-character note scores near zero even if "running" is in it.
`word_similarity(query, text)` scores the query against its best-matching *extent* of the text,
which is what a search box wants. The Npgsql EF Core provider translates
`EF.Functions.TrigramsWordSimilarity(query, text)` to it directly — no plugin needed.

**Why escape `%` and `_`.** They're `LIKE` wildcards. Without escaping, a user typing `100%`
gets a pattern that matches far more than they meant. It's not a security issue (the pattern is
a parameter, not concatenated SQL), just a correctness one.

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

Response item: `{ entityType, entityId, habitId, habitName, displayText, occurredAtUtc, match, score }`,
where `match` is `["text"]`, `["semantic"]`, or both.

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
- Search box: debounce 250 ms, minimum **2** characters, `switchMap` to cancel stale requests.
  Partial matching makes search-as-you-type useful, so the box should start answering early;
  2-character queries are cheap because they're text-only (no embedding call).
- Highlight the typed substring in `displayText` when `match` includes `text` — it shows the user
  *why* a result appeared. Semantic-only hits have nothing to highlight, which is fine.
- Group results by `entityType` (Habits, Tags, Notes) with a small heading per group, in that
  order — habits and tags are usually what the user is looking for when they type a short query,
  notes dominate for longer, descriptive queries.
- Each result links appropriately: a habit result → the habit's detail page, a tag result → the
  habits filtered by that tag, a note result → the entries list filtered to that habit and date.
- The score isn't meaningful to users. Use it for ordering only, or show it (with `match`) only in
  development.
- Show an empty state that sets expectations: "Search looks across your **habits, tags, and
  entry notes**."

---

## Step 3.4: Tune the thresholds with real data

There are two cutoffs, one per leg: `MinSimilarity` (cosine, semantic leg) and
`MinWordSimilarity` (trigram, text leg). Fusion has no threshold of its own — RRF only reorders
what the legs let through.

### `MinSimilarity` (semantic leg)

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

### `MinWordSimilarity` (text leg)

Substring matches (`ILIKE`) always pass; this cutoff only decides which *fuzzy* matches count.
Unlike `MinSimilarity` it doesn't depend on the embedding model — it's a property of trigram
math — so it needs tuning once, not after every model change.

1. With the same seed data, type deliberate typos and fragments of your habit and tag names
   (`runing`, `meditaton`, `strech`, `jurnal`) and log `word_similarity(q, text)` for the top
   rows.
2. `0.3` is a reasonable start; Postgres's own default for the `<%` operator (`0.6`) is too
   strict for a search box and misses one-letter typos in short words. Raise it if unrelated
   rows with a few shared letters creep in; lower it if obvious typos miss.
3. Put it in config too (`Ai:Search:MinWordSimilarity`), next to `MinSimilarity`.

**Why both legs, not just one.** Semantic search is weak on exact tokens such as numbers, short
exact habit/tag names, and partial words, because the embedding model is optimized for
*meaning*, not *spelling* — "5k" and "5000m" are semantically close but character-wise
unrelated, while a typo'd habit name ("Runing") or a fragment ("morn") stays character-wise
close but drifts in embedding space. Trigrams work the opposite way: strong exactly where
embeddings are weak (typos, substrings) and blind where embeddings shine (synonyms,
paraphrases). Running both and fusing by rank covers more than either alone — see the README's
decision on this.

---

## ✅ Verify

1. `GET /search?q=exhausted` finds a note that says "completely drained after work", which a
   keyword search wouldn't (`match: ["semantic"]`).
2. With a habit named "Morning run": `q=runn`, `q=morn`, and `q=Runing` all return it
   (`match` includes `text`). `q=ru` returns it too, and the logs show no embedding call.
3. `q=100%` doesn't match every row — the `%` is escaped.
4. A row found by both legs (e.g. `q=running` against a "Running club" tag) ranks above rows
   found by only one, and shows `match: ["text", "semantic"]`.
5. `GET /search?q=running&types=habit,tag` only returns habit/tag matches, never notes.
6. Signed in as a **second user**, the same queries return none of the first user's data. Test
   this explicitly for **both** legs; it's the most important check in this phase.
7. An empty or whitespace `q` returns 400, and `take=1000` is capped at 25.
8. With Ollama stopped, `q=runn` still returns "Morning run" (text-only), a warning is logged,
   and nothing returns a stack trace. Only a database failure should surface as an error — map
   that in the query handler to `Result.Failure` ("Search is temporarily unavailable").

Commit: `feat(search): hybrid search endpoint over habits, tags, and entry notes`.

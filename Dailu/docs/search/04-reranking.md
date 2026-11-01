# Phase 4: reranking search results

Goal: `GET /search` (and `ai-coach`'s `search_notes` tool, which calls through the same
`ISearchService`) returns **better-ordered** results by reranking the vector search's candidates
with a chat model, instead of adding a new model or container. Building this in `search` means
both consumers get it for free, instead of each reimplementing it.

This phase is optional hardening. Do it after the search module and the coach are both working
end to end, and you've actually seen the fused ranking put a less-relevant result above a more
relevant one.

**Why vector search ranking is approximate in the first place.** Embedding a query and embedding
a candidate happen *independently* — the model never sees the two side by side, it just
compresses each piece of text into one 768-number summary on its own, and cosine distance is a
single-number proxy for "how related are these two summaries." That's fast (one float
comparison per stored row) but necessarily lossy: two candidates that are both "sort of about
running" can end up at nearly identical distances even though a human reading both would clearly
rank one as more relevant to the specific query. A reranker fixes this by looking at the query
*and* a candidate *together* in one pass — a cross-encoder model is trained specifically to score
a `(query, candidate)` pair jointly, and an LLM prompted to compare a short list does roughly the
same thing informally. That joint view is why reranking improves ordering, and also why it's
too slow to run over every row — it only makes sense on a short, already-filtered shortlist,
which is the whole reason for the over-fetch pattern below.

```
query ──► text leg + semantic leg (phase 3) ──► RRF merge, OVER-FETCH (e.g. top 20) ──► IReranker ──► top 5
                                                                                        │
                                                                         IChatClient (this module's own)
                                                                         reorders by relevance, not rank
```

**This phase needs its own `IChatClient`.** `search`'s `AiSetup.cs` (phase 1) only registered
an embedding generator so far — add a chat client registration there now, the same shape
`ai-coach`'s own `AiSetup.cs` uses (they're separate, duplicated classes, see phase 1's
decision):

```csharp
// add to Search.Infrastructure/Ai/AiSetup.cs, inside AddAiClients()
services
    .AddChatClient(sp =>
    {
        var o = sp.GetRequiredService<AiOptions>().Chat;
        return o.Provider switch
        {
            AiProviders.Ollama => new OllamaApiClient(new Uri(o.Endpoint), o.Model),
            AiProviders.OpenAiCompatible => CreateOpenAi(o.Endpoint, o.ApiKey).GetChatClient(o.Model).AsIChatClient(),
            _ => throw new InvalidOperationException($"Unknown AI provider '{o.Provider}'."),
        };
    })
    .UseOpenTelemetry()
    .UseLogging();
```

Pull the chat model (`ollama pull qwen3:8b`) if you're building `search` before `ai-coach` and
don't have it yet — both modules end up needing the same model pulled once in Ollama, they just
each hold their own `IChatClient` registration pointed at it.

---

## Step 4.1: LLM reranking, not a dedicated cross-encoder

**Decision: rerank with the existing chat model, not a new cross-encoder model.** A dedicated
reranker (e.g. `bge-reranker-v2-m3`) is more accurate and cheaper per call, but it needs a new
model pulled, a new client, and — since Ollama doesn't serve classic cross-encoder rerankers the
way it serves chat/embedding models — likely a separate sidecar container. That's real
infrastructure for a benefit you haven't confirmed you need yet.

Start with the chat model you already have. If reranking quality or latency isn't good enough
once you've measured it (Step 4.6), that's the point to evaluate a dedicated reranker — not
before.

---

## Step 4.2: The `IReranker` abstraction

`Search.Application/Search/IReranker.cs`:

```csharp
public interface IReranker
{
    // Returns indices into `candidates`, most relevant first, length <= take.
    // Implementations must be defensive: never throw, never return an out-of-range
    // or duplicate index. On any doubt, fall back to the original order.
    Task<IReadOnlyList<int>> RankAsync(
        string query, IReadOnlyList<string> candidates, int take, CancellationToken ct);
}
```

A `NullReranker` returns `Enumerable.Range(0, Math.Min(take, candidates.Count))` unchanged —
register this when `Ai:Search:RerankEnabled` is `false`. It keeps behavior identical to phase 3
when reranking is off, and it's what integration tests should use so they don't depend on a live
model.

---

## Step 4.3: `LlmReranker`

`Search.Infrastructure/Ai/LlmReranker.cs`:

```csharp
public sealed class LlmReranker(IChatClient chat, ILogger<LlmReranker> logger) : IReranker
{
    public async Task<IReadOnlyList<int>> RankAsync(
        string query, IReadOnlyList<string> candidates, int take, CancellationToken ct)
    {
        if (candidates.Count <= take)
            return Enumerable.Range(0, candidates.Count).ToList();

        var prompt = BuildPrompt(query, candidates);

        try
        {
            var response = await chat.GetResponseAsync(
                prompt,
                new ChatOptions { Temperature = 0f, MaxOutputTokens = 200 },
                ct);

            if (TryParseIndices(response.Text, candidates.Count, take, out var ranked))
                return ranked;

            logger.LogWarning("Reranker returned unusable output: {Text}", response.Text);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Reranker call failed");
        }

        // Fall back to vector order. A bad rerank must never turn into a failed search.
        return Enumerable.Range(0, Math.Min(take, candidates.Count)).ToList();
    }

    private static string BuildPrompt(string query, IReadOnlyList<string> candidates)
    {
        var items = string.Join("\n", candidates.Select((c, i) => $"[{i}] {c}"));
        return $"""
            Query: "{query}"

            Rank the items below by relevance to the query, most relevant first.
            Items:
            {items}

            Reply with ONLY a JSON array of indices in ranked order, e.g. [2,0,4,1,3].
            No other text, no explanation.
            """;
    }

    private static bool TryParseIndices(
        string? text, int candidateCount, int take, out IReadOnlyList<int> ranked)
    {
        ranked = [];
        if (string.IsNullOrWhiteSpace(text)) return false;

        try
        {
            var json = ExtractJsonArray(text);   // small models sometimes wrap it in prose anyway
            var indices = JsonSerializer.Deserialize<int[]>(json);
            if (indices is null) return false;

            var valid = indices
                .Where(i => i >= 0 && i < candidateCount)
                .Distinct()
                .Take(take)
                .ToList();

            if (valid.Count == 0) return false;

            ranked = valid;
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
```

**Rules that matter here:**
- **Temperature 0.** Reranking should be as deterministic as the model allows; you don't want the
  result order to change between identical searches.
- **Validate every index.** Small local models occasionally invent an index, repeat one, or wrap
  the array in a sentence. Never trust the output structurally — parse defensively and fall back.
- **A reranker failure must degrade to phase 3's behavior, not fail the search.** Searching is a
  read path both the search box and the coach rely on; it should never 500 because reranking had
  a bad day.

`ExtractJsonArray` just finds the first `[` and last `]` in the text and slices between them —
keep it a few lines, not a general parser.

---

## Step 4.4: Wire it into `SearchService`

Rerank the **fused** list, not either leg on its own — otherwise the reranker never sees the
partial/typo matches that only the text leg found. Both legs already applied their thresholds
(`MinSimilarity`, `MinWordSimilarity`, phase 3 step 3.4), so you never spend a reranker call on
results that are already too far off. Only the fused list is over-fetched:

```csharp
var overFetch = Math.Clamp(take * 4, take, 40);

var textHits = await TextLegAsync(scoped, query, ct);         // phase 3, unchanged
var semanticHits = await SemanticLegAsync(scoped, query, ct); // phase 3, unchanged

var candidates = Fuse(textHits, semanticHits).Take(overFetch).ToList();

var order = rerankEnabled && query.Length >= MinSemanticQueryLength
    ? await reranker.RankAsync(query, candidates.Select(c => c.Row.Text).ToList(), take, ct)
    : Enumerable.Range(0, Math.Min(take, candidates.Count));

return order.Select(i => ToHit(candidates[i], names)).ToList();
```

`PerLegLimit` (phase 3) must be at least `overFetch` for this to have enough candidates — raise
it to 40 alongside this change. Skip reranking for very short queries for the same reason the
semantic leg skips them: a 1–2 character query gives the model nothing to judge relevance on,
and substring order is already the right answer there.

`rerankEnabled` comes from `Ai:Search:RerankEnabled` (config, default `true`) so you can A/B it
or turn it off instantly without a deploy if it misbehaves in production. Because both the
`/search` endpoint and `ai-coach`'s `search_notes` tool call the same `SearchService`, this one
flag controls reranking for both consumers at once.

---

## Step 4.5: Keep reranking cheap

- **Cap `overFetch` (≤ 40).** Every candidate's text goes into the rerank prompt; a long prompt
  on a small local model is slow and eats context.
- **Consider a separate, smaller model for reranking.** Ranking a short list is an easier task
  than open-ended generation — `Ai:Rerank:Model` as its own config entry (e.g. `qwen3:4b`) lets
  you use a cheaper model for this call without touching the coach's main chat model.
- **It competes for the same Ollama instance** as coach chat. Under real load, watch whether
  reranking calls queue behind chat calls; that's a sign to give reranking its own smaller model
  or to revisit the dedicated cross-encoder option from Step 4.1.

---

## ✅ Verify

1. Seed 15+ items (mix of habits, tags, and notes) with some near-duplicates in meaning. Run a
   query where you know, by reading the data yourself, which one is *most* relevant — confirm
   it's now top instead of wherever cosine distance happened to put it.
2. Temporarily make `BuildPrompt` ask for garbage output (e.g. append "Reply in Klingon") and
   confirm search still returns results in vector order instead of failing.
3. Set `Ai:Search:RerankEnabled: false` and confirm results match phase 3 exactly — this is your
   regression check that reranking is additive, not a rewrite.
4. Measure p95 search latency with reranking on vs off and record the delta; decide if it's
   acceptable for `search_notes` being called mid-conversation in the coach.
5. Confirm both `GET /search` and the coach's `search_notes` tool reflect the same
   `RerankEnabled` setting without either needing its own flag.

Commit: `feat(search): LLM-based reranking for search results`.

# Phase 6: production (free or low-cost provider, limits, privacy)

Goal: run the coach for real users on a **free or low-cost hosted model** whose terms allow
production use, without surprise bills, abuse, or leaking user data.

---

## Step 6.1: Choose the production providers

Chat and embeddings are configured separately (`Ai:Chat`, `Ai:Embeddings`), so they can come
from **different** providers.

### Requirements checklist

| Requirement | Why |
|---|---|
| **Terms allow production use** | NVIDIA's build.nvidia.com free endpoints, for example, allow only development and evaluation |
| **OpenAI-compatible** chat endpoint | Works with the `openai-compatible` provider from phase 1 with no code changes |
| **Reliable tool calling** on the chosen model | The coach depends on it. Test with the phase 4 evaluation questions before committing |
| Embeddings can output **768** values | Matches the `vector(768)` column. Otherwise, change the column and re-index |
| **Data-use policy** you can accept | Some free tiers may use prompts to improve their models. Your users' habit notes would be in those prompts |
| Rate limits that fit your traffic | Free tiers often allow a few requests per minute. One coach answer uses 2–5 model calls because of tool calls |

### Options to evaluate

Check the current terms, limits and prices yourself before choosing; free tiers change often.

- **Google Gemini API**: has a free tier and an OpenAI-compatible endpoint. Its embedding model can
  output a reduced dimensionality such as 768. Check how free-tier data is used.
- **OpenRouter**: one OpenAI-compatible API in front of many models, including some free
  ones. Good for trying several models with one key.
- **Groq, Together, DeepInfra, Mistral and similar**: OpenAI-compatible, with cheap open models
  (Llama, Qwen, Mistral).
- **Self-hosted Ollama on your server**: free and production-allowed, and data never leaves your
  server. On CPU only, chat models are slow (several seconds to minutes per answer), so this is
  realistic only with a GPU.

### Recommended setup for Dailu

- **Embeddings: self-host `nomic-embed-text` with Ollama in production too.** Embedding models
  are small and run fine on CPU. Vectors stay identical between dev and prod, you never
  re-index, and no user notes leave your server for indexing.
- **Chat: a hosted OpenAI-compatible provider**, where a GPU matters. Pick the one that passes
  your evaluation questions at the lowest cost, and switch whenever something better or cheaper
  appears. It's just config.

`docker-compose.yml` (sketch):

```yaml
  dailo.ollama:
    image: ollama/ollama:latest            # pin a version
    volumes:
      - dailo_ollama_data:/root/.ollama
    # no public port. Only the API container talks to it on the compose network

  dailo.api:
    environment:
      Ai__Embeddings__Provider: ollama
      Ai__Embeddings__Endpoint: http://dailo.ollama:11434
      Ai__Embeddings__Model: nomic-embed-text
      Ai__Chat__Provider: openai-compatible
      Ai__Chat__Endpoint: https://<provider>/v1       # provider's OpenAI-compatible base URL
      Ai__Chat__Model: <model-id>
      Ai__Chat__ApiKey: ${AI_CHAT_API_KEY}            # from Dokploy secrets, never committed
```

Pull the embedding model once after the first deploy
(`docker exec <ollama-container> ollama pull nomic-embed-text`), or add a small init step that
does it.

If you use a hosted embedding model instead: set `Dimensions: 768` and make sure the adapter
sends it. `EmbeddingGenerationOptions.Dimensions` maps to the OpenAI `dimensions` parameter.
Test that the returned vectors really have 768 values.

---

## Step 6.2: Per-user rate limits

Free-tier limits are shared across all users, so one heavy user can exhaust them for everyone.
Add ASP.NET Core rate limiting, partitioned by user, in `Dailu.Api`:

```csharp
public static class AiRateLimits
{
    public const string Chat = "ai-chat";
    public const string Search = "ai-search";
}

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    o.AddPolicy(AiRateLimits.Chat, ctx => RateLimitPartition.GetSlidingWindowLimiter(
        ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous",
        _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 30, Window = TimeSpan.FromHours(1), SegmentsPerWindow = 6, QueueLimit = 0,
        }));

    o.AddPolicy(AiRateLimits.Search, ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1) }));
});

app.UseRateLimiter();   // after UseAuthentication/UseAuthorization so ctx.User is populated
```

Check which claim holds the user id in Dailu's JWT (look at how `ICurrentUserService` reads it)
and use the same one. In the UI, show a `429` as "You've reached the coach limit for now. Try
again in a bit."

**Optional token budget:** streaming updates include usage information (`UsageContent`) at the
end. Store input and output tokens on each assistant message and refuse new turns once a user
passes a daily budget. It's the only hard protection against a paid bill.

---

## Step 6.3: Resilience to provider errors

- **429 and 5xx from the provider:** the OpenAI SDK used by `Microsoft.Extensions.AI.OpenAI`
  already retries transient errors with backoff. Don't add a second retry layer on top, or
  retries multiply.
- **Timeouts:** set a request timeout (e.g. 60 s) on the chat client. When it's hit, the stream's
  `error` event gives the user a retry button (phase 4).
- **Optional fallback provider:** `Microsoft.Extensions.AI` includes an experimental failover
  chat client that tries a second client when the first fails before producing output. Keep a
  second free provider configured as a backup if you want resilience at zero cost.
- **Reverse proxy:** make sure the proxy doesn't buffer or time out the SSE route. Allow long
  read timeouts (answers can take 30+ seconds with several tool calls) and disable buffering.

---

## Step 6.4: Privacy and user trust

The coach sends parts of the user's habit data and notes to a third-party model provider.

1. **Update the privacy policy** to name the provider and what's sent (habit names, stats,
   entry notes for the questions asked).
2. **Add an AI features setting** in the profile ("Enable AI coach and smart search") and check it
   in the endpoints. When it's off, don't index that user's notes and don't send anything.
3. **Deletion:** deleting an account must delete `ai_coach.*` rows (conversations and note
   embeddings). Hook into the existing user-deletion flow or integration event, and let users
   delete individual conversations (phase 4 already has the endpoint).
4. **Logs:** keep `EnableSensitiveData = false` on the OpenTelemetry chat client in production so
   prompts and answers aren't written to Tempo or Loki. `UseLogging()` at debug level logs message
   content, so keep that level off in production.
5. **Never put API keys in `appsettings.json`.** Use environment variables or Dokploy secrets,
   and rotate a key immediately if it ever gets committed.

---

## Step 6.5: Monitoring

With the phase 1 OpenTelemetry wiring, the chat client emits GenAI spans and metrics (token usage,
operation duration). Add to Grafana:

- tokens per day (input and output), and per user for the top 10 users
- coach turn latency (p50, p95) and the number of tool calls per turn
- error and 429 rate from the provider
- indexing backlog: `SELECT count(*) FROM ai_coach.note_embeddings WHERE status = 'Pending'`,
  and the `Failed` count

Alert when the backlog grows for more than 30 minutes (embedding provider down) or the provider
error rate exceeds a few percent.

---

## ✅ Launch checklist

- [ ] The provider's terms allow production use, and its data-use policy is acceptable and reflected in the privacy policy
- [ ] The evaluation questions from phase 4 pass on the production chat model
- [ ] Embeddings in prod return 768 values, and the backlog is empty after the backfill
- [ ] The API key is a secret, not in git
- [ ] Rate limits are active, and a 429 shows a friendly message
- [ ] The SSE route streams through the reverse proxy (text arrives gradually, not all at once)
- [ ] Second-user isolation checks pass in production: search, conversations, tools
- [ ] Account deletion removes AI data, and the AI features toggle works
- [ ] Dashboards and alerts for tokens, latency, errors and indexing backlog exist

Commit: `chore(ai-coach): production provider config, rate limits, monitoring`.

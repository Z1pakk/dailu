# Phase 5: production with a self-hosted embedding model

Goal: semantic search works in production, with `nomic-embed-text` running in an Ollama
container on the same server as the API. Existing habits, tags, and entry notes get indexed,
and a model change can be re-indexed with one switch.

Do this after phases 1–3 work locally. It has no new search logic. It covers deployment config,
a health check, and the backfill from Step 2.4, which you can now run on demand.

**Why self-host embeddings when chat uses a hosted provider (Groq)?** The two models have very
different needs:

| | Embedding model (`nomic-embed-text`) | Chat model |
|---|---|---|
| Size | ~137M parameters, ~300 MB | billions of parameters, GBs |
| CPU speed | tens of milliseconds per text | seconds to minutes per answer |
| Needs a GPU? | no | practically yes |
| Called | on every search + every indexed save | on coach messages |

Running the embedding model yourself costs nothing and has no rate limits or terms of service.
User notes never leave the server, and **dev and prod produce identical vectors**. A dev
database dump works in prod, and you never re-index because of deployment. Chat needs a GPU, so
it stays on a hosted provider (see the [ai-coach production phase](../ai-coach/04-production.md)).

```
 Dokploy server (compose network "default")
 ┌──────────────────────────────────────────────────────────────────────┐
 │  dailu-api ──HTTP :11434──► dailu-ollama  (nomic-embed-text, no port) │
 │     │                           ▲                                    │
 │     │                  dailu-ollama-init (one-shot: ollama pull)     │
 │     └──► Postgres (pgvector + pg_trgm)    RabbitMQ                    │
 └──────────────────────────────────────────────────────────────────────┘
          dailu-api ──HTTPS──► api.groq.com (chat only)
```

---

## Step 5.1: Production `Ai` configuration

**Fix this first. Without it the API doesn't start in production.** `AiOptions` is registered with
`AddValidateOptions`, which runs `ValidateDataAnnotations().ValidateOnStart()`. Both
`AiChatOptions` and `AiEmbeddingOptions` mark `Endpoint` and `Model` as `[Required]`, and
`[Required]` rejects empty strings. `appsettings.json` ships empty strings, and
`docker-compose.override.prod.yml` doesn't set any `Ai__*` variables yet. So the host throws
`OptionsValidationException` before it serves a request.

Add these under `dailu-api.environment` in `docker-compose.override.prod.yml`:

```yaml
      Ai__Embeddings__Provider: ollama
      Ai__Embeddings__Endpoint: ${OLLAMA_ENDPOINT:-http://dailu-ollama:11434}
      Ai__Embeddings__Model: ${AI_EMBEDDINGS_MODEL:-nomic-embed-text}
      Ai__Embeddings__Dimensions: 768
      Ai__Chat__Provider: openai-compatible
      Ai__Chat__Endpoint: https://api.groq.com/openai/v1
      Ai__Chat__Model: ${AI_CHAT_MODEL:-openai/gpt-oss-120b}
      Ai__Chat__ApiKey: ${AI_CHAT_API_KEY:-}
```

- **Why `Chat` too?** `search` has its own `AiOptions` that includes `Chat` (phase 1's
  per-module decision), and it's `[Required]`. Nothing in `search` calls chat until phase 4,
  but the values still have to be valid.
- **Why `__`?** In environment variables, ASP.NET Core reads a double underscore as the `:`
  section separator, so `Ai__Embeddings__Model` becomes `Ai:Embeddings:Model`.
- **The Groq key** goes in Dokploy's environment settings as `AI_CHAT_API_KEY`. Never put it in
  `appsettings*.json`.

---

## Step 5.2: Ollama container and the model pull

### Check the database first

Production uses an external `DB_HOST`, not the dev `pgvector/pgvector` image. The search
migration needs both extensions, so run this on the prod database:

```sql
SELECT name, installed_version FROM pg_available_extensions WHERE name IN ('vector', 'pg_trgm');
```

Both rows must exist. `pg_trgm` ships with every Postgres. `vector` doesn't, so if it's missing,
the database needs the pgvector image or package before you deploy.

### The Ollama server

Add to `docker-compose.override.prod.yml`:

```yaml
  dailu-ollama:
    image: ollama/ollama:<pinned-version>    # check Docker Hub; never :latest in prod
    restart: unless-stopped
    environment:
      OLLAMA_KEEP_ALIVE: "-1"                # keep the model in memory
    volumes:
      - dailu_ollama_data:/root/.ollama
    mem_limit: 1536m
    healthcheck:
      test: ["CMD", "ollama", "list"]
      interval: 30s
      timeout: 5s
      retries: 3
    networks:
      - default                              # NOT dokploy-network, and no "ports:"
```

- **No `ports:` and no `dokploy-network`.** Ollama's HTTP API has **no authentication**. Anyone who
  can reach port 11434 can pull models, delete models, or use your CPU. Only containers on
  the compose network should reach it, and `dailu-api` is already on `default`.
- **`OLLAMA_KEEP_ALIVE=-1`.** By default Ollama unloads a model after 5 idle minutes, so
  the first search after a quiet period waits about a second while it loads again. The model
  is small enough to keep in memory.
- **`mem_limit`.** Postgres, RabbitMQ, the API, and Ollama share one machine. The limit stops
  a misbehaving Ollama from starving the database.
- **Pin the version.** Ollama's API has changed between versions before. You want upgrades
  to be deliberate.

### Pulling the model: a one-shot init container

A fresh volume has no models in it. Without the pull, every embedding call fails with
`404 model "nomic-embed-text" not found`. Running `docker exec ... ollama pull` by hand works
once, but it's easy to forget on a rebuilt server. Let compose do it on every deploy:

```yaml
  dailu-ollama-init:
    image: ollama/ollama:<same-pinned-version>
    restart: "no"
    environment:
      OLLAMA_HOST: http://dailu-ollama:11434   # the CLI talks to the server container
    entrypoint: ["ollama", "pull", "nomic-embed-text"]
    depends_on:
      dailu-ollama:
        condition: service_healthy
```

The `ollama` CLI is only a client. With `OLLAMA_HOST` set, it asks the **server** container to
pull, so the model ends up in the server's volume. On later deploys the pull sees the model is
already there and finishes in a second.

Then make the API wait for it, in `dailu-api`:

```yaml
    depends_on:
      dailu-ollama-init:
        condition: service_completed_successfully
```

Add `dailu_ollama_data:` to the file's `volumes:` section.

**Dev (optional):** keep the natively installed Ollama from phase 1, or add the same
service to `docker-compose.yml` with `ports: ["11434:11434"]`. Publishing the port is fine on
your machine, never in prod.

---

## Step 5.3: Ollama readiness health check

`/api/health/ready` (in `Dailu.Infrastructure/Health/Setup.cs`) checks Postgres and RabbitMQ.
Add Ollama so a missing model or a stopped container shows up in health checks instead of
only in error logs.

**It must report Degraded, never Unhealthy.** Phase 3 already degrades search to text-only
when the embedding provider is down, so the app still works. Unhealthy would fail the
post-deploy smoke test and could cause a restart loop over a problem users barely notice.

`Search.Infrastructure/Health/OllamaHealthCheck.cs` (starting point):

```csharp
internal sealed class OllamaHealthCheck(IHttpClientFactory httpClientFactory, AiOptions options)
    : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var client = httpClientFactory.CreateClient();
            var tags = await client.GetFromJsonAsync<OllamaTags>(
                new Uri(new Uri(options.Embeddings.Endpoint), "/api/tags"), cancellationToken);

            // Ollama reports "nomic-embed-text:latest"
            var pulled = tags?.Models.Any(m =>
                m.Name.StartsWith(options.Embeddings.Model, StringComparison.OrdinalIgnoreCase)) == true;

            return pulled
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Degraded("embedding model not pulled");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Degraded("ollama unreachable", ex);
        }
    }

    private sealed record OllamaTags(List<OllamaModel> Models);
    private sealed record OllamaModel(string Name);
}
```

Register it in `Search.Infrastructure/Setup.cs` → `AddAiClients`, **only when the provider is
Ollama**. A hosted provider has no `/api/tags`. Read the provider at registration time, the same
way `Dailu.Infrastructure/Health/Setup.cs` uses `services.GetOptions<RabbitMqOptions>()`:

```csharp
if (services.GetOptions<AiOptions>().Embeddings.Provider == AiEmbeddingOptions.Ollama)
{
    services.AddHttpClient();
    services.AddHealthChecks()
        .AddCheck<OllamaHealthCheck>("ollama", tags: [HealthCheckTags.Ready], timeout: TimeSpan.FromSeconds(5));
}
```

**Also fix this while you're in `Setup.cs`:** the embedding `switch` compares against
`AiChatOptions.Ollama` and `AiChatOptions.OpenAiCompatible`. It works because the strings happen
to match, but it ties embeddings to the chat options class. Add `OpenAiCompatible` to
`AiEmbeddingOptions` and switch on those constants instead.

---

## Step 5.4: Backfill commands

Step 2.4 described the backfill. Build it now if you skipped it, because production already has
records that never raised an indexing event. Each owning module gets one command:

| Module | Command | Rows | Event |
|---|---|---|---|
| `tag` | `RepublishTagsCommand` | all tags | `TagNameChangedIntegrationEvent(TagId, UserId, Name)` |
| `habit` | `RepublishHabitsCommand` | all habits, archived included | `HabitNameDescriptionChangedIntegrationEvent(HabitId, UserId, Name, Description, IsArchived)` |
| `habit-entry` | `RepublishEntryNotesCommand` | `WHERE notes IS NOT NULL` | `HabitEntryNoteChangedIntegrationEvent(EntryId, UserId, HabitId, Notes, CompletedAtUtc, IsArchived)` |

Each is an `ICommand<Result<int>>`, and the `int` is how many events were published. Every handler
uses the same loop:

```
lastId = null
loop:
    page = db.<Table>.AsNoTracking()
             .Where(x => lastId == null || x.Id > lastId)   // keyset, not Skip/Take
             .OrderBy(x => x.Id)
             .Take(500)
             .Select(x => new <Event>(...))                  // project; don't load aggregates
             .ToListAsync()
    if page is empty: break
    await eventDispatcher.SendAsync(page, ct)
    lastId = last id in page
```

- **Why keyset pagination, not `Skip/Take`?** `OFFSET 50000` makes Postgres read and throw away
  50,000 rows to return the next 500, so each page gets slower than the one before. `WHERE id > lastId`
  jumps straight to the next page through the primary-key index, so every page costs the same.
- **Copy the values the aggregate sends.** Build each event exactly as `HabitAggregate`,
  `TagAggregate`, and `HabitEntryAggregate` do when they raise it. The backfill should look
  like a real edit to the search handler.
- **All users.** If a module's DbContext has a per-user query filter, use `IgnoreQueryFilters()`.
- **Why this is safe to re-run:** `SearchIndexService.AddAsync` skips any row whose
  `ContentHash` and `EmbeddingModel` already match, so a second run embeds nothing.

**Delivery in production:** with `RabbitMq__IsEnabled=true`, `SendAsync` publishes to RabbitMQ
instead of calling the handler inline. The command returns in seconds, and the search consumer
embeds in the background at whatever pace Ollama manages. `EventDispatcher` logs and drops
events that fail to publish. That's acceptable here because the backfill itself is the repair
tool, so you just run it again.

---

## Step 5.5: Startup trigger

Production has no admin endpoint, so the trigger is a config flag that a hosted service in
`Dailu.Api` reads.

- `SearchBackfillOptions : IOptions`, section `"SearchBackfill"`, `bool RunOnStartup` (default
  `false`), registered with `AddValidateOptions<SearchBackfillOptions>()`.
- `SearchBackfillHostedService : BackgroundService`, registered with `AddHostedService`.
  Follow the pattern of `DatabaseInitializationService` (`Dailu.Infrastructure/Database/DatabaseExtensions.cs`).

`ExecuteAsync`:
1. Return immediately if `RunOnStartup` is `false`.
2. Wait for `IHostApplicationLifetime.ApplicationStarted`, so the RabbitMQ consumer is up.
   In development, this also means `DatabaseInitializationService` has run the migrations. In
   production it doesn't run (`Program.cs` adds it only in Development), because migrations
   run in CI (`deploy.yml` → `migrate` job) before the new image starts.
3. Create a scope, then `ISender.Send` the commands in this order: tags, habits, entries. Log each count.
4. Catch and log everything. A failed backfill must never crash the host.

**Why it lives in `Dailu.Api`:** it's the only project that references all three modules.
Putting it in `search` would mean `search` depends on other modules' Application layers,
which the architecture tests (and the whole module design) forbid.

In the prod compose file:

```yaml
      SearchBackfill__RunOnStartup: ${SEARCH_BACKFILL_ON_STARTUP:-false}
```

**Turn it off after the first run.** Leaving it on is harmless because the backfill is
idempotent, but every restart would republish every record for nothing.

---

## Step 5.6: Rollout

1. In Dokploy, set `AI_CHAT_API_KEY` and `SEARCH_BACKFILL_ON_STARTUP=true`. Deploy.
2. Check that `dailu-ollama-init` exited with code 0 and that `/api/health/ready` shows `"ollama":"Healthy"`.
3. Watch the search queue in the RabbitMQ management UI. It fills, then drains.
4. Run the progress query below. The counts should match your data.
5. Set `SEARCH_BACKFILL_ON_STARTUP=false` and redeploy.

```sql
SELECT entity_type, embedding_model, count(*)
FROM search.search_index
GROUP BY 1, 2;
```

### Changing the embedding model later

1. **Same size (768):** add a branch to `IEmbeddingTextFormatter` if the new model uses
   different prefixes (or none), set `AI_EMBEDDINGS_MODEL`, update the `ollama pull` model in
   `dailu-ollama-init`, then repeat the rollout. During the re-index, the semantic leg
   only returns rows already on the new model (it filters on `embedding_model`). Text matching
   keeps finding everything. The progress query shows both model names until the old one
   disappears.
2. **Different size:** the `vector(768)` column has to change too. This needs a migration and either
   a period with empty semantic results or a second column filled alongside the first. Plan it
   separately. Staying at 768 is much easier.

---

## ✅ Verify

1. `docker compose -f docker-compose.yml -f docker-compose.override.prod.yml config` (with
   dummy values for the `:?` variables) shows all eight `Ai__*` keys on `dailu-api`.
2. Run `docker compose -f docker-compose.yml -f docker-compose.override.prod.yml up dailu-ollama dailu-ollama-init`
   locally. The init container logs `success` and exits 0, and `docker exec <ollama> ollama list` shows
   `nomic-embed-text`.
3. Locally, `curl /api/health/ready` shows `"ollama":"Healthy"`. Stop Ollama and run it again. Now it shows
   `"ollama":"Degraded"`, the overall status is `Degraded`, and the HTTP status is still **200**.
4. With `SearchBackfill:RunOnStartup=true` in user secrets, start the API. The progress query
   counts match your tags, habits, and entries with notes.
5. Restart with the flag still on. The logs show the same publish counts, but the rows'
   `embedding` values don't change, so nothing was re-embedded.
6. After the production rollout, edit one entry note in the app. Its row's `text` and `embedding`
   update within seconds, and a search for a synonym of a word in it finds the entry.

Commit: `feat(search): self-hosted embeddings in production + backfill`.

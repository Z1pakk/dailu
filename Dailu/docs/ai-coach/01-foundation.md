# Phase 1: foundation

Goal: Ollama and pgvector run locally, a new `ai-coach` module exists, and the API can reach a
chat model and an embedding model through `Microsoft.Extensions.AI`. There are no user-facing
features yet.

---

## Step 1.1: Add the packages to central package management

In `Directory.Packages.props`, add a group. Use the latest stable versions from nuget.org;
versions aren't pinned here on purpose.

```xml
<!-- AI -->
<PackageVersion Include="Microsoft.Extensions.AI" Version="x.y.z" />
<PackageVersion Include="Microsoft.Extensions.AI.OpenAI" Version="x.y.z" />
<PackageVersion Include="OllamaSharp" Version="x.y.z" />
<PackageVersion Include="Pgvector.EntityFrameworkCore" Version="x.y.z" />
<PackageVersion Include="CommunityToolkit.Aspire.Hosting.Ollama" Version="x.y.z" />
```

| Package | Used by | What for |
|---|---|---|
| `Microsoft.Extensions.AI` | AiCoach.Application / Infrastructure | `IChatClient`, `IEmbeddingGenerator`, tool calling (`UseFunctionInvocation`) |
| `Microsoft.Extensions.AI.OpenAI` | AiCoach.Infrastructure | Adapter for any OpenAI-compatible API (used in production) |
| `OllamaSharp` | AiCoach.Infrastructure | Ollama client; implements `IChatClient` and `IEmbeddingGenerator` directly |
| `Pgvector.EntityFrameworkCore` | AiCoach.Infrastructure | `vector` column type and cosine-distance queries in EF Core (supports EF Core 10) |
| `CommunityToolkit.Aspire.Hosting.Ollama` | Dailu.AppHost | Runs Ollama as a container and downloads the models |

> `Microsoft.Extensions.AI.OpenAI` sometimes ships only as a prerelease. If `dotnet restore`
> can't find a stable version, use the latest `-preview` version.

---

## Step 1.2: Switch Postgres to an image that includes pgvector

pgvector is a Postgres **extension**, and the plain `postgres` image doesn't ship it. The
`pgvector/pgvector` images are the official Postgres image with the extension added, so the
data layout is identical.

### Local (Aspire): `src/aspire/Dailu.AppHost/AppHost.cs`

```csharp
IResourceBuilder<PostgresServerResource> db = builder
    .AddPostgres("dailo-db")
    .WithImage("pgvector/pgvector")
    .WithImageTag("pg18")          // pin a specific tag from Docker Hub, e.g. "0.8.x-pg18"
    .WithDataVolume()              // see warning below
    .WithContainerName("dailo-db-postgres")
    .WithLifetime(ContainerLifetime.Persistent);
```

> ⚠️ Right now the Aspire Postgres container has **no data volume**, so its data lives inside
> the container. Changing the image recreates the container and **your local dev data is
> lost**. If you care about it, `pg_dump` it first and restore it afterwards. Adding
> `WithDataVolume()` prevents this from happening again.

### Production (docker-compose): `docker-compose.yml`

```yaml
  dailo.postgres:
    image: pgvector/pgvector:pg18   # was postgres:18.3. Same major version, so the volume is reused as-is
```

This is safe for existing data because the Postgres major version stays 18. **Take a backup
before deploying anyway.**

---

## Step 1.3: Run Ollama from Aspire

Add a reference to `CommunityToolkit.Aspire.Hosting.Ollama` in
`src/aspire/Dailu.AppHost/Dailu.AppHost.csproj`, then extend `AppHost.cs`:

```csharp
var ollama = builder
    .AddOllama("ollama")
    .WithDataVolume()        // models survive container restarts (they're several GB)
    .WithLifetime(ContainerLifetime.Persistent);
    // .WithGPUSupport()     // uncomment if you have an NVIDIA GPU + container toolkit

var chatModel = ollama.AddModel("chat-model", "qwen3:8b");
var embeddingModel = ollama.AddModel("embedding-model", "nomic-embed-text");

builder
    .AddProject<Projects.Dailu_Api>("api")
    // ...existing references...
    .WithReference(db, connectionName: "AiCoachPostgresConnectionString")
    .WithEnvironment("Ai__Chat__Endpoint", ollama.GetEndpoint("http"))
    .WithEnvironment("Ai__Embeddings__Endpoint", ollama.GetEndpoint("http"))
    .WaitFor(chatModel)
    .WaitFor(embeddingModel);
```

**Decision:** the API reads its own `Ai:*` config section (next step) instead of Aspire's
Ollama *client* integration. The same code then runs unchanged in production, where there is
no Aspire and no Ollama. Aspire only supplies the endpoint URL through environment variables
(`__` becomes `:` in .NET config).

> If `GetEndpoint("http")` doesn't resolve, open the Aspire dashboard, check the endpoint name
> on the `ollama` resource, and use that.

**Model choice:**
- `qwen3:8b` is a good free model for **tool calling**, which the coach depends on. Llama 3.1 8B
  is an alternative.
- Very small models (under about 4B) often ignore the tools or invent their arguments.
- `nomic-embed-text` produces **768-dimensional** embeddings, which matches the column size in
  phase 2.

---

## Step 1.4: Scaffold the `ai-coach` module

Copy the shape of an existing module (for example `tag`) into `src/modules/ai-coach/`:

```
src/modules/ai-coach/
  AiCoach.Domain/          entities: Conversation, ConversationMessage, NoteEmbedding
  AiCoach.Application/     commands/queries, tools, prompts, IAiCoachDbContext, IntegratedServices/*
  AiCoach.Infrastructure/  DbContext, EF configs, migrations, AI client wiring, workers, Setup
  AiCoach.Api/             endpoint group /ai-coach
  AiCoach.Integrations/    adapters over Habit.DataTransfer / HabitEntry.DataTransfer
```

Checklist (mirror what `Tag.*` does):

1. Create the five projects and add them to `Dailu.slnx`. Copy the project references from the
   `Tag.*` csproj files.
2. `AiCoach.Infrastructure/Database/Schema.cs` with `NAME = "ai_coach"`.
3. `AiCoachDbContext : AppDbContextBase, IAiCoachDbContext`, plus an
   `IDesignTimeDbContextFactory` copied from another module so `dotnet ef` works.
4. `Setup.cs` with `AddAiCoachPersistence` and `AddAiCoachModule`, following the pattern in
   `HabitUser.Infrastructure/Setup.cs`, with connection string name
   `AiCoachPostgresConnectionString`.
5. Register it in `src/api/Dailu.Api/Program.cs`: `.AddAiCoachModule(builder.Configuration)`.
6. Add the empty `AiCoachPostgresConnectionString` to `Dailu.Api/appsettings.json` like the
   others.
7. Add the new assemblies to `src/tests/Dailu.ArchitectureTests/ModuleIsolationTests.cs` and add
   an `AiCoach.ArchitectureTests` project that copies `HabitUser.ArchitectureTests`. The
   isolation rules then check that `ai-coach` only reaches other modules through their
   `*.DataTransfer` projects.

### Enable pgvector in the DbContext

Only this module needs vectors, so enable them only here. In `AddAiCoachPersistence`:

```csharp
services.AddDbContext<IAiCoachDbContext, AiCoachDbContext>(opt =>
    opt.UseNpgsql(
            connectionString,
            b =>
            {
                b.MigrationsAssembly(AssemblyReference.Assembly)
                    .MigrationsHistoryTable(HistoryRepository.DefaultTableName, AiCoachSchema.NAME);
                b.UseVector();                       // ← pgvector type mapping
                b.EnableRetryOnFailure(3, TimeSpan.FromSeconds(30), null);
            }
        )
        .UseSnakeCaseNamingConvention()
);
```

And in `AiCoachDbContext.OnModelCreating`:

```csharp
modelBuilder.HasDefaultSchema(Schema);
modelBuilder.HasPostgresExtension("vector");   // migration runs CREATE EXTENSION IF NOT EXISTS vector
```

Also add `UseVector()` to the design-time factory's `UseNpgsql(...)` call, or `dotnet ef` won't
understand the `vector` column.

Create the first migration (`AiCoach_Create`) from inside `AiCoach.Infrastructure`, following
AGENTS.md. It will be almost empty apart from the extension. That's fine.

---

## Step 1.5: Configuration

`Dailu.Api/appsettings.json`: the defaults point at local Ollama:

```json
"Ai": {
  "Chat": {
    "Provider": "ollama",
    "Endpoint": "http://localhost:11434",
    "Model": "qwen3:8b",
    "ApiKey": ""
  },
  "Embeddings": {
    "Provider": "ollama",
    "Endpoint": "http://localhost:11434",
    "Model": "nomic-embed-text",
    "ApiKey": "",
    "Dimensions": 768
  }
}
```

Options classes in `AiCoach.Infrastructure/Ai/AiOptions.cs`, following the repo's
`SharedKernel.Options.IOptions` pattern:

```csharp
public sealed class AiOptions : IOptions
{
    public string SectionName => "Ai";

    [Required] public AiEndpointOptions Chat { get; init; } = new();
    [Required] public AiEmbeddingOptions Embeddings { get; init; } = new();
}

public class AiEndpointOptions
{
    public const string Ollama = "ollama";
    public const string OpenAiCompatible = "openai-compatible";

    [Required] public string Provider { get; init; } = Ollama;
    [Required] public string Endpoint { get; init; } = string.Empty;
    [Required] public string Model { get; init; } = string.Empty;
    public string? ApiKey { get; init; }
}

public sealed class AiEmbeddingOptions : AiEndpointOptions
{
    [Range(1, 4096)] public int Dimensions { get; init; } = 768;
}
```

> `ValidateDataAnnotations()` doesn't validate nested objects. Either add a small
> `IValidateOptions<AiOptions>` or check `Endpoint`/`Model` manually at startup. A missing
> model name should fail fast, not on the first chat message.

---

## Step 1.6: Build the AI clients from config

`AiCoach.Infrastructure/Ai/AiSetup.cs`. This is the only place that knows which provider is
used.

```csharp
using System.ClientModel;
using Microsoft.Extensions.AI;
using OllamaSharp;
using OpenAI;

internal static class AiSetup
{
    public static IServiceCollection AddAiClients(this IServiceCollection services)
    {
        services.AddValidateOptions<AiOptions>();

        services
            .AddChatClient(sp =>
            {
                var o = sp.GetRequiredService<AiOptions>().Chat;
                return o.Provider switch
                {
                    AiEndpointOptions.Ollama => new OllamaApiClient(new Uri(o.Endpoint), o.Model),
                    AiEndpointOptions.OpenAiCompatible => CreateOpenAi(o).GetChatClient(o.Model).AsIChatClient(),
                    _ => throw new InvalidOperationException($"Unknown AI provider '{o.Provider}'."),
                };
            })
            .UseFunctionInvocation()          // runs the tool-call loop (phase 4)
            .UseOpenTelemetry()               // spans + token metrics in your existing OTel setup
            .UseLogging();

        services
            .AddEmbeddingGenerator(sp =>
            {
                var o = sp.GetRequiredService<AiOptions>().Embeddings;
                return o.Provider switch
                {
                    AiEndpointOptions.Ollama => (IEmbeddingGenerator<string, Embedding<float>>)
                        new OllamaApiClient(new Uri(o.Endpoint), o.Model),
                    AiEndpointOptions.OpenAiCompatible =>
                        CreateOpenAi(o).GetEmbeddingClient(o.Model).AsIEmbeddingGenerator(),
                    _ => throw new InvalidOperationException($"Unknown AI provider '{o.Provider}'."),
                };
            })
            .UseOpenTelemetry();

        return services;
    }

    private static OpenAIClient CreateOpenAi(AiEndpointOptions o) =>
        new(new ApiKeyCredential(o.ApiKey ?? string.Empty),
            new OpenAIClientOptions { Endpoint = new Uri(o.Endpoint) });
}
```

Call `services.AddAiClients()` from `AddAiCoachModule`.

Notes:
- `OllamaApiClient` implements both interfaces, so one class serves chat and embeddings.
- The pipeline order matters: `UseFunctionInvocation()` wraps the raw client. If you later add
  caching, put it **outside** function invocation so tool results are never cached across users.
- For the OpenTelemetry spans to be exported, add the `Microsoft.Extensions.AI` activity source
  to the OTel setup in `Dailu.Api/DependencyInjection.cs` (`.AddSource("Experimental.Microsoft.Extensions.AI")`).
  Check the exact source name in the Microsoft.Extensions.AI docs; it has changed between
  versions.

---

## Step 1.7: A temporary "ping" endpoint

Add a throwaway, authorized endpoint to prove the whole chain works. Delete it after phase 4.

```csharp
group.MapGet("/ping", async (IChatClient chat, IEmbeddingGenerator<string, Embedding<float>> embed, CancellationToken ct) =>
{
    var reply = await chat.GetResponseAsync("Reply with exactly: pong", cancellationToken: ct);
    var vector = await embed.GenerateVectorAsync("hello", cancellationToken: ct);
    return TypedResults.Ok(new { reply = reply.Text, dimensions = vector.Length });
}).RequireAuthorization();
```

---

## ✅ Verify

1. Start the AppHost. In the Aspire dashboard, `ollama`, `chat-model` and `embedding-model`
   should become healthy. The first start downloads about 5 GB, so wait for it.
2. The migration applies and `\dx` in psql lists the `vector` extension.
3. `GET /ai-coach/ping` returns something like `{ "reply": "pong", "dimensions": 768 }`.
4. The architecture tests pass: `dotnet test src/tests/Dailu.ArchitectureTests`.

**If `dimensions` isn't 768,** the embedding model is wrong. Fix it now: phase 2 hard-codes the
column size.

Commit: `feat(ai-coach): module scaffold, Ollama + pgvector, AI client wiring`.

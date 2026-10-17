# Phase 1: foundation

Goal: Ollama and pgvector run locally, the `search` module exists with its AI clients wired from
config, and its one entity — `SearchIndexEntryEntity` — has a table in the `search` schema. There
are no user-facing features yet; phase 2 starts filling the table.

By the end of this phase the module looks like this (✱ = created in this phase):

```
src/modules/search/
  Search.Domain/
    Global.cs                                   ✱ global usings, copied from Tag.Domain
    Enums/SearchEntityType.cs                   ✱ Habit | Tag | EntryNote
    Entities/SearchIndexEntryEntity.cs          ✱ one row per searchable piece of text, with its vector
  Search.Application/
    Persistence/ISearchDbContext.cs             ✱ + DbSet<SearchIndexEntryEntity> SearchIndex
    Ai/IEmbeddingTextFormatter.cs               ✱ adds model-specific prefixes before embedding
    Ai/IAiModelInfo.cs                          ✱ which embedding model/size is configured
  Search.Infrastructure/
    Options/AiOptions.cs                        ✱ binds the "Ai" config section
    Options/AiChatOptions.cs                    ✱ Ai:Chat (used from phase 4)
    Options/AiEmbeddingOptions.cs               ✱ Ai:Embeddings
    Options/AiProviders.cs                      ✱ "ollama" / "openai-compatible" constants
    Ai/AiSetup.cs                               ✱ AddAiClients(): IEmbeddingGenerator + the two services below
    Ai/EmbeddingTextFormatter.cs                ✱ IEmbeddingTextFormatter implementation
    Ai/AiModelInfo.cs                           ✱ IAiModelInfo implementation
    Database/Schema.cs                          ✱ SearchSchema.NAME = "search"
    Database/SearchDbContext.cs                 ✱ + pgvector extension, SearchIndex set
    Database/SearchDbContextDesignFactory.cs    ✱ for dotnet ef
    Database/Configurations/
      SearchIndexEntryEntityConfiguration.cs    ✱ table, indexes, vector(768) column
    Database/Migrations/                        ✱ Search_Create
    Setup.cs                                    ✱ AddSearchModule / AddSearchPersistence
  Search.ArchitectureTests/                     ✱
  Search.Api/, Search.DataTransfer/,
  Search.Integrations/                          empty projects for now (phase 3)
```

**Why the interfaces live in Application and the implementations in Infrastructure.** Phase 2's
`SearchIndexWriter` and phase 3's `SearchService` are in `Search.Application`, and they need to
know "how do I prefix this text" and "which model am I using". Application can't reference
Infrastructure (that's the dependency rule the architecture tests enforce), so the *questions*
are interfaces in Application, and the *answers* — which read `AiOptions` — are classes in
Infrastructure. Same split as `ISearchDbContext` / `SearchDbContext`.

---

## Step 1.1: Add the packages to central package management

In `Directory.Packages.props`, add a group. Use the latest stable versions from nuget.org;
versions aren't pinned here on purpose.

```xml
<!-- AI -->
<PackageVersion Include="Microsoft.Extensions.AI" Version="x.y.z" />
<PackageVersion Include="Microsoft.Extensions.AI.Abstractions" Version="x.y.z" />
<PackageVersion Include="Microsoft.Extensions.AI.OpenAI" Version="x.y.z" />
<PackageVersion Include="OllamaSharp" Version="x.y.z" />
<PackageVersion Include="Pgvector" Version="x.y.z" />
<PackageVersion Include="Pgvector.EntityFrameworkCore" Version="x.y.z" />
```

| Package | Used by | What for |
|---|---|---|
| `Pgvector` | `Search.Domain` | The `Vector` type for the entity's `Embedding` property — no EF dependency in Domain |
| `Microsoft.Extensions.AI.Abstractions` | `Search.Application` | `IEmbeddingGenerator` for phase 2's index writer and phase 3's search service — interfaces only |
| `Pgvector.EntityFrameworkCore` | `Search.Application`, `Search.Infrastructure` | `.CosineDistance(...)` in LINQ queries (Application, phase 3); `UseVector()` and the `vector` column mapping (Infrastructure) |
| `Microsoft.Extensions.AI` | `Search.Infrastructure` | `AddEmbeddingGenerator`, `.UseOpenTelemetry()`, and `IChatClient` (phase 4 reranking) |
| `Microsoft.Extensions.AI.OpenAI` | `Search.Infrastructure` | Adapter for any OpenAI-compatible API (used in production) |
| `OllamaSharp` | `Search.Infrastructure` | Ollama client; implements `IChatClient` and `IEmbeddingGenerator` directly |

> `Microsoft.Extensions.AI.OpenAI` sometimes ships only as a prerelease. If `dotnet restore`
> can't find a stable version, use the latest `-preview` version.
>
> No Aspire hosting package for Ollama here — for now Ollama runs as its own local process (the
> native app/CLI), not something Aspire starts or stops.

**Why `Microsoft.Extensions.AI` at all?** Every AI provider (Ollama, OpenAI, Gemini, ...) has its
own SDK with its own method names and request/response shapes. `Microsoft.Extensions.AI` defines
two provider-neutral interfaces — `IChatClient` and `IEmbeddingGenerator<TInput, TEmbedding>` —
and every provider SDK either implements them directly (`OllamaSharp`'s `OllamaApiClient` does)
or gets a thin adapter (`Microsoft.Extensions.AI.OpenAI`'s `.AsIChatClient()` wraps the OpenAI
SDK). Your application code calls `chat.GetResponseAsync(...)` once, and which provider actually
runs behind that call becomes a config value (`Ai:Chat:Provider`), not a code change — that's
the whole point of the `switch` in `AiSetup.cs` below.

---

## Step 1.2: Switch Postgres to an image that includes pgvector

**What a Postgres extension is.** Postgres ships a small core, and most non-trivial features —
full-text search, UUIDs, and here, vectors — come as *extensions*: compiled code that plugs into
the server and adds new column types, operators, and index methods, enabled per-database with
`CREATE EXTENSION`. pgvector is one such extension. It adds a `vector(N)` column type (a fixed-
length array of floats, stored efficiently), distance operators (`<=>` for cosine, `<->` for
Euclidean, `<#>` for inner product), and two index methods (`hnsw` and `ivfflat`) that make
"find the nearest vectors" fast on large tables instead of a full scan. This module only uses
the column type and the cosine operator for now — no index yet, see the decision in step 1.8.

The plain `postgres` image doesn't compile pgvector in, so it can't be installed by just running
`CREATE EXTENSION vector` — the extension's binary has to exist in the image first. The
`pgvector/pgvector` images are the official Postgres image **plus** pgvector precompiled, so the
data layout is otherwise identical — switching images doesn't touch your existing data. Postgres
isn't managed by Aspire — local and production both run it from `docker-compose.yml`, and the
API connects with a plain connection string like the other modules already do
(`HabitPostgresConnectionString` etc. in `appsettings.Development.json`, pointing at
`localhost:5460`).

`docker-compose.yml`:

```yaml
  dailo.postgres:
    image: pgvector/pgvector:pg18   # was postgres:18.3. Same major version, so the volume is reused as-is
```

This is safe for existing data because the Postgres major version stays 18. **Take a backup
before deploying anyway**, and pin the volume with `external: true` and an explicit `name:` so a
renamed project folder or compose project can't silently hand you a fresh, empty volume instead
of erroring loudly.

---

## Step 1.3: Run Ollama locally

Install [Ollama](https://ollama.com) (or use your package manager) and pull the embedding model
this module needs:

```bash
ollama pull nomic-embed-text
```

The chat model (`qwen3:8b`) is pulled later, in the ai-coach guide's foundation phase — this
module only needs embeddings. The installer sets Ollama up as a background service listening on
`http://localhost:11434` by default, which is what `appsettings.json` points at in step 1.7.
Confirm it's running with `ollama list` before continuing.

---


## Step 1.4: Scaffold the `search` module

Copy the shape of an existing module (for example `tag`) into `src/modules/search/`:

| Project | Holds | References |
|---|---|---|
| `Search.Domain` | Entities and enums — plain classes, no EF, no AI | `SharedKernel`, `StrictId`, `Pgvector` |
| `Search.Application` | `ISearchDbContext`, the AI interfaces, index writer (phase 2), search service + query (phase 3), event handlers | `Search.Domain`, `SharedKernel`, `Dailu.Events`, `Microsoft.EntityFrameworkCore`, `Microsoft.Extensions.AI.Abstractions`, `Pgvector.EntityFrameworkCore` |
| `Search.Infrastructure` | DbContext, EF configurations, migrations, options, AI client setup, `Setup.cs` | `Search.Application`, `SharedInfrastructure`, the AI and Npgsql packages |
| `Search.Api` | Endpoint group `/search` (phase 3) | `Search.Application` |
| `Search.DataTransfer` | `ISearchDataTransferService` for `ai-coach` (phase 3) | `Search.Application` |
| `Search.Integrations` | Adapters over `Habit.DataTransfer` (phase 3) | `Search.Application`, `Habit.DataTransfer` |

Checklist (mirror what `Tag.*` does):

1. Create the projects and add them to `Dailu.slnx`. Copy the project references from the
   `Tag.*` csproj files, then add the ones in the table above. `Search.Application` must
   reference `Search.Domain` — the entity lives there.
2. `Search.Domain/Global.cs` with the same global usings as `Tag.Domain/Global.cs`
   (`SharedKernel.Domain`, `SharedKernel.Entity`).
3. `Search.Infrastructure/Database/Schema.cs` with `SearchSchema.NAME = "search"`.
4. `SearchDbContext : AppDbContextBase, ISearchDbContext`, plus an
   `IDesignTimeDbContextFactory` copied from another module so `dotnet ef` works.
5. `Setup.cs` with `AddSearchPersistence` and `AddSearchModule` (which also calls
   `services.AddAiClients()` from step 1.5), following the pattern in
   `HabitUser.Infrastructure/Setup.cs`, with connection string name
   `SearchPostgresConnectionString`.
6. Register it in `src/api/Dailu.Api/Program.cs`: `.AddSearchModule(builder.Configuration)`.
7. Add `SearchPostgresConnectionString` to `Dailu.Api/appsettings.json` (empty) and
   `appsettings.Development.json` (the real value, same docker-compose Postgres, same database,
   matching `HabitPostgresConnectionString` and the rest).
8. Add the new assemblies to `src/tests/Dailu.ArchitectureTests/ModuleIsolationTests.cs` and add
   a `Search.ArchitectureTests` project that copies `HabitUser.ArchitectureTests` (and references
   `Search.Infrastructure`, not another module's). The isolation rules then check that `search`
   only reaches other modules through their `*.DataTransfer` projects.

---

## Step 1.5: AI options and client wiring

**Decision: each module configures its own AI clients, from the same `Ai:*` config section,
rather than sharing one client-setup project.** `search` and `ai-coach` both end up with an
options/`AiSetup.cs` set that looks almost identical — that's accepted duplication, not an
oversight. It keeps each module's DI composition fully self-contained (no project that both
modules must agree to version and deploy together), and `Microsoft.Extensions.AI` clients are
thin HTTP wrappers, so registering the same provider twice from the same config costs nothing
at runtime.

**Why a typed options class instead of reading `IConfiguration` directly?** `IConfiguration` is
just a flat string lookup (`config["Ai:Chat:Model"]`), which means every typo or missing key
fails at the exact line that happens to read it, at runtime, maybe well after startup. Binding
to a C# class (`AiOptions`) up front gives you compile-time-checked property access everywhere
else in the module, and — combined with `[Required]` and `AddValidateOptions<T>()` — fails fast
at startup with a clear error ("Embeddings.Model is required") instead of a null reference deep
in a request handler. `SectionName => "Ai"` tells the repo's binding helper which JSON section
to read; that's the only part specific to this project's conventions.

All four files go in `Search.Infrastructure/Options/` — nothing outside Infrastructure ever sees
them.

`Options/AiProviders.cs` — the provider names, in one place so the chat and embedding switches
can't disagree:

```csharp
public static class AiProviders
{
    public const string Ollama = "ollama";
    public const string OpenAiCompatible = "openai-compatible";
}
```

`Options/AiOptions.cs`, following the repo's `SharedKernel.Options.IOptions` pattern:

```csharp
public sealed class AiOptions : IOptions
{
    public string SectionName => "Ai";

    [Required] public AiChatOptions Chat { get; init; } = new();
    [Required] public AiEmbeddingOptions Embeddings { get; init; } = new();
}
```

`Options/AiChatOptions.cs` — read only from phase 4 (reranking), but bound now so the whole
`Ai` section is validated in one place:

```csharp
public sealed class AiChatOptions
{
    [Required] public string Provider { get; init; } = AiProviders.Ollama;
    [Required] public string Endpoint { get; init; } = string.Empty;
    [Required] public string Model { get; init; } = string.Empty;
    public string? ApiKey { get; init; }
}
```

`Options/AiEmbeddingOptions.cs`:

```csharp
public sealed class AiEmbeddingOptions
{
    [Required] public string Provider { get; init; } = AiProviders.Ollama;
    [Required] public string Endpoint { get; init; } = string.Empty;
    [Required] public string Model { get; init; } = string.Empty;
    public string? ApiKey { get; init; }
    [Range(1, 4096)] public int Dimensions { get; init; } = 768;   // must match the vector(N) column
}
```

> `ValidateDataAnnotations()` doesn't validate nested objects. Either add a small
> `IValidateOptions<AiOptions>` or check `Endpoint`/`Model` manually at startup. A missing
> model name should fail fast, not on the first request.

`Search.Infrastructure/Ai/AiSetup.cs`. This is the only place in this module that knows which
provider is used. Only `IEmbeddingGenerator` is needed through phase 3 — phase 4 (reranking)
adds an `IChatClient` registration to this same class when it's actually needed, rather than
wiring up a chat client here that nothing calls yet:

```csharp
using Microsoft.Extensions.AI;
using OllamaSharp;
using OpenAI;

public static class AiSetup
{
    public static IServiceCollection AddAiClients(this IServiceCollection services)
    {
        services.AddValidateOptions<AiOptions>();

        services
            .AddEmbeddingGenerator(sp =>
            {
                var o = sp.GetRequiredService<AiOptions>().Embeddings;
                return o.Provider switch
                {
                    AiProviders.Ollama => (IEmbeddingGenerator<string, Embedding<float>>)
                        new OllamaApiClient(new Uri(o.Endpoint), o.Model),
                    AiProviders.OpenAiCompatible =>
                        CreateOpenAi(o.Endpoint, o.ApiKey).GetEmbeddingClient(o.Model).AsIEmbeddingGenerator(),
                    _ => throw new InvalidOperationException($"Unknown AI provider '{o.Provider}'."),
                };
            })
            .UseOpenTelemetry();

        services.AddSingleton<IAiModelInfo, AiModelInfo>();
        services.AddSingleton<IEmbeddingTextFormatter, EmbeddingTextFormatter>();

        return services;
    }

    // Shared by the embedding client here and the chat client in phase 4.
    internal static OpenAIClient CreateOpenAi(string endpoint, string? apiKey) =>
        new(new System.ClientModel.ApiKeyCredential(apiKey ?? string.Empty),
            new OpenAIClientOptions { Endpoint = new Uri(endpoint) });
}
```

Call `services.AddAiClients()` from `AddSearchModule` in this module's `Setup.cs`. `ai-coach`
will have its own, separately maintained copy under `AiCoach.Infrastructure/` (see its
foundation phase) — the two don't share code, only the same `Ai:*` config keys.

Notes:
- `OllamaApiClient` implements both `IChatClient` and `IEmbeddingGenerator`, which is why phase
  4's `AiSetup` addition can reuse it for reranking without a new client type.
- For OpenTelemetry spans to export, add the `Microsoft.Extensions.AI` activity source to the
  OTel setup in `Dailu.Api/DependencyInjection.cs`
  (`.AddSource("Experimental.Microsoft.Extensions.AI")`). Check the exact source name against
  your version; it has changed between releases.

---

## Step 1.6: Two model-specific services: `IEmbeddingTextFormatter` and `IAiModelInfo`

`IEmbeddingGenerator` turns text into a vector, but it doesn't know two model-specific facts the
rest of the module depends on. Each gets a tiny interface in `Search.Application/Ai/` and an
implementation in `Search.Infrastructure/Ai/`, registered as singletons in `AddAiClients` above.

### `IEmbeddingTextFormatter` — what text to actually embed

**What it is.** Some embedding models are trained with *task prefixes*: `nomic-embed-text`
expects stored documents as `"search_document: <text>"` and queries as
`"search_query: <text>"`. Without the prefixes it still returns vectors, just noticeably worse
matches. Other models (OpenAI's `text-embedding-3-*`, for example) use no prefix at all. This
service is the one place that knows which, so switching models never means hunting through the
indexing and search code.

**Who calls it.** Phase 2's `SearchIndexWriter` calls `ForDocument` before embedding stored
text; phase 3's `SearchService` calls `ForQuery` before embedding the user's query. Both must go
through it — if documents and queries are prefixed inconsistently, they land in slightly
different regions of the vector space and matches get worse.

`Search.Application/Ai/IEmbeddingTextFormatter.cs`:

```csharp
public interface IEmbeddingTextFormatter      // model-specific prefixes live here only
{
    string ForDocument(string text);          // nomic: "search_document: " + text
    string ForQuery(string text);             // nomic: "search_query: " + text
}
```

`Search.Infrastructure/Ai/EmbeddingTextFormatter.cs`:

```csharp
internal sealed class EmbeddingTextFormatter(AiOptions options) : IEmbeddingTextFormatter
{
    private readonly bool _usesNomicPrefixes =
        options.Embeddings.Model.StartsWith("nomic-embed-text", StringComparison.OrdinalIgnoreCase);

    public string ForDocument(string text) => _usesNomicPrefixes ? $"search_document: {text}" : text;

    public string ForQuery(string text) => _usesNomicPrefixes ? $"search_query: {text}" : text;
}
```

If you later add a model with its own convention, add a branch here — nothing else changes.

### `IAiModelInfo` — which model produced a vector

**What it is.** A read-only view of the configured embedding model's name and vector size.
`Search.Application` can't read `AiOptions` (it's an Infrastructure type), so this exposes just
the two values Application needs.

**Who calls it.**
- Phase 2's `SearchIndexWriter` stamps `EmbeddingModel` on every row it writes, and compares it
  to decide whether a row needs re-embedding after a model change.
- Phase 2's writer checks the returned vector length against `EmbeddingDimensions` and fails with
  a clear message instead of a confusing Postgres error on insert.
- Phase 3's `SearchService` filters on `EmbeddingModel` so it never compares vectors from two
  different models.

`Search.Application/Ai/IAiModelInfo.cs`:

```csharp
public interface IAiModelInfo
{
    string EmbeddingModel { get; }            // AiOptions.Embeddings.Model
    int EmbeddingDimensions { get; }          // AiOptions.Embeddings.Dimensions (768)
}
```

`Search.Infrastructure/Ai/AiModelInfo.cs`:

```csharp
internal sealed class AiModelInfo(AiOptions options) : IAiModelInfo
{
    public string EmbeddingModel => options.Embeddings.Model;
    public int EmbeddingDimensions => options.Embeddings.Dimensions;
}
```

---

## Step 1.7: Configuration

`Dailu.Api/appsettings.json`: the defaults point at local Ollama. `search` binds the whole `Ai`
section (it validates `Chat` now and uses it in phase 4); `ai-coach`'s separate `AiOptions` class
binds the same section independently — one JSON section, two unrelated option classes reading
from it.

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

---

## Step 1.8: The `SearchIndexEntryEntity` and its table

The module has exactly **one** entity. Every searchable thing — a habit's name and description, a
tag's name, an entry's note — becomes one row in `search.search_index`, holding the text that was
embedded, its vector, and a pointer back to the record it came from. `search` never owns habits,
tags, or entries; it only owns this derived, rebuildable copy of their text.

### The enum

`Search.Domain/Enums/SearchEntityType.cs`:

```csharp
public enum SearchEntityType
{
    Habit,       // EntityId = habit id;        Text = name (+ description)
    Tag,         // EntityId = tag id;          Text = name
    EntryNote,   // EntityId = habit entry id;  Text = the note; HabitId + OccurredAtUtc set
}
```

### The entity

`Search.Domain/Entities/SearchIndexEntryEntity.cs`:

```csharp
using Pgvector;
using StrictId;

public sealed class SearchIndexEntryEntity : BaseEntity<Id<SearchIndexEntryEntity>>
{
    public required Guid UserId { get; set; }              // owner; every query filters on it
    public required SearchEntityType EntityType { get; set; }
    public required Guid EntityId { get; set; }            // habit id, tag id, or habit entry id
    public Guid? HabitId { get; set; }                     // EntryNote only: lets results link back to the habit
    public required string Text { get; set; }              // exactly what was embedded (before the prefix)
    public required string ContentHash { get; set; }       // SHA-256 of Text, to skip re-embedding unchanged text
    public DateTime? OccurredAtUtc { get; set; }           // EntryNote only: the entry's date, for date filters

    public required Vector Embedding { get; set; }         // the vector, Dimensions long
    public required string EmbeddingModel { get; set; }    // which model produced it, e.g. "nomic-embed-text"
}
```

Why these fields:

- **`EntityType` + `EntityId`** identify the source record. Together they're unique — one row per
  habit, per tag, per entry note — which is what lets phase 2 upsert instead of append.
- **`UserId`** is stored, not looked up, because `search` can't query other modules' tables. It's
  the security boundary for every query in phase 3.
- **`HabitId`, `OccurredAtUtc`** only make sense for notes and are null otherwise — the price of
  one table instead of three (see the README's "entity-type discriminator").
- **`ContentHash`** and **`EmbeddingModel`** together answer "is the stored vector still right?"
  — same text and same model means skip the embedding call.
- **No habit name on note rows.** A habit rename would then have to rewrite every note row of
  that habit. Phase 3 looks names up at display time through `Habit.DataTransfer`.
- **No status column.** Phase 2 writes the row and its vector together, so a row that exists is
  always searchable.

It derives from `BaseEntity` like every other entity, so it gets the typed id, audit columns,
version token, and soft-delete flag for free. Create new rows with
`Id = Id<SearchIndexEntryEntity>.NewId()`.

### The EF configuration

`Search.Infrastructure/Database/Configurations/SearchIndexEntryEntityConfiguration.cs`, derived
from `BaseEntityTypedConfiguration<>` like `TagEntityConfiguration`:

```csharp
internal sealed class SearchIndexEntryEntityConfiguration
    : BaseEntityTypedConfiguration<SearchIndexEntryEntity>
{
    protected override void ConfigureEntity(EntityTypeBuilder<SearchIndexEntryEntity> builder)
    {
        builder.ToTable("search_index");

        builder.HasIndex(x => new { x.EntityType, x.EntityId }).IsUnique();
        builder.HasIndex(x => new { x.UserId, x.EntityType });

        builder.Property(x => x.EntityType).HasMaxLength(20).HasConversion<string>();
        builder.Property(x => x.Text).HasMaxLength(4000);
        builder.Property(x => x.ContentHash).HasMaxLength(64);
        builder.Property(x => x.Embedding).HasColumnType("vector(768)");
        builder.Property(x => x.EmbeddingModel).HasMaxLength(100);
    }
}
```

`768` is hard-coded in the column type because pgvector needs a fixed size at the schema level.
If you ever switch to a model with a different size, that's a migration *and* a config change
(`Ai:Embeddings:Dimensions`) — `IAiModelInfo.EmbeddingDimensions` is what catches a mismatch.

**Decision: no HNSW index yet.** Every search is filtered by `user_id`, and one user has at most
a few thousand rows across all three entity types combined. Postgres can use the
`(user_id, entity_type)` index and compute the exact distance for those rows in milliseconds, and
exact search never misses results. An approximate HNSW index applies the user filter *after*
the index scan, so it can return too few rows unless you enable pgvector's iterative scans. Add
one later only if `EXPLAIN ANALYZE` shows search getting slow:

```csharp
// later, if needed:
builder.HasIndex(x => x.Embedding).HasMethod("hnsw").HasOperators("vector_cosine_ops");
// and per search query: SET hnsw.iterative_scan = relaxed_order;
```

### Expose it on the DbContext

`Search.Application/Persistence/ISearchDbContext.cs`:

```csharp
public interface ISearchDbContext : IAppDbContextBase
{
    DbSet<SearchIndexEntryEntity> SearchIndex { get; }
}
```

`SearchDbContext` adds `public DbSet<SearchIndexEntryEntity> SearchIndex => Set<SearchIndexEntryEntity>();`
— the configuration is picked up by the existing `ApplyConfigurationsFromAssembly(...)` call.

### Enable pgvector in the DbContext

Only this module needs vectors. In `AddSearchPersistence`:

```csharp
services.AddDbContext<ISearchDbContext, SearchDbContext>(opt =>
    opt.UseNpgsql(
            connectionString,
            b =>
            {
                b.MigrationsAssembly(AssemblyReference.Assembly)
                    .MigrationsHistoryTable(HistoryRepository.DefaultTableName, SearchSchema.NAME);
                b.UseVector();                       // ← pgvector type mapping
                b.EnableRetryOnFailure(3, TimeSpan.FromSeconds(30), null);
            }
        )
        .UseSnakeCaseNamingConvention()
);
```

And in `SearchDbContext.OnModelCreating`:

```csharp
modelBuilder.HasDefaultSchema(Schema);
modelBuilder.HasPostgresExtension("vector");   // migration runs CREATE EXTENSION IF NOT EXISTS vector
modelBuilder.ApplyConfigurationsFromAssembly(AssemblyReference.Assembly);
```

Also add `UseVector()` to the design-time factory's `UseNpgsql(...)` call, or `dotnet ef` won't
understand the `vector` column.

### The migration

Create the first migration (`Search_Create`) from inside `Search.Infrastructure`, following
AGENTS.md. It should contain `CREATE EXTENSION IF NOT EXISTS vector` and the `search.search_index`
table with its two indexes and an `embedding vector(768)` column.

---

## ✅ Verify

1. `ollama list` shows `nomic-embed-text`.
2. The migration applies, `\dx` in psql lists the `vector` extension, and `\d search.search_index`
   shows `embedding | vector(768)` and the unique `(entity_type, entity_id)` index.
3. A throwaway test (or a scratch endpoint you delete afterwards) resolves
   `IEmbeddingGenerator<string, Embedding<float>>`, embeds
   `IEmbeddingTextFormatter.ForDocument("morning run")`, and gets back
   `IAiModelInfo.EmbeddingDimensions` (768) numbers.
4. Starting the API with `Ai:Embeddings:Model` removed fails at startup with a validation error.
5. The architecture tests pass: `dotnet test src/tests/Dailu.ArchitectureTests`.

Commit: `feat(search): module scaffold, AI client wiring, search_index table`.

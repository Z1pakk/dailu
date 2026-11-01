# Phase 1: foundation

Goal: the chat model runs locally, a new `ai-coach` module exists with its own AI client wiring,
and the API can reach it through `Microsoft.Extensions.AI`'s `IChatClient`. There are no
user-facing features yet.

This phase assumes **[the search module](../search/README.md) is already built** (at least
phase 1): Postgres and Ollama are already set up. `ai-coach` doesn't need pgvector itself —
conversations are plain relational data — but it configures its **own** AI client setup rather
than reusing `search`'s; see the decision below.

---

## Step 1.1: Add the packages to central package management

If `search` hasn't already added these to `Directory.Packages.props`, add them:

```xml
<!-- AI -->
<PackageVersion Include="Microsoft.Extensions.AI" Version="x.y.z" />
<PackageVersion Include="Microsoft.Extensions.AI.OpenAI" Version="x.y.z" />
<PackageVersion Include="OllamaSharp" Version="x.y.z" />
```

**Decision: `ai-coach` configures its own AI clients, duplicating `search`'s `AiOptions`/
`AiSetup.cs` instead of sharing a project.** They both end up binding the same `Ai:*` config
section with near-identical code. That's accepted duplication: it keeps each module's DI
composition fully self-contained, with no shared project the two have to version and deploy
together, and `Microsoft.Extensions.AI` clients are thin HTTP wrappers, so registering the same
provider twice costs nothing at runtime.

---

## Step 1.2: Pull the chat model

```bash
ollama pull qwen3:8b
```

Ollama itself is already installed and running from `search`'s foundation phase, listening on
`http://localhost:11434` — nothing new to install, just pull the model this module calls.

**Model choice:**
- `qwen3:8b` is a good free model for **tool calling**, which the coach depends on. Llama 3.1 8B
  is an alternative.
- Very small models (under about 4B) often ignore the tools or invent their arguments.

---

## Step 1.3: AI client wiring

`AiCoach.Infrastructure/Ai/AiOptions.cs`, following the repo's `SharedKernel.Options.IOptions`
pattern — the same shape as `search`'s copy, because they read the same config:

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
> model name should fail fast, not on the first message.

`AiCoach.Infrastructure/Ai/AiSetup.cs`. This is the only place in this module that knows which
provider is used — `Chat` is this module's main concern; `Embeddings` is registered too because
the guardrails hardening phase needs an `IEmbeddingGenerator`:

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
            .UseFunctionInvocation(configure: f =>
            {
                f.MaximumIterationsPerRequest = 6;      // stops runaway tool loops (phase 2)
                f.IncludeDetailedErrors = false;        // never send exception details to the model
            })
            .UseOpenTelemetry()                // spans + token metrics in your existing OTel setup
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

(Check the `FunctionInvokingChatClient` property names against your `Microsoft.Extensions.AI`
version — they've changed between releases.)

**Why `.UseX()` chains instead of one big constructor.** Each `Use...()` call wraps the client
returned so far in a decorator — a small object that implements the same `IChatClient` interface,
forwards the call to the one inside it, and adds one behavior on the way through. `UseLogging()`
logs, then calls the inner client; `UseOpenTelemetry()` starts a span, then calls *its* inner
client; `UseFunctionInvocation()` runs the entire tool-calling loop, calling the raw Ollama/OpenAI
client underneath for each turn. The result is a chain where **order changes behavior**, not just
which features are present — a decorator added *outside* `UseFunctionInvocation()` sees one call
per user turn (the whole tool loop looks like one logical request); a decorator added *inside* it
would see one call per tool invocation, several times per turn. That's exactly why a caching
layer belongs outside function invocation: added inside, it could return a stale or
wrong-user's tool result as if it were fresh.

Notes:
- `OllamaApiClient` implements both interfaces, so one class serves chat and embeddings.
- The pipeline order matters: `UseFunctionInvocation()` wraps the raw client. If you later add
  caching, put it **outside** function invocation so tool results are never cached across users.
- For OpenTelemetry spans to export, add the `Microsoft.Extensions.AI` activity source to the
  OTel setup in `Dailu.Api/DependencyInjection.cs`
  (`.AddSource("Experimental.Microsoft.Extensions.AI")`). Check the exact source name against
  your version.

### Configuration

`Dailu.Api/appsettings.json` — the defaults point at local Ollama (`search` already added the
`Embeddings` half of this section; add `Chat` next to it):

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

Both modules bind their own `AiOptions` to this same `"Ai"` section independently — one JSON
section, two unrelated option classes reading from it.

---

## Step 1.4: Scaffold the `ai-coach` module

Copy the shape of an existing module (for example `tag`) into `src/modules/ai-coach/`:

```
src/modules/ai-coach/
  AiCoach.Domain/          entities: Conversation, ConversationMessage
  AiCoach.Application/     commands/queries, tools, prompts, IAiCoachDbContext, IntegratedServices/*
  AiCoach.Infrastructure/  DbContext, EF configs, migrations, AI client wiring, Setup
  AiCoach.Api/             endpoint group /ai-coach
  AiCoach.Integrations/    adapters over Habit.DataTransfer / HabitEntry.DataTransfer / Search.DataTransfer
```

Checklist (mirror what `Tag.*` does):

1. Create the five projects and add them to `Dailu.slnx`. Copy the project references from the
   `Tag.*` csproj files, plus a reference to `Search.DataTransfer` from `AiCoach.Integrations`.
2. `AiCoach.Infrastructure/Database/Schema.cs` with `NAME = "ai_coach"`.
3. `AiCoachDbContext : AppDbContextBase, IAiCoachDbContext`, plus an
   `IDesignTimeDbContextFactory` copied from another module so `dotnet ef` works. No `UseVector()`
   needed here — that's only in `Search.Infrastructure`.
4. `Setup.cs` with `AddAiCoachPersistence` and `AddAiCoachModule` (which also calls
   `services.AddAiClients()` from step 1.3), following the pattern in
   `HabitUser.Infrastructure/Setup.cs`, with connection string name
   `AiCoachPostgresConnectionString`.
5. Register it in `src/api/Dailu.Api/Program.cs`: `.AddAiCoachModule(builder.Configuration)`.
6. Add the empty `AiCoachPostgresConnectionString` to `Dailu.Api/appsettings.json` like the
   others, and the real value to `appsettings.Development.json`
   (`Host=localhost:5460;Database=dailo;Username=dailo;Password=Dailo123!@;...`, matching
   `HabitPostgresConnectionString` and the rest — same docker-compose Postgres, same database).
7. Add the new assemblies to `src/tests/Dailu.ArchitectureTests/ModuleIsolationTests.cs` and add
   an `AiCoach.ArchitectureTests` project that copies `HabitUser.ArchitectureTests`. The
   isolation rules then check that `ai-coach` only reaches other modules through their
   `*.DataTransfer` projects — including `Search.DataTransfer`.

Create the first migration (`AiCoach_Create`) from inside `AiCoach.Infrastructure`, following
AGENTS.md. It will be empty until phase 2 adds the conversation tables. That's fine.

---

## Step 1.5: A temporary "ping" endpoint

Add a throwaway, authorized endpoint to prove the chat client resolves. Delete it after phase 2.

```csharp
group.MapGet("/ping", async (IChatClient chat, CancellationToken ct) =>
{
    var reply = await chat.GetResponseAsync("Reply with exactly: pong", cancellationToken: ct);
    return TypedResults.Ok(new { reply = reply.Text });
}).RequireAuthorization();
```

---

## ✅ Verify

1. `ollama list` shows `qwen3:8b` alongside `nomic-embed-text` from the search module.
2. The migration applies cleanly (even though it's empty).
3. `GET /ai-coach/ping` returns something like `{ "reply": "pong" }`.
4. The architecture tests pass: `dotnet test src/tests/Dailu.ArchitectureTests`, and specifically
   confirm `ai-coach` has no direct reference to `Search.Infrastructure` or `Search.Domain` —
   only `Search.DataTransfer`.

Commit: `feat(ai-coach): module scaffold, chat client wiring`.

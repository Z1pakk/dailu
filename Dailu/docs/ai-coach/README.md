# AI coach implementation guide

A step-by-step guide for adding AI features to Dailu: an **AI coach** that answers questions
about the user's own habits, **semantic search** over entry notes, **RAG** (retrieval-augmented
generation) so answers are grounded in that data, and **voice** input and output.

You implement it yourself, phase by phase. Each phase ends with a **Verify** step. Do it,
commit, then move on, because later phases assume the earlier ones work.

| Phase | File | What you end up with |
|---|---|---|
| 1 | [01-foundation.md](01-foundation.md) | Ollama + pgvector running locally, a new `ai-coach` module, provider-neutral AI clients wired through config |
| 2 | [02-indexing.md](02-indexing.md) | Entry notes are turned into embeddings and stored in Postgres automatically (the "R" in RAG) |
| 3 | [03-semantic-search.md](03-semantic-search.md) | `GET /ai-coach/search?q=...` plus a search box in the UI |
| 4 | [04-coach-chat.md](04-coach-chat.md) | A streaming chat coach that calls tools to read the user's habits, stats and notes |
| 5 | [05-voice.md](05-voice.md) | Push-to-talk input and spoken replies in the browser |
| 6 | [06-production.md](06-production.md) | A hosted free or low-cost provider in production, secrets, limits, monitoring |

---

## Decisions already made

These came out of the design discussion. Change them if you disagree, but they affect every phase.

| Decision | Choice | Why |
|---|---|---|
| AI abstraction | `Microsoft.Extensions.AI` (`IChatClient`, `IEmbeddingGenerator`) | The provider becomes a config value, not a code dependency |
| Local provider | **Ollama** (run by Aspire as a container) | Free and offline; no API key needed during development |
| Production provider | Any **OpenAI-compatible** hosted API with free or cheap models (chosen in phase 6) | Keeps cost low; switching providers only changes config |
| Vector store | **pgvector** inside the existing Postgres | No new database; vectors sit next to the relational data with the same backups |
| Embedding size | Fixed at **768** values | A pgvector index needs a fixed size. `nomic-embed-text` (local) outputs 768, and several hosted models can be asked for 768 |
| Coach behaviour | **Read-only**, scoped to the signed-in user, with saved conversations | Nothing the model does can change data; one user's data can never reach another user |
| "RAG" shape | **Tools + retrieval.** The model calls tools for structured stats and a `search_notes` tool for free text | Habit data is mostly numbers and dates, so tools answer "how consistent was I?" better than vector search; vectors fit the free-text notes |
| Voice | Browser **Web Speech API** (speech-to-text and text-to-speech) | Free, no server work; best in Chrome and Edge |
| Streaming | **Server-Sent Events** (`TypedResults.ServerSentEvents`, .NET 10) | The answer appears word by word; simpler than WebSockets or SignalR |

## How it fits together

```
 Angular                         Dailu.Api (modular monolith)                       Infra
 ───────                         ────────────────────────────                       ─────
 Coach page ──POST /ai-coach/conversations/{id}/messages (SSE)──►  AiCoach.Api
   ▲  mic 🎤 (Web Speech)                                            │
   │  speaker 🔊                                                     ▼
   │                                                   AiCoach.Application
   │                                                   ┌───────────────────────────┐
   └──────────── streamed text deltas ◄─────────────── │ IChatClient (+ tool calls)│──► Ollama / hosted LLM
                                                       │  tools:                   │
                                                       │   get_habits ──────────────┼─► Habit.DataTransfer
                                                       │   get_entries/get_stats ───┼─► HabitEntry.DataTransfer (new)
                                                       │   search_notes ────────────┼─► note_embeddings (pgvector)
                                                       └───────────────────────────┘
 Search box ──GET /ai-coach/search──► embed query ──► cosine search in pgvector

 HabitEntry module ──HabitEntryNoteChangedIntegrationEvent──► AiCoach handler ──► pending row
                                                              IndexingWorker ──► IEmbeddingGenerator ──► vector stored
```

## Concepts in one paragraph each

- **Embedding.** A list of numbers (here 768) that represents what a text *means*. Texts with
  similar meaning end up close together, so "went jogging in the rain" lands near "wet run
  this morning" even though they share no words.
- **Vector search.** Store the embeddings of all notes. To search, embed the query and ask
  Postgres (pgvector) for the stored vectors closest to it (cosine distance).
- **RAG.** Before the model answers, retrieve relevant data and put it in the prompt so the
  answer is based on facts, not guesses. Here the model *asks* for data by calling tools, which
  is called "agentic RAG".
- **Tool calling.** You describe C# methods to the model (name, parameters, description). The
  model replies "call `get_habit_stats` with these arguments"; your code runs the method and
  sends the result back; the model then writes the answer. `Microsoft.Extensions.AI` runs this
  loop for you (`UseFunctionInvocation()`).

## Prerequisites

- Docker running (Aspire starts the Ollama and Postgres containers).
- About 10 GB of free disk space for the models.
- A reasonably modern machine. `qwen3:8b` needs about 6 GB of RAM or VRAM. On a weak machine use
  `qwen3:4b` or `llama3.2:3b` (worse at tool calling, but they run).
- Enabling GPU support in Aspire (`WithGPUSupport()`) makes answers several times faster if you
  have an NVIDIA GPU.

## Conventions used in this guide

- Paths are relative to the repo root (`Dailu/`).
- Code follows the existing module patterns: vertical slices with Mediator commands and
  queries, typed `Id<T>`, snake_case tables, `Result` for errors.
- Snippets are **starting points**, not guaranteed to compile as-is. Library APIs move fast. If a
  method name doesn't compile, check the linked docs; the ones used here were checked against
  the September 2026 docs.
- Lines marked **Decision** are choices you can change without breaking later phases.

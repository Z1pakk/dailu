# AI coach implementation guide

A step-by-step guide for adding an **AI coach** to Dailu: a chat coach that answers questions
about the user's own habits, calling tools to read habit, entry, and search data, with saved
conversations, streaming replies, and voice input/output.

**Prerequisite: build the [search module](../search/README.md) first** (at least its phases
1–3). This guide doesn't index or search anything itself — the coach's `search_notes` tool calls
`Search.DataTransfer` for that. Semantic search over entry notes, and the plain search box, both
live there, not here; see that guide's README for why they're a separate module.

You implement it yourself, phase by phase. Each phase ends with a **Verify** step. Do it,
commit, then move on, because later phases assume the earlier ones work.

| Phase | File | What you end up with |
|---|---|---|
| 1 | [01-foundation.md](01-foundation.md) | Chat model pulled in Ollama, a new `ai-coach` module, wired to the shared AI client and to `Search.DataTransfer` |
| 2 | [02-coach-chat.md](02-coach-chat.md) | A streaming chat coach that calls tools to read the user's habits, stats, and search results |
| 3 | [03-voice.md](03-voice.md) | Push-to-talk input and spoken replies in the browser |
| 4 | [04-production.md](04-production.md) | A hosted free or low-cost provider in production, secrets, limits, monitoring |

### Post-launch hardening (optional)

Do these **after** phases 1–4 work end to end in production, not instead of them. Each one
reuses infrastructure the main stack already stood up — no new models, no new containers.

| Phase | File | What you end up with |
|---|---|---|
| 5 | [05-eval-regression.md](05-eval-regression.md) | A runnable eval harness replacing the manual "ask 10 questions" check, so prompt/model changes get a pass rate |
| 6 | [06-guardrails.md](06-guardrails.md) | A second line of defense against prompt injection and jailbreaks, reusing the shared embedding client |

Reranking the coach's `search_notes` results lives in the [search module's phase
4](../search/04-reranking.md) instead of here, since the plain search box benefits from the same
work — build it there once both modules exist.

When `ai-coach` starts reacting to other modules' integration events (e.g. deleting
conversations on account deletion), consume them through the inbox from the
[outbox/inbox guide](../outbox-inbox/README.md) — its phase 3.3 covers `ai-coach` specifically.

---

## Decisions already made

These came out of the design discussion. Change them if you disagree, but they affect every phase.

| Decision | Choice | Why |
|---|---|---|
| Module boundary | **Separate `search` and `ai-coach` modules**, not one `ai-coach` module doing both | The plain search box (over habits, tags, and notes) is a second, independent consumer of search — not something only the coach needs. Splitting avoids every search-quality change having to go through "coach" code |
| AI abstraction | `Microsoft.Extensions.AI` (`IChatClient`, `IEmbeddingGenerator`), each module wiring its own copy from the same config | The provider becomes a config value, not a code dependency; duplicating the small setup code keeps each module's DI self-contained instead of sharing a project |
| Local provider | **Ollama**, installed locally and run as its own process | Free and offline; no API key needed during development; not managed by Aspire or Docker for now |
| Production provider | Any **OpenAI-compatible** hosted API with free or cheap models (chosen in phase 4) | Keeps cost low; switching providers only changes config |
| "RAG" shape | **Tools + retrieval.** The model calls tools for structured stats and a `search_notes` tool that calls into the `search` module | Habit data is mostly numbers and dates, so tools answer "how consistent was I?" better than vector search; the `search` module's index covers the free-text side |
| Coach behaviour | **Read-only**, scoped to the signed-in user, with saved conversations | Nothing the model does can change data; one user's data can never reach another user |
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
                                                       │   get_entries/get_stats ───┼─► HabitEntry.DataTransfer
                                                       │   search_notes ────────────┼─► Search.DataTransfer (search module)
                                                       └───────────────────────────┘
```

## Concepts in one paragraph each

- **RAG (retrieval-augmented generation).** A chat model only knows what was in its training
  data plus whatever text is in its current prompt — it has no live connection to your
  database. "Augmenting" means pulling relevant facts into the prompt *before* asking for an
  answer, so the model is summarizing/reasoning over real data instead of generating a plausible-
  sounding guess from memory. The classic version embeds a document, searches it, and pastes the
  top matches into the prompt once, before the model ever runs. Here the model itself decides,
  mid-conversation, *what* it needs and *when* — asking "how many times did I run in September?"
  by calling `get_habit_stats` rather than you pre-fetching every possible fact up front. That
  model-driven variant is what "agentic RAG" means.
- **Tool calling, mechanically.** You hand the model a list of function *descriptions* — name,
  parameter names/types, a plain-English description of what each does — alongside the
  conversation. The model itself cannot execute code; what it does is pattern-match the user's
  question against those descriptions and emit a structured message that says, in effect, "call
  `get_habit_stats` with `fromDate=2026-09-01, toDate=2026-09-30`." Your application code reads
  that structured call, actually invokes the C# method, and feeds the return value back into the
  conversation as if it were a message. Only then does the model produce the text the user sees.
  `Microsoft.Extensions.AI`'s `UseFunctionInvocation()` (configured once in this module's own
  `AiSetup.cs`) automates that whole round trip — match → call → feed result back → ask again —
  so your code only has to supply the functions and their descriptions, not drive the loop.
  One practical consequence worth internalizing early: **the model only knows what the tool
  descriptions tell it.** A vague description ("gets stats") gets called at the wrong times or
  with wrong arguments; the tool rules in phase 2.3 exist because, for a small local model
  especially, the description *is* the API contract, not a comment on top of one.

## Prerequisites

- The [search module](../search/README.md) built through at least phase 3 — `ai-coach` depends
  on `Search.DataTransfer` for its `search_notes` tool. It does **not** depend on anything else
  from `search`; its own AI client setup is a separate, duplicated copy (phase 1).
- [Ollama](https://ollama.com) installed and running locally, with the chat model pulled (step
  1.1 of this guide's foundation phase).
- About 5 GB more free disk space for the chat model (on top of the embedding model from
  `search`).
- A reasonably modern machine. `qwen3:8b` needs about 6 GB of RAM or VRAM. On a weak machine use
  `qwen3:4b` or `llama3.2:3b` (worse at tool calling, but they run).
- Ollama uses your GPU automatically if it detects compatible drivers — no container toolkit
  needed since it isn't running in a container.

## Conventions used in this guide

- Paths are relative to the repo root (`Dailu/`).
- Code follows the existing module patterns: vertical slices with Mediator commands and
  queries, typed `Id<T>`, snake_case tables, `Result` for errors.
- Snippets are **starting points**, not guaranteed to compile as-is. Library APIs move fast. If a
  method name doesn't compile, check the linked docs; the ones used here were checked against
  the September 2026 docs.
- Lines marked **Decision** are choices you can change without breaking later phases.

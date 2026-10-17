# Search implementation guide

A step-by-step guide for a **unified search** module in Dailu: one index, one query path, over
habit names/descriptions, tags, and habit entry notes. It's a standalone module, not part of
`ai-coach` — the plain search box and the AI coach's `search_notes` tool are two different
consumers of the same index.

You implement it yourself, phase by phase. Each phase ends with a **Verify** step. Do it,
commit, then move on, because later phases assume the earlier ones work.

| Phase | File | What you end up with |
|---|---|---|
| 1 | [01-foundation.md](01-foundation.md) | Ollama + pgvector running locally, this module's own AI-client wiring, a new `search` module |
| 2 | [02-indexing.md](02-indexing.md) | Habits, tags, and entry notes are embedded and stored in one Postgres table, kept in sync by plain in-process integration event handlers |
| 3 | [03-search-endpoint.md](03-search-endpoint.md) | `GET /search?q=...` plus a search box in the UI, and `Search.DataTransfer` for other modules (ai-coach) to call |

### Post-launch hardening (optional)

| Phase | File | What you end up with |
|---|---|---|
| 4 | [04-reranking.md](04-reranking.md) | Search results reordered by an LLM, not just cosine distance — shared by the search box and the coach's tool |
| — | [Outbox/inbox guide](../outbox-inbox/README.md) | Index updates that survive crashes and provider outages, with embedding moved off the request path |

### Where this leaves `ai-coach`

The [ai-coach guide](../ai-coach/README.md) builds the chat coach on top of this module: its
`search_notes` tool calls `Search.DataTransfer` instead of owning any embeddings itself. Build
`search` first — phases 1–3 here are a prerequisite for ai-coach's coach-chat phase.

---

## Decisions already made

| Decision | Choice | Why |
|---|---|---|
| AI abstraction | `Microsoft.Extensions.AI` (`IEmbeddingGenerator`, and `IChatClient` for phase 4's reranking) | The provider becomes a config value, not a code dependency |
| AI client wiring | **Duplicated per module** — `search` and `ai-coach` each have their own `AiOptions`/`AiSetup.cs`, both reading the same `Ai:*` config keys | Keeps each module's DI composition fully self-contained; no shared project the two modules have to version and deploy together. The duplicated code is small and the clients are thin HTTP wrappers, so the cost is low |
| Local provider | **Ollama**, installed locally and run as its own process | Free and offline; no API key needed during development; not managed by Aspire or Docker for now |
| Vector store | **pgvector** inside the existing Postgres, under a `search` schema | No new database; vectors sit next to the relational data with the same backups |
| Embedding size | Fixed at **768** values | A pgvector index needs a fixed size; `nomic-embed-text` (local) outputs 768 |
| **Index shape** | **One table, one `entity_type` discriminator column** (`habit`, `tag`, `entry_note`) — not a separate table per entity type | One index writer, one query path, one place to add a fourth entity type later. The alternative (a table per type) means triplicating the indexing and query code for no real isolation benefit |
| Index updates | **Plain in-process event handlers that embed inline** — no outbox, inbox, or background worker yet | Smallest thing that works; costs some request latency and has no retry. The [outbox/inbox guide](../outbox-inbox/README.md) is the upgrade path |
| Ranking | **Vector-only first.** Add Postgres trigram (`pg_trgm`) scoring on top only if short-text results (habit/tag names) feel worse than plain keyword matching once you've used it for a while | Short strings like "Morning run" don't play to cosine similarity's strengths the way free-text notes do; don't build the hybrid path before you've felt the gap |
| Consumers | The plain search box (this module's own endpoint) **and** `ai-coach`'s `search_notes` tool, both through the same `ISearchService` | They must never drift into two different ranking behaviors for the same query |

## How it fits together

```
 Angular                         Dailu.Api (modular monolith)                       Infra
 ───────                         ────────────────────────────                       ─────
 Search box ──GET /search?q=&types=──► Search.Api ──► ISearchService ──► embed query ──► Ollama
                                                              │
                                                              ▼
                                                   cosine search in pgvector
                                                   (search.search_index, filtered by user_id)

 ai-coach's search_notes tool ──► Search.DataTransfer ──► same ISearchService

 Habit module    ──HabitChangedIntegrationEvent──────┐
 Tag module      ──TagChangedIntegrationEvent────────┼─► Search handlers (in-process, same request)
 HabitEntry mod. ──HabitEntryNoteChangedIntegrationEvent┘      │
                                                   ISearchIndexWriter ──► IEmbeddingGenerator ──► row + vector stored
```

## Concepts in one paragraph each

- **Embedding.** A neural network (the "embedding model") reads a piece of text and outputs a
  fixed-length list of numbers — here, 768 of them — called a vector. The model is trained so
  that texts with similar *meaning* produce vectors that are close together in that 768-dimensional
  space, and dissimilar texts produce vectors far apart. "went jogging in the rain" and "wet run
  this morning" share no words, but the model has learned that both describe the same kind of
  event, so their vectors land near each other. You can't read meaning off any single number in
  the list — only the *distance between two vectors* means anything.
- **Cosine distance, concretely.** Treat each 768-number vector as an arrow from the origin in
  768-dimensional space. Cosine distance measures the *angle* between two arrows, ignoring their
  length: `1 - cos(angle)`, so identical direction gives `0` (closest) and opposite direction
  gives `2` (ignore magnitude entirely). This module reports `Similarity = 1 - Distance`, so `1`
  means "same meaning" and values near `0` mean "unrelated." Why angle instead of straight-line
  distance? Embedding vectors from these models encode meaning mostly in *direction*, not length,
  so comparing angles is more reliable than comparing raw coordinate differences — this is a
  property of how the models are trained, not a universal rule for all vectors.
- **Vector search.** Store the embedding of everything searchable. To search, embed the query
  with the *same* model and ask Postgres (pgvector) for the stored vectors with the smallest
  cosine distance to it. Pgvector adds a `vector` column type and the `<=>` cosine-distance
  operator (wrapped here as `.CosineDistance(...)` by the EF Core provider) directly inside
  Postgres, so "find the 10 closest vectors" is one indexed SQL query, not an application-level
  loop over every row.
- **Entity-type discriminator.** This is the same idea as "single table inheritance": instead of
  a `habits_index`, `tags_index`, and `entry_notes_index` table that each need their own indexing
  and query code, one `search_index` table carries an `entity_type` column that says *what kind*
  of thing each row represents. The tradeoff is explicit: columns that only make sense for one
  type (`OccurredAtUtc` for notes) go nullable for the others. That's a small, visible cost for
  not tripling the indexing and query logic.

## Prerequisites

- [Ollama](https://ollama.com) installed and running locally (not started by Aspire or Docker
  for now).
- Docker running for Postgres (`docker-compose.yml`, already switched to a `pgvector/pgvector`
  image).
- About 1 GB of free disk space for the embedding model (`nomic-embed-text` is small).
- `ollama pull nomic-embed-text` before starting phase 2.

## Conventions used in this guide

- Paths are relative to the repo root (`Dailu/`).
- Code follows the existing module patterns: vertical slices with Mediator commands and
  queries, typed `Id<T>`, snake_case tables, `Result` for errors.
- Snippets are **starting points**, not guaranteed to compile as-is. Library APIs move fast. If a
  method name doesn't compile, check the linked docs.
- Lines marked **Decision** are choices you can change without breaking later phases.

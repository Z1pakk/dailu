# Search implementation guide

A step-by-step guide for a **unified search** module in Dailu: one index, one query path, over
habit names/descriptions, tags, and habit entry notes. It's a standalone module, not part of
`ai-coach` — the plain search box and the AI coach's `search_notes` tool are two different
consumers of the same index.

Search is **hybrid**: every query runs a *text* match (partial words, prefixes, typos — via
Postgres `pg_trgm`) and a *meaning* match (embeddings — via pgvector) over the same rows, and
merges the two result lists. Typing `runn` or `Runing` finds "Morning run"; typing
`exhausted` finds "completely drained after work".

You implement it yourself, phase by phase. Each phase ends with a **Verify** step. Do it,
commit, then move on, because later phases assume the earlier ones work.

| Phase | File | What you end up with |
|---|---|---|
| 1 | [01-foundation.md](01-foundation.md) | Ollama + pgvector + pg_trgm running locally, this module's own AI-client wiring, a new `search` module |
| 2 | [02-indexing.md](02-indexing.md) | Habits, tags, and entry notes are stored (text + embedding) in one Postgres table, kept in sync by plain in-process integration event handlers |
| 3 | [03-search-endpoint.md](03-search-endpoint.md) | `GET /search?q=...` with hybrid (partial/fuzzy text + semantic) matching, a search box in the UI, and `Search.DataTransfer` for other modules (ai-coach) to call |

### Post-launch hardening (optional)

| Phase | File | What you end up with |
|---|---|---|
| 4 | [04-reranking.md](04-reranking.md) | Search results reordered by an LLM, not just cosine distance — shared by the search box and the coach's tool |
| — | [RabbitMQ guide](../rabbitmq/README.md) | Indexing handlers consumed from a RabbitMQ queue in the background, with retries and a dead-letter queue — saves no longer wait for the embedding call |
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
| Ranking | **Hybrid from day one: `pg_trgm` text matching + pgvector semantic matching, merged with reciprocal rank fusion (RRF)** | Partial input (`runn`, `morn`) and typos (`Runing`) are a hard requirement for a search box, and embeddings are bad at both — a 4-letter fragment produces a noisy vector. Trigrams are bad at synonyms. Each covers the other's blind spot |
| Text matching | `pg_trgm` (`ILIKE '%q%'` substring match + `word_similarity` for typos), GIN `gin_trgm_ops` index on `text` | Ships with Postgres (contrib), no new service; case-insensitive out of the box; works on the same `text` column the embedding was built from, so no extra column |
| Short queries | Queries under **3 characters** skip the embedding call and run text matching only | One or two characters carry no meaning for an embedding model, and trigrams need ≥ 3 characters to say anything — a plain substring match is all that's useful |
| Degradation | If the embedding provider is down, search returns **text-only results** instead of an error | The text leg only needs Postgres; a search box that still finds "Morning run" while Ollama is restarting is better than a 503 |
| Consumers | The plain search box (this module's own endpoint) **and** `ai-coach`'s `search_notes` tool, both through the same `ISearchService` | They must never drift into two different ranking behaviors for the same query |

## How it fits together

```
 Angular                         Dailu.Api (modular monolith)                       Infra
 ───────                         ────────────────────────────                       ─────
 Search box ──GET /search?q=&types=──► Search.Api ──► ISearchService
                                                              │
                                    ┌─────────────────────────┴─────────────────────────┐
                                    ▼                                                   ▼
                        text leg (pg_trgm)                                semantic leg (pgvector)
                  text ILIKE '%q%' OR word_similarity                embed query ──► Ollama
                                    │                              cosine distance on embedding
                                    └──────────────► RRF merge ◄────────────────────────┘
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
- **Trigram matching.** `pg_trgm` splits text into overlapping 3-character chunks ("run" →
  `"  r"`, `" ru"`, `"run"`, `"un "`) and compares two strings by how many chunks they share.
  "Runing" and "Running" share most of their trigrams, so a typo still scores high, while
  "tired" and "exhausted" share none — the opposite strengths and weaknesses of embeddings.
  `word_similarity(q, text)` compares the query against the *best-matching part* of the text, so
  a short query isn't penalized for the text being long. A GIN index with `gin_trgm_ops` makes
  both `ILIKE '%q%'` and the similarity operators indexable.
- **Reciprocal rank fusion (RRF).** The two legs produce scores on unrelated scales (cosine
  similarity vs. trigram similarity), so adding them directly is meaningless. RRF ignores the raw
  scores and uses only each row's *position* in each list: `score = Σ 1 / (60 + rank)`. A row
  near the top of both lists beats a row at the top of only one, and no score calibration is
  needed when the embedding model changes.
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
  image). `pg_trgm` is a contrib extension that already ships in that image.
- About 1 GB of free disk space for the embedding model (`nomic-embed-text` is small).
- `ollama pull nomic-embed-text` before starting phase 2.

## Conventions used in this guide

- Paths are relative to the repo root (`Dailu/`).
- Code follows the existing module patterns: vertical slices with Mediator commands and
  queries, typed `Id<T>`, snake_case tables, `Result` for errors.
- Snippets are **starting points**, not guaranteed to compile as-is. Library APIs move fast. If a
  method name doesn't compile, check the linked docs.
- Lines marked **Decision** are choices you can change without breaking later phases.

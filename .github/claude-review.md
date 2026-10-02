# PR Review Guidelines

Instructions for Claude when reviewing pull requests in this repo.
Read `Dailu/AGENTS.md` first for the project architecture and conventions.

## What to focus on

Report real problems, most severe first:

1. **Correctness** — logic bugs, unhandled edge cases, null handling, off-by-one, wrong async usage (missing `await`, `async void`, blocking `.Result`/`.Wait()`).
2. **Security** — missing `[Authorize]`/auth checks on endpoints, a user able to read or modify another user's data, secrets in code, unsafe input passed to dynamic LINQ or raw SQL.
3. **Data and migrations** — EF migrations that drop or rename columns without preserving data, missing indexes on new foreign keys or filter columns, migration changes that don't match the entity configuration.
4. **Performance** — N+1 queries, loading whole tables into memory, missing `AsNoTracking()` on read-only queries, missing pagination.
5. **Architecture** — violations of the modular monolith rules below.

## Backend rules (.NET)

- Modules must not reference another module's Domain, Application, or Infrastructure projects. Cross-module communication goes through `*.DataTransfer`, `*.Integrations`, or events in `Dailu.Events`.
- Aggregates keep their state private and change it only through methods. Flag public setters on aggregates.
- Use the source-generated Mediator abstractions (`ICommand`, `IQuery`, handlers), not MediatR.
- Commands with user input need a FluentValidation validator.
- Use the typed IDs (`Id<T>`) instead of raw `Guid`/`int` for entity identifiers.
- Endpoints follow the existing `IEndpointGroup` / Minimal API patterns.
- New behavior in handlers or domain logic should have tests under `Dailu/src/tests`.

## Frontend rules (Angular)

- Use NGXS for shared state. Don't add ad-hoc services that duplicate store state.
- Use PrimeNG components and Tailwind classes instead of custom CSS where an equivalent exists.
- Validate forms with Valibot.
- Unsubscribe from observables (`takeUntilDestroyed`, `async` pipe) to avoid leaks.

## What NOT to comment on

- Formatting and whitespace (Prettier and the .NET analyzers handle this).
- Personal style preferences that don't affect correctness or readability.
- Generated files: EF migration `*.Designer.cs`, model snapshots, lock files.

## Output format

- Post **inline comments** on the exact lines for concrete issues. Explain what goes wrong and suggest a fix.
- Mark severity at the start of each comment: 🔴 must fix, 🟡 should fix, 🔵 suggestion.
- Don't invent problems. If nothing significant is found, say so briefly.

### Summary comment (required)

After the inline comments, always post **exactly one** top-level PR comment that summarizes the whole review. Use this template:

```markdown
## 🤖 Claude Review Summary

**Verdict:** ✅ Looks good / ⚠️ Changes suggested / ❌ Changes required

<1–2 sentence overview of what the PR does and its overall quality>

### 🔴 Must fix
- **<short title>** (`path/to/File.cs`) — <one line: problem and fix>

### 🟡 Should fix
- **<short title>** (`path/to/File.cs`) — <one line>

### 🔵 Suggestions
- **<short title>** (`path/to/File.cs`) — <one line>

### ✅ What's good
- <1–3 bullets on things done well, if any>
```

- Leave out any severity section that has no items.
- Each bullet is one line; the details belong in the inline comments.
- Verdict: ❌ if there is any 🔴, ⚠️ if only 🟡/🔵, ✅ if nothing to report.

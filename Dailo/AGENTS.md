# Dailo — Agent Guide

## Project Overview

Dailo is a habit-tracking application built with a modular monolith architecture on .NET 10 and an Angular SPA frontend. The backend is composed of vertical slice modules (Habit, Tag, Identity) that share infrastructure via `SharedKernel`. All modules are wired together in `Dailo.Api` and orchestrated locally via .NET Aspire.

---

## Backend Stack

| Concern | Technology |
|---|---|
| Runtime | .NET 10 |
| API layer | ASP.NET Core Minimal APIs (`IEndpointGroup`, `IEndpointWithoutRequest`) |
| CQRS | Mediator (source-generated, not MediatR) — `ICommand`, `IQuery`, `ICommandHandler`, `IQueryHandler` |
| ORM | Entity Framework Core 10 + Npgsql (PostgreSQL) |
| Naming convention | `EFCore.NamingConventions` — snake_case columns |
| Typed IDs | `StrictId` — `Id<T>` with EF value converters |
| Validation | FluentValidation |
| Auth | JWT Bearer (`Microsoft.AspNetCore.Authentication.JwtBearer`) + ASP.NET Core Identity |
| API docs | `Microsoft.AspNetCore.OpenApi` + Scalar UI |
| Observability | OpenTelemetry (ASP.NET Core, HTTP, Runtime, Npgsql) + OTLP exporter |
| Orchestration | .NET Aspire 13 (`Aspire.AppHost.Sdk`) |
| DI extras | Scrutor (assembly scanning) |
| Misc | `Humanizer.Core`, `System.Linq.Dynamic.Core`, `SystemTextJsonPatch` |

---

## Frontend Stack

| Concern | Technology |
|---|---|
| Framework | Angular 21 |
| State management | NGXS Store |
| UI components | PrimeNG 21 + PrimeIcons |
| Styling | Tailwind CSS 4 (`tailwindcss-primeui`) |
| Validation | Valibot |
| Formatting | Prettier + `prettier-plugin-angular` |

---

## Solution Structure

```
SharedKernel/          — base classes, interfaces, EF conventions, CQRS abstractions
  Domain/              — Aggregate base, IDomainEvent
  Entity/              — BaseEntity<T>, IEntity, IAuditableEntity, ISoftDeletableEntity
  Persistence/         — AppDbContextBase, interceptors, conventions, base configurations
  CQRS/                — ICommand, IQuery, ICommandHandler, IQueryHandler

Habit.Domain/          — domain layer for the Habit module
  Aggregates/          — HabitAggregate (rich domain model, private state, private setters)
  Entities/            — HabitEntity (EF persistence model), HabitTag
  ValueObjects/        — Frequency, Target, Milestone
  Enums/               — HabitType, HabitStatus, FrequencyType

Habit.Application/     — CQRS handlers, IHabitDbContext, application models
Habit.Infrastructure/  — HabitDbDbContext, EF configurations, migrations, Setup
Habit.Api/             — Minimal API endpoint groups

Tag.*/                 — same layered structure as Habit.*
Identity.*/            — same layered structure; uses ASP.NET Core Identity

Dailo.Api/             — composition root: wires all modules, auth, OpenTelemetry
Dailo.Infrastructure/  — cross-cutting infrastructure (if any)
Dailo.AppHost/         — .NET Aspire orchestration host
Dailo.ClientApp/       — Angular SPA
```

---

## Key Architectural Patterns

### Aggregate / Entity separation
Each domain aggregate (`HabitAggregate`) is a pure domain object with **all properties private**. It exposes only behavior methods and two mapping methods:
- `ToEntity()` — converts the aggregate to the EF persistence entity for saving
- `entity.ToAggregate()` — restores the aggregate from the entity after loading from DB

Queries read directly from the EF entity (`HabitEntity`) — no aggregate is needed for reads.

### CQRS
Commands go through the aggregate. Queries project the EF entity directly to DTOs.

### Migrations
Run `dotnet ef migrations add <Name>` from within the specific `*.Infrastructure` project directory. Each Infrastructure project contains a `IDesignTimeDbContextFactory` implementation that is picked up automatically — no `--project` or `--context` flags needed.

---

## Code Style

### Braces on `if` statements
Always use braces, even for single-line bodies. This is enforced as a build error (`IDE0011`).

**Bad:**
```csharp
if (result.IsFailure)
    return Result.BadRequest(result.Error!);

if (user is null)
    return null;
else
    return user.Name;

foreach (var item in items)
    Process(item);
```

**Good:**
```csharp
if (result.IsFailure)
{
    return Result.BadRequest(result.Error!);
}

if (user is null)
{
    return null;
}
else
{
    return user.Name;
}

foreach (var item in items)
{
    Process(item);
}
```

This applies to all control-flow statements: `if`, `else`, `else if`, `for`, `foreach`, `while`, `do`.

---

## Execution Plan

**User approval is REQUIRED before any implementation can begin. You MUST NOT make code changes without explicit user consent.**

For any non-trivial task (features, refactoring, multi-file changes, bug investigations):

1. **Generate a plan first** — analyze the codebase and create a detailed implementation plan.
2. **Present and wait for approval** — you are BLOCKED until the user explicitly accepts. Do not assume approval.
3. **The user may modify the plan** — wait for re-approval after every change. A modification is NOT implicit approval.
4. **Implement only after explicit acceptance** — proceed only on "approved", "accept", "proceed", "start", or "implement". Treat ambiguous responses as non-approval.

Simple tasks that do NOT require a plan:
- Single typo fixes, one-line changes, simple formatting corrections, adding missing imports, extracting/translating strings.

Do not generate summary `.md` or `plan.md` files unless explicitly requested.

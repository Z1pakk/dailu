# 006_cqrs

## Status
Accepted

## Context
The application follows clean architecture principles within each module. As business logic grows, a clear pattern is needed for organizing operations — distinguishing between actions that change state (commands) and actions that read state (queries). The pattern must integrate well with the modular monolith structure and support cross-cutting concerns like validation and event dispatching without polluting handlers.

Key requirements:
- Clear separation between reads and writes
- Handlers must be easy to locate and reason about in isolation
- Cross-cutting concerns (validation, event dispatching) must not be duplicated in every handler
- Minimal ceremony and infrastructure overhead

## Considered Options

1. **CQRS with Mediator (source-generated MediatR alternative)**
   - Pros:
     - Explicit separation of commands and queries via `ICommand<T>` / `IQuery<T>` interfaces
     - Source-generated dispatcher — no reflection at runtime, better performance than MediatR
     - Pipeline behaviors for cross-cutting concerns (validation, event dispatching) via `IPipelineBehavior<,>`
     - Each handler is a focused, single-responsibility class
     - Easy to test handlers in isolation without mocking a large service graph
   - Cons:
     - Adds indirection — a simple operation goes through command → mediator → handler
     - Source generation can be unfamiliar to developers new to the pattern
   - Use Case: Applications with complex business logic that benefit from explicit handler boundaries
   - Decision: **Accepted**

2. **Service Classes (Application Services)**
   - Pros:
     - Familiar pattern — service classes group related operations
     - Less indirection than mediator
   - Cons:
     - Services tend to grow into large classes with many dependencies (service bloat)
     - No built-in pipeline mechanism — cross-cutting concerns must be added manually or via decorators
     - Harder to enforce single-responsibility as features grow
   - Use Case: Simple CRUD apps with few cross-cutting concerns
   - Decision: **Rejected** — doesn't scale cleanly as the number of features grows

3. **Minimal API Handlers (no application layer)**
   - Pros:
     - Maximum simplicity — logic lives directly in endpoint handlers
   - Cons:
     - Mixes HTTP concerns with business logic
     - Impossible to test business logic without spinning up the HTTP layer
     - No reuse across different entry points (e.g., background jobs, event handlers)
   - Use Case: Tiny microservices with trivial logic
   - Decision: **Rejected** — violates clean architecture and testability requirements

## Decision
We use **CQRS with the `Mediator` library** (source-generated, not reflection-based). Commands and queries are defined in the Application layer; handlers are resolved by the mediator at runtime via source-generated dispatch tables.

Structure per feature:
```
Features/
  CreateHabit/
    CreateHabitCommand.cs        ← ICommand<Result<...>>
    CreateHabitCommandHandler.cs ← ICommandHandler<...>
    CreateHabitCommandValidator.cs
  GetHabits/
    GetHabitsQuery.cs            ← IQuery<Result<...>>
    GetHabitsQueryHandler.cs     ← IQueryHandler<...>
```

**Pipeline behaviors** handle cross-cutting concerns in order:
- `EventDispatchingBehavior` — dispatches domain and integration events collected during handler execution after `SaveChanges`

**Result pattern** (`Result<T>`) is used on all command and query return types to make failure an explicit part of the return type rather than relying on exceptions for control flow.

## Consequences

**Positive:**
- Each handler is a small, focused class with a clear single responsibility
- Pipeline behaviors eliminate duplicated cross-cutting logic across handlers
- Source generation means zero reflection overhead vs. MediatR
- Commands and queries are easily discoverable by feature folder
- Handlers can be invoked from endpoints, background jobs, and integration event handlers alike

**Negative:**
- More files per feature compared to service classes (one class per command/query)
- Developers unfamiliar with CQRS/mediator pattern need onboarding
- Pipeline behavior ordering must be managed carefully

**Impact:**
- All endpoint handlers send commands/queries via `ISender` — no direct service injection in endpoints
- Validation is enforced via `ICommandValidator` classes registered alongside handlers
- Domain events raised in aggregates are automatically dispatched after successful persistence via the pipeline behavior

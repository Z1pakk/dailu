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

### Test method naming

Use `MethodName_Should_Expectation` or `MethodName_When_Expectation_Should_Behavior`. Each segment is PascalCase.

**Good:**
```csharp
public void DomainLayer_Should_NotDependOnHigherLayers() { ... }
public void CreateHabit_When_NameIsEmpty_Should_ReturnValidationError() { ... }
public void GetHabits_Should_ReturnOnlyCurrentUsersHabits() { ... }
```

**Bad:**
```csharp
public void Domain_should_not_depend_on_higher_layers() { ... }
public void ShouldReturnError() { ... }
public void Test1() { ... }
```

### Adding npm packages

Never use `npm install <package>` to add a dependency. Instead:
1. Manually add the package and version to `package.json` under `dependencies` or `devDependencies`
2. Run `npm install` with no arguments

### File naming
Never suffix files with `.utils`, `.helpers`, `.util`, or `.helper`. Name files by what they contain.

**Bad:** `landing-hero-visual-card.utils.ts`, `auth.helpers.ts`
**Good:** `heat-cells.ts`, `date-formatters.ts`, `auth-tokens.ts`

### Braces on `if` statements
Always use braces, even for single-line bodies. Applies to **both C# and TypeScript**.

#### C# (enforced as build error `IDE0011`)

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

#### TypeScript / Angular

**Bad:**
```typescript
if (!user) return null;

if (isValid)
  doSomething();
else
  doOther();

for (const item of items)
  process(item);
```

**Good:**
```typescript
if (!user) {
  return null;
}

if (isValid) {
  doSomething();
} else {
  doOther();
}

for (const item of items) {
  process(item);
}
```

This applies to all control-flow statements in both languages: `if`, `else`, `else if`, `for`, `foreach`/`for...of`, `while`, `do`.

### No multi-condition ternaries (TypeScript)

A ternary with a single condition (`a ? b : c`) is fine. Chains of more than one condition must use `if`/`else` instead.

**Bad:**
```typescript
const intensity = isToday ? (r > 0.4 ? 2 : 1) : r < 0.35 ? 1 : r < 0.65 ? 2 : 3;
```

**Good:**
```typescript
let intensity: number;
if (isToday) {
  intensity = r > 0.4 ? 2 : 1;
} else if (r < 0.35) {
  intensity = 1;
} else if (r < 0.65) {
  intensity = 2;
} else {
  intensity = 3;
}
```

---

## Angular Modern Practices (Angular 17+)

Always use current Angular idioms. The project is on **Angular 21** — all APIs below are available and preferred.

### Dependency injection — `inject()` over constructor parameters

**Bad:**
```typescript
constructor(private store: Store, private router: Router) {}
```

**Good:**
```typescript
private readonly store = inject(Store);
private readonly router = inject(Router);
```

### Lifecycle cleanup — `DestroyRef` over `OnDestroy`

Never implement `OnDestroy` or write `ngOnDestroy`. Use `DestroyRef.onDestroy()` co-located with the resource it cleans up.

**Bad:**
```typescript
export class MyComponent implements OnDestroy {
  private sub = this.service.data$.subscribe(...);
  ngOnDestroy() { this.sub.unsubscribe(); }
}
```

**Good:**
```typescript
export class MyComponent {
  constructor() {
    const destroyRef = inject(DestroyRef);
    const sub = inject(MyService).data$.pipe(takeUntilDestroyed(destroyRef)).subscribe(...);
  }
}
```

For non-observable cleanup (RAF, DOM listeners, directive effects):
```typescript
constructor() {
  const destroyRef = inject(DestroyRef);
  const cleanup = someResource.register(...);
  destroyRef.onDestroy(cleanup);
}
```

### Post-render DOM setup — `afterNextRender()` over `ngAfterViewInit`

Use `afterNextRender()` (called in the constructor) whenever you need to access the DOM after the first render. It runs once, is SSR-safe, and replaces `ngAfterViewInit`.

**Bad:**
```typescript
ngAfterViewInit() {
  this.chart = new Chart(this.canvasRef.nativeElement, ...);
}
```

**Good:**
```typescript
constructor() {
  afterNextRender(() => {
    this.chart = new Chart(this.canvasRef().nativeElement, ...);
  });
}
```

### Template queries — signal-based over decorators

Replace `@ViewChild`, `@ViewChildren`, `@ContentChild`, `@ContentChildren` with their signal equivalents. They resolve synchronously and are available inside `afterNextRender`.

**Bad:**
```typescript
@ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
@ContentChildren(TabItem) tabs!: QueryList<TabItem>;
```

**Good:**
```typescript
private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
private readonly tabs = contentChildren(TabItem);
```

Access with `this.canvasRef()` — returns `undefined` until rendered, so always null-check inside `afterNextRender`.

### Inputs and outputs — signal-based over decorators

**Bad:**
```typescript
@Input() label = '';
@Input({ required: true }) value!: number;
@Output() changed = new EventEmitter<number>();
```

**Good:**
```typescript
readonly label = input('');
readonly value = input.required<number>();
readonly changed = output<number>();
```

Emit with `this.changed.emit(val)`.

### Reactive state — signals over RxJS subjects

Use `signal()` and `computed()` for component state. Only use `BehaviorSubject` when you specifically need an observable stream consumed by RxJS operators.

**Bad:**
```typescript
private _count$ = new BehaviorSubject(0);
count$ = this._count$.asObservable();
increment() { this._count$.next(this._count$.value + 1); }
```

**Good:**
```typescript
readonly count = signal(0);
increment() { this.count.update(n => n + 1); }
```

Convert an existing observable to a signal at the boundary: `toSignal(obs$, { initialValue: [] })`.

### Host bindings — `host: {}` over `@HostListener` / `@HostBinding`

**Bad:**
```typescript
@HostListener('click', ['$event']) onClick(e: Event) { ... }
@HostBinding('class.active') get isActive() { return this.active(); }
```

**Good:**
```typescript
@Directive({
  host: {
    '(click)': 'onClick($event)',
    '[class.active]': 'active()',
  },
})
```

### Directive composition — `hostDirectives` over manual DI wiring

Attach reusable directives to a component without touching the template:

```typescript
@Component({
  hostDirectives: [ParallaxContainerDirective, FocusTrapDirective],
})
export class MyComponent {
  private readonly parallax = inject(ParallaxContainerDirective);
}
```

Child components can inject the directive from a parent's `hostDirectives` via normal DI (use `{ optional: true }` if the parent context is not guaranteed).

### Control flow — `@if` / `@for` / `@switch` over structural directives

**Bad:**
```html
<div *ngIf="isVisible">...</div>
<li *ngFor="let item of items; trackBy: trackById">...</li>
```

**Good:**
```html
@if (isVisible) {
  <div>...</div>
}
@for (item of items; track item.id) {
  <li>...</li>
}
```

---

## Git & Version Control

**Never use git. Never commit.** Agents must not run any `git` commands (`git add`, `git commit`, `git push`, `git checkout`, etc.) at any point during implementation. The user manages all version control manually.

This applies to all agents, subagents, and plan execution skills — including commit steps in implementation plans. Skip any commit step in a plan and continue to the next step.

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

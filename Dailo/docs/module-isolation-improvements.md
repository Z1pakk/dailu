# Module isolation & microservice/Lambda-readiness improvements (punch list)

Gaps found reviewing the module structure against the goal of keeping modules
isolated, flexible, and cheap to extract into microservices or Lambda
functions later - not yet applied, tracked here so they don't get lost. What's
already solid: per-module Domain/Application/Infrastructure/Api layering,
`Dailu.ArchitectureTests/ModuleIsolationTests.cs` blocking cross-module inner-layer
references, the two sanctioned communication patterns from
`docs/adr/004_inter_module_communication.md` (integration events + integrated
services), schema-per-module in one Postgres instance, and per-module
`IDesignTimeDbContextFactory`s for independent migrations.

Grouped by *when it pays off*, not by size - some of this only matters once a
module actually gets cut loose.

## Do now - cheap, pays off even without a split

- [ ] **`DataTransfer` facade is missing on two of five modules.** Habit, Tag,
  and Identity each expose a `*.DataTransfer` project (e.g.
  `Habit.DataTransfer/Services/HabitDataTransferService.cs`) - a read-only
  facade returning module-owned models, the only thing another module may
  call. `HabitEntry` and `HabitUser` have no equivalent, so their "public API"
  is just whatever their Application layer happens to expose to an
  `Integrations` consumer. Add the same facade shape to both so every module's
  public surface is explicit and uniform.
- [ ] **`Dailo.Events` is the one shared-assembly exception to an otherwise
  strict no-shared-DTO discipline.** The integrated-services pattern
  deliberately duplicates DTOs/enums per consumer (see the in-progress
  `HabitAutomationFilterModel` and Github/GoogleHealth/Strava enum copies in
  both `Habit.DataTransfer` and `HabitEntry.Application`) - that duplication is
  exactly what buys extraction flexibility. `Dailo.Events` breaks that: every
  module directly project-references it for integration event contracts.
  Fine inside the monolith, but it's the one seam that would need a versioned
  package or per-consumer copies at extraction time. Write a short ADR
  addendum now stating this is an accepted, known exception - so it's a
  decision on record, not an oversight found later.
- [ ] **Confirm module composition in `Dailo.Api/DependencyInjection.cs` is
  purely additive** (each module wired in only via its own `Setup.cs`, e.g.
  `Habit.Integrations/Setup.cs`, `Habit.DataTransfer/Setup.cs`). If so, a host
  wired with a subset of modules' `Setup.cs` calls becomes a working preview of
  an extracted service, with zero changes to module code - the most direct
  lever for "flexible" composition.

## Do before extracting any specific module

- [ ] **Close the outbox gap.** `docs/adr/004_inter_module_communication.md`
  already flags this as future work: integration events dispatch in-memory via
  `Mediator.IPublisher` after `SaveChanges`, fire-and-forget, no retry/DLQ.
  Acceptable inside a monolith; if a real broker gets swapped in underneath
  before a transactional outbox exists, "rare in-process loss" becomes
  "at-least-once delivery over a network with a broker that assumes durability
  the app doesn't actually provide."
- [ ] **Audit integrated-service call sites for hidden cross-module
  transactional assumptions.** Spot-checked
  `Habit.Application/Features/CreateHabit/CreateHabitCommand.cs`: it calls
  `ITagService.GetByIdsAsync` (a separate read against Tag's facade) *before*
  `dbContext.SaveChangesAsync`, and already tolerates tags not found in that
  read rather than assuming atomicity with Tag's data - this one is already
  network-boundary-safe. Worth confirming the same holds at every other
  `IntegratedServices` call site before treating it as a project-wide
  guarantee.
- [ ] **Backfill missing `*.UnitTests` projects.** `HabitEntry`, `HabitUser`,
  and `Identity` have none, unlike `Habit.UnitTests` and `Tag.UnitTests`. Want
  regression coverage on a module before cutting it loose, not after.

## Only matters once a module actually splits - don't build ahead of it

- [ ] Swap `InMemoryIntegrationEventBus` for a real broker (SQS/EventBridge if
  Lambda-leaning, RabbitMQ/Kafka if microservices-leaning) - ADR 004 already
  designed the seam for this swap.
- [ ] Add idempotency handling once delivery becomes at-least-once.
- [ ] Extend trace-context propagation across the real network hop -
  OpenTelemetry is already wired in-process, so this is extending existing
  instrumentation, not adding new tooling.
- [ ] Physical DB separation (schema -> separate database/instance) - current
  schema-per-module-in-one-instance is the right intermediate step; don't split
  further until a module actually leaves.

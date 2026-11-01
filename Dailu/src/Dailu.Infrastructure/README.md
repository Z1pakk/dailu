# Dailu.Infrastructure

Host-level infrastructure for the Dailu API: everything that is configured **once per process**
rather than per module. `Dailu.Api` calls `AddInfrastructure()` from `Setup.cs`; the modules
are added separately with their own `Add*Module()` calls.

## Why it's a separate project

- **Modules can't reference it.** Only `Dailu.Api` and `Dailu.MigrationsRunner` do. So no module
  can depend on RabbitMQ, OpenTelemetry or the auth setup, and the project boundary enforces
  that without an extra architecture test.
- **Infrastructure decisions are made in one place.** Changing the event transport, the
  telemetry exporter or the auth scheme happens here. Modules see only the
  [SharedKernel](../shared/SharedKernel/README.md) interfaces.
- **It keeps [SharedInfrastructure](../shared/SharedInfrastructure/README.md) small.** That
  project reaches every module, so heavy host-only packages stay out of it.

## What belongs here

Belongs here:
- HTTP pipeline setup: JWT authentication, CORS, global exception handling, middleware
- Mediator pipeline behaviors: tracing, validation, logging
- Observability: OpenTelemetry tracing, metrics and logs
- Choosing the implementation behind a SharedKernel interface: `IIntegrationEventBus` →
  in-memory or RabbitMQ, `ICurrentUserService` → `CurrentUserService`
- The RabbitMQ connection, publisher and consumer workers, and the `AddRabbitMqConsumer<TModuleRoot>`
  helper. The calls for each module go in `Dailu.Api/Program.cs`, because the module marker
  types (e.g. `ISearchApplicationRoot`) live in `*.Application`, which this project can't see

Doesn't belong here:
- Anything a module's `*.Infrastructure` project calls or derives from, like
  `AppDbContextBase` or `AddValidateOptions<T>()`: put it in SharedInfrastructure
- Interfaces modules depend on, like `IIntegrationEventBus`: put them in SharedKernel
- Module-specific services, like the embedding client or GitHub API client: keep them in that
  module

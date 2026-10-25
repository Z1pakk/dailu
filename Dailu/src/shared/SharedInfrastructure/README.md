# SharedInfrastructure

Reusable infrastructure building blocks that **modules opt into** from their own
`*.Infrastructure` projects: the EF Core base context and conventions, handler registration,
endpoint mapping, options binding and the in-process event plumbing.

## Why it's a separate project

- **Modules need it, but not the host's setup.** Every module's `*.Infrastructure` project
  references this one to build its `DbContext`, register handlers and bind options. Those
  projects must not see host-wide concerns like auth, CORS, observability or the message broker,
  so that wiring lives in [Dailu.Infrastructure](../../Dailu.Infrastructure/README.md), which
  modules can't reference.
- **One implementation of cross-cutting persistence rules.** Auditing, soft delete and
  optimistic concurrency behave the same in every module's schema because they all come from
  here.

## What belongs here

Belongs here:
- Base classes a module derives from: `AppDbContextBase`, `BaseEntityConfiguration`
- EF conventions and interceptors every module gets: soft delete, auditing, versioning
- Helpers a module's `Setup.cs` calls: `AddHandlerAssembly<TModuleRoot>()`,
  `AddValidateOptions<T>()`, endpoint mapping
- Transport-agnostic event plumbing: `EventDispatcher`, `InMemoryIntegrationEventBus`
- Later, the outbox and inbox tables that a module enables with `UseOutbox`

Doesn't belong here:
- Pure interfaces with no implementation like `IIntegrationEventBus`: put them in
  [SharedKernel](../SharedKernel/README.md)
- Things the API host wires up once: RabbitMQ connection and consumers, JWT auth, CORS,
  OpenTelemetry. Put them in `Dailu.Infrastructure`
- Code only one module uses, like that module's `DbContext` or migrations

Every package added here reaches every module, so keep the dependency list short.

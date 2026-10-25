# SharedKernel

The contracts every layer of every module agrees on: base types, interfaces and small value
types. Almost nothing in here *does* anything.

## Why it's a separate project

- **Domain and Application projects can reference it.** `*.Domain` and `*.Application` must not
  depend on EF Core, ASP.NET hosting or a message broker. They depend on this project, and the
  infrastructure projects provide the implementations.
- **Keeps the dependency direction one way.** Everything points at `SharedKernel`, and
  `SharedKernel` points at nothing in the solution. A module can use `IIntegrationEventBus`
  without knowing whether events go in-memory or to RabbitMQ.

## What belongs here

Belongs here:
- Base types for the domain: `Aggregate`, `BaseEntity`
- Marker interfaces that infrastructure reacts to: `ISoftDeletableEntity`, `IAuditableEntity`
- Abstractions whose implementation lives elsewhere: `IIntegrationEventBus`,
  `ICurrentUserService`, `ICookieService`
- CQRS and event contracts: `ICommand`, `IQuery`, `IEventHandler<T>`
- Small shared value types: `Result`, `Result<T>`

Doesn't belong here:
- Anything that uses EF Core, `HttpContext`, a database or a broker: `AppDbContextBase`,
  `CurrentUserService`, `RabbitMqConnection`
- Integration event records like `TagNameChangedIntegrationEvent`: put them in `Dailu.Events`
- A type only one module uses, like a habit-specific enum: keep it in that module
- Helpers that register services in DI: put them in [SharedInfrastructure](../SharedInfrastructure/README.md)
  or [Dailu.Infrastructure](../../Dailu.Infrastructure/README.md)

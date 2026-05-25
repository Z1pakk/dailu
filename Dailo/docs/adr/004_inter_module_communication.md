# 004_inter_module_communication

## Status
Accepted

## Context
The application is a Modular Monolith (see ADR 002) with distinct modules: Habit, HabitEntry, Tag, HabitUser, and Identity. These modules must sometimes react to each other's state changes — for example, when a user is created in Identity, the HabitUser module must create a corresponding user profile.

Key requirements:
- Modules must not directly depend on each other's internals
- Cross-module communication must respect module boundaries
- Communication must be reliable within a single request lifecycle
- Solution must remain simple enough for a modular monolith (no distributed messaging overhead)

## Considered Options

1. **In-Process Integration Events via MediatR/Mediator**
   - Pros:
     - No additional infrastructure (no message broker)
     - Events dispatched in-process after domain event handling
     - Modules subscribe to events without knowing who published them
     - Shared `Dailo.Events` project defines the event contracts
     - Simple to debug and test — everything runs in the same process
   - Cons:
     - Not reliable across process boundaries (fire-and-forget within the same request)
     - If a handler fails, there is no automatic retry or dead-letter mechanism
     - Cannot scale individual modules independently
   - Use Case: Cross-module reactions that can tolerate eventual consistency within the request
   - Decision: **Accepted** for reactive cross-module flows

2. **Direct Service Calls via Interface (Integrated Services)**
   - Pros:
     - Synchronous and guaranteed — execution happens inline, result is available immediately
     - Easy to follow execution flow — no indirection through an event bus
     - Suitable when the calling module needs data from another module to complete its own operation
   - Cons:
     - Introduces a compile-time dependency between modules (via the interface contract)
     - Must be carefully scoped — only query-style calls; never direct DbContext or domain type sharing
   - Use Case: When a module needs guaranteed synchronous data from another module (e.g., Habit fetching Tag data during habit creation)
   - Decision: **Accepted** for synchronous cross-module queries where the result is needed inline

3. **Message Broker (RabbitMQ / Kafka)**
   - Pros:
     - Reliable delivery, retries, dead-letter queues
     - True decoupling — publisher and subscriber can be deployed independently
     - Enables future microservices migration with no code changes
   - Cons:
     - Requires additional infrastructure (broker, monitoring)
     - Significant operational overhead for a modular monolith at this stage
     - Adds latency and complexity to what are currently in-process calls
   - Use Case: Microservices or high-reliability distributed systems
   - Decision: **Rejected** — premature for current scale; can be adopted if modules are extracted to microservices

## Decision
We support **two communication patterns** depending on the nature of the cross-module interaction:

### Pattern 1 — Integration Events (reactive flows)
Used when a module needs to react to something that happened in another module, and the reaction does not need to complete within the originating operation.

Flow:
1. A command handler creates or modifies a domain aggregate, which raises **domain events**
2. The `EventDispatchingBehavior` pipeline behavior intercepts after `SaveChanges` and dispatches all collected events via `EventDispatcher`
3. `EventDispatcher` routes domain events to their in-process handlers and integration events to `InMemoryIntegrationEventBus`
4. `InMemoryIntegrationEventBus` publishes integration events via `Mediator.IPublisher`, allowing other modules to handle them as `INotification` subscribers
5. Integration event contracts live in the shared `Dailo.Events` project

### Pattern 2 — Integrated Services (synchronous queries)
Used when a module needs data from another module **inline** during its own operation, and the result must be available before the operation completes.

An interface (e.g., `ITagService`) is defined in the calling module's Application layer and injected as a dependency. The implementation lives in the calling module's Infrastructure layer and calls the target module's API or service — never its DbContext or domain types directly.

Example: `Habit.Application` defines `ITagService`; the implementation queries the Tag module to validate and resolve tag IDs during habit creation.

**Rule of thumb:**
- Use **integration events** when: the other module is reacting to a state change (user created → create profile)
- Use **integrated services** when: you need data from another module to complete your current operation (create habit → validate tag IDs exist)

## Consequences

**Positive:**
- No message broker infrastructure required
- Integration events keep modules decoupled for reactive flows — only the event shape is shared
- Integrated services provide guaranteed synchronous execution when needed without workarounds
- Pipeline behavior handles event dispatch automatically — command handlers stay clean
- Easy to migrate to a broker later: replace `InMemoryIntegrationEventBus` with a broker-backed implementation

**Negative:**
- Integration events have no guaranteed delivery — if a handler throws, the event is lost unless the entire transaction rolls back
- Integrated service interfaces introduce a compile-time dependency between modules — must be kept minimal
- No retry or dead-letter queue for event handlers — failures require manual investigation

**Impact:**
- Modules must never directly reference another module's DbContext or domain types
- Integrated service interfaces are defined in the calling module's Application layer, implemented in Infrastructure
- New reactive cross-module flows must use integration events in `Dailo.Events`
- New synchronous cross-module data needs must use an integrated service interface
- Future ADR should address outbox pattern if reliability guarantees become necessary

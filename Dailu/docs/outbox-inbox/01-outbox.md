# Phase 1: the outbox (publishing side)

Goal: a module that opts in writes its integration events into its own `outbox_messages` table
in the same transaction as the business change, and a background dispatcher publishes them with
retries and backoff. Modules that don't opt in behave exactly as today.

```
command ──► AppDbContextBase.SaveChangesAsync
              ├─ domain events      ──► _pendingEvents ──► EventDispatchingBehavior (in-process, as today)
              └─ integration events ──► outbox_messages rows   (UseOutbox = true only)
                                              │
                              OutboxDispatcherWorker<TDbContext>
                                claim due rows ──► scope per message ──► IIntegrationEventBus.PublishAsync
                                success ──► processed_at_utc = now
                                failure ──► attempts++, next_attempt_at_utc = now + backoff
```

---

## Step 1.1: The `OutboxMessage` entity

`src/shared/SharedKernel/Outbox/OutboxMessage.cs` — one row per integration event waiting to be
published. It's a plain class, so `SharedKernel` stays free of EF Core:

```csharp
public class OutboxMessage : BaseEntity<Id<OutboxMessage>>
{
    public required string Type { get; init; }          // stable event name, e.g. "HabitChangedIntegrationEvent"
    public required string Payload { get; init; }       // JSON-serialized event
    public DateTime OccurredAtUtc { get; init; }
    public DateTime NextAttemptAtUtc { get; set; }      // = OccurredAtUtc at first; pushed back on failure
    public DateTime? ProcessedAtUtc { get; set; }
    public int Attempts { get; set; }
    public string? LastError { get; set; }
}
```

EF configuration in `SharedInfrastructure/Outbox/OutboxMessageConfiguration.cs`, applied by each
opted-in module's `OnModelCreating` so the table lands in that module's schema:

```csharp
public sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("outbox_messages");                 // habit.outbox_messages, tag.outbox_messages, …
        builder.Property(x => x.Type).HasMaxLength(200);
        builder.Property(x => x.Payload).HasColumnType("jsonb");
        builder.Property(x => x.LastError).HasMaxLength(2000);
        builder.HasIndex(x => x.NextAttemptAtUtc)
            .HasFilter("processed_at_utc IS NULL");          // the dispatcher only ever scans unprocessed rows
    }
}
```

**Why a partial index.** Processed rows pile up (until step 1.6 purges them); the dispatcher only
cares about the handful that aren't. Filtering the index to `processed_at_utc IS NULL` keeps it
tiny no matter how big the table gets.

---

## Step 1.2: Write integration events to the outbox in `SaveChangesAsync`

`SharedInfrastructure/Persistence/AppDbContextBase.cs` gets an opt-in flag and splits the events
it already collects:

```csharp
// Override to true in a module's DbContext to route its integration events through the outbox.
protected virtual bool UseOutbox => false;

public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
{
    var entries = ChangeTracker.Entries<IHasDomainEvents>().Select(e => e.Entity).ToList();
    var events = entries.SelectMany(e => e.DomainEvents).ToList();
    entries.ForEach(e => e.ClearDomainEvents());

    if (UseOutbox)
    {
        foreach (var integrationEvent in events.OfType<IIntegrationEvent>())
        {
            EnqueueIntegrationEvent(integrationEvent);
        }
        events.RemoveAll(e => e is IIntegrationEvent);
    }

    _pendingEvents.AddRange(events);

    return await base.SaveChangesAsync(cancellationToken);
}

// For callers that publish an integration event without an aggregate (backfills, sync services).
public void EnqueueIntegrationEvent(IIntegrationEvent integrationEvent)
{
    if (!UseOutbox)
    {
        throw new InvalidOperationException($"{GetType().Name} does not use the outbox.");
    }

    var now = timeProvider?.GetUtcNow().UtcDateTime ?? DateTime.UtcNow;
    Set<OutboxMessage>().Add(new OutboxMessage
    {
        Type = IntegrationEventTypes.NameOf(integrationEvent.GetType()),
        Payload = JsonSerializer.Serialize(integrationEvent, integrationEvent.GetType()),
        OccurredAtUtc = now,
        NextAttemptAtUtc = now,
    });
}
```

That's the entire trick: the outbox rows are added to the change tracker right before
`base.SaveChangesAsync`, so they commit in the same transaction as the business change EF is
already saving. No explicit `BeginTransaction` needed.

**Integration events no longer reach `EventDispatcher` from an opted-in context**, because they
were removed from `_pendingEvents` above. `EventDispatcher` itself doesn't change: its
`IIntegrationEvent` branch still serves modules that haven't opted in, and direct
`eventDispatcher.SendAsync(...)` callers (Strava/Google Health/GitHub services). Moving those
callers onto the outbox is a per-caller choice in phase 3 — use `EnqueueIntegrationEvent` +
`SaveChangesAsync` instead of `SendAsync`.

Expose `EnqueueIntegrationEvent` on `IAppDbContextBase` so Application-layer code (backfills)
can reach it through the module's own db interface.

**Identity is the exception:** `IdentityDbContext` derives from `IdentityDbContext<…>`, not
`AppDbContextBase`, and has its own copy of this `SaveChangesAsync` logic. If `identity` ever
opts in, mirror the change there.

In each opted-in module's DbContext:

```csharp
protected override bool UseOutbox => true;

protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    // … existing configuration …
    modelBuilder.ApplyConfiguration(new OutboxMessageConfiguration());
}
```

---

## Step 1.3: A stable name → type registry

The dispatcher has to turn `Type` back into a CLR type. `src/shared/Dailu.Events/IntegrationEventTypes.cs`:

```csharp
public static class IntegrationEventTypes
{
    private static readonly FrozenDictionary<string, Type> ByName = typeof(IntegrationEventTypes).Assembly
        .GetTypes()
        .Where(t => t is { IsClass: true, IsAbstract: false } && typeof(IIntegrationEvent).IsAssignableFrom(t))
        .ToFrozenDictionary(t => t.Name);

    public static string NameOf(Type type) => type.Name;

    public static Type Resolve(string name) =>
        ByName.TryGetValue(name, out var type)
            ? type
            : throw new InvalidOperationException($"Unknown integration event type '{name}'.");
}
```

**Decision: the class name is the wire name.** It's short and readable in SQL. The cost: renaming
an event class orphans any unprocessed rows still carrying the old name — they'll fail with
"Unknown integration event type" and park after max attempts. Treat event class names (and their
property names, since the payload is JSON) as a public contract: add new events instead of
renaming, and only add optional properties to existing ones. If that gets restrictive, switch to
an explicit `[IntegrationEventName("habit.changed.v1")]` attribute.

---

## Step 1.4: Carry the message id to handlers

Consumers need a stable id to deduplicate on (phase 2). The event records are positional and
used everywhere, so rather than adding a `MessageId` to every one of them, the dispatcher sets a
scoped ambient value that only interested handlers read — same idea as `ICurrentUserService`.

`src/shared/SharedKernel/Event/IIntegrationMessageContext.cs`:

```csharp
public interface IIntegrationMessageContext
{
    Guid? MessageId { get; }    // null when the event came through the in-memory path
}

public interface IIntegrationMessageContextSetter
{
    void Set(Guid messageId);
}
```

`src/shared/SharedInfrastructure/Event/IntegrationMessageContext.cs` implements both. Register
one scoped instance under both interfaces in `Dailu.Infrastructure/CQRS/Setup.cs`:

```csharp
services.AddScoped<IntegrationMessageContext>();
services.AddScoped<IIntegrationMessageContext>(sp => sp.GetRequiredService<IntegrationMessageContext>());
services.AddScoped<IIntegrationMessageContextSetter>(sp => sp.GetRequiredService<IntegrationMessageContext>());
```

Handlers depend on `IIntegrationMessageContext` only, so they can't call `Set` by accident.

---

## Step 1.5: The dispatcher worker

`SharedInfrastructure/Outbox/OutboxDispatcherWorker.cs`, generic over the module's concrete
DbContext, same `PeriodicTimer` + `IServiceScopeFactory` shape as `StravaActivityWorker`:

```csharp
public sealed class OutboxDispatcherWorker<TDbContext>(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    ILogger<OutboxDispatcherWorker<TDbContext>> logger
) : BackgroundService where TDbContext : DbContext
{
    private const int BatchSize = 50;
    private const int MaxAttempts = 10;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5), timeProvider);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await DispatchBatchAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Outbox dispatch for {DbContext} failed", typeof(TDbContext).Name);
            }
        }
    }

    private async Task DispatchBatchAsync(CancellationToken ct)
    {
        using var outboxScope = scopeFactory.CreateScope();
        var db = outboxScope.ServiceProvider.GetRequiredService<TDbContext>();
        var now = timeProvider.GetUtcNow().UtcDateTime;

        var batch = await db.Set<OutboxMessage>()
            .Where(x => x.ProcessedAtUtc == null && x.Attempts < MaxAttempts && x.NextAttemptAtUtc <= now)
            .OrderBy(x => x.OccurredAtUtc)
            .Take(BatchSize)
            .ToListAsync(ct);

        foreach (var message in batch)
        {
            try
            {
                var eventType = IntegrationEventTypes.Resolve(message.Type);
                var @event = (IIntegrationEvent)JsonSerializer.Deserialize(message.Payload, eventType)!;

                // Fresh scope per message: handlers get their own DbContexts, so a half-done
                // handler can't leak tracked changes into the next message's SaveChanges.
                using var handlerScope = scopeFactory.CreateScope();
                handlerScope.ServiceProvider.GetRequiredService<IIntegrationMessageContextSetter>()
                    .Set(message.Id.Value);
                await handlerScope.ServiceProvider.GetRequiredService<IIntegrationEventBus>()
                    .PublishAsync(@event, ct);

                message.ProcessedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
                message.LastError = null;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                message.Attempts++;
                message.LastError = ex.ToString()[..Math.Min(ex.ToString().Length, 2000)];
                message.NextAttemptAtUtc = now + Backoff(message.Attempts);

                if (message.Attempts >= MaxAttempts)
                {
                    logger.LogError(ex, "Outbox message {Id} ({Type}) parked after {Attempts} attempts",
                        message.Id, message.Type, message.Attempts);
                }
            }

            await db.SaveChangesAsync(ct);    // per message, so one success is never lost to a later crash
        }
    }

    // 10s, 20s, 40s, … capped at 30 min — survives a provider outage of an hour or so.
    private static TimeSpan Backoff(int attempts) =>
        TimeSpan.FromSeconds(Math.Min(10 * Math.Pow(2, attempts - 1), 1800));
}
```

Things to get right:

- **Order is per module, best effort.** Rows are published oldest first, but a failing row backs
  off while later rows go ahead. Consumers must not assume ordering — the events in this codebase
  carry the full current state (name, archived flag, …), so the last write wins naturally. Keep
  new events shaped that way ("here's the current state") rather than as deltas ("name changed
  from X").
- **No signed-in user.** Handlers now run in a worker scope, not an HTTP request. Anything that
  reads `ICurrentUserService` — including `*.DataTransfer` services that filter by the current
  user — gets nothing. Handlers must take the user id from the event payload.
- **Parked messages are the dead letter queue.** A row with `attempts >= MaxAttempts` and
  `processed_at_utc IS NULL` is never retried automatically. Inspect and requeue by hand:
  ```sql
  SELECT id, type, attempts, last_error FROM habit.outbox_messages
  WHERE processed_at_utc IS NULL AND attempts >= 10;

  UPDATE habit.outbox_messages SET attempts = 0, next_attempt_at_utc = now()
  WHERE id = '<id>';
  ```
- **Several app instances:** two dispatchers would claim the same rows. Then claim with raw SQL
  `SELECT … FOR UPDATE SKIP LOCKED` inside a transaction. With a single instance (today's setup)
  it isn't needed — the inbox would make the duplicates harmless anyway, just wasteful.

Register it with a small extension in `SharedInfrastructure/Outbox/OutboxSetup.cs`:

```csharp
public static IServiceCollection AddOutbox<TDbContext>(this IServiceCollection services)
    where TDbContext : DbContext
    => services.AddHostedService<OutboxDispatcherWorker<TDbContext>>();
```

and call `services.AddOutbox<HabitDbContext>()` from each opted-in module's `Setup.cs` (phase 3).

---

## Step 1.6: Purge processed rows

Processed rows are only useful for debugging for a few days. Add a purge to the same worker,
once an hour, or a separate worker shaped like `IntegrationSyncLogCleanupWorker`:

```csharp
await db.Set<OutboxMessage>()
    .Where(x => x.ProcessedAtUtc != null && x.ProcessedAtUtc < now.AddDays(-7))
    .ExecuteDeleteAsync(ct);
```

Never purge parked rows automatically — they're the evidence you need to fix the handler.

---

## ✅ Verify

Do this against one module (e.g. `habit`, phase 3.1) once it's opted in:

1. Rename a habit:
   ```sql
   SELECT type, attempts, processed_at_utc FROM habit.outbox_messages
   ORDER BY occurred_at_utc DESC LIMIT 1;
   ```
   shows `HabitChangedIntegrationEvent | 0 | <null>` right after the request, then a timestamp
   within ~5 s.
2. Make a command that raises an event fail *after* raising it (throw before `SaveChangesAsync`).
   No outbox row appears — the event can't exist without the change.
3. Rename a habit and kill the API process within 5 s. On restart the row is still unprocessed,
   then gets processed and the consumer reacts — the event survived the crash.
4. Make a consumer handler throw. The row's `attempts` climbs, `next_attempt_at_utc` moves out
   (10 s, 20 s, 40 s…), `last_error` has the stack trace, and the original request still
   returned `200`.
5. A module that hasn't opted in (e.g. `identity` → `habit-user` on sign-up) still works exactly
   as before.

Commit: `feat(shared): transactional outbox with background dispatcher`.

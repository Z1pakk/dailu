using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using SharedInfrastructure.Persistence.Conventions;
using SharedInfrastructure.Persistence.Interceptors;
using SharedKernel.Domain;
using SharedKernel.Event;
using SharedKernel.User;

namespace SharedInfrastructure.Persistence;

public abstract class AppDbContextBase(
    DbContextOptions options,
    ICurrentUserService? currentUserService = null,
    TimeProvider? timeProvider = null
) : DbContext(options)
{
    private readonly List<IEvent> _pendingEvents = [];

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.AddInterceptors(new VersionInterceptor());

        if (currentUserService is not null && timeProvider is not null)
        {
            optionsBuilder.AddInterceptors(new AuditInterceptor(currentUserService, timeProvider));
        }

        base.OnConfiguring(optionsBuilder);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);

        configurationBuilder.Conventions.Add(_ => new TablePluralizationConvention());
        configurationBuilder.Conventions.Add(_ => new DefaultStringLengthConvention());
        configurationBuilder.Conventions.Add(_ => new SoftDeleteConvention());
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var entries = ChangeTracker.Entries<IHasDomainEvents>().Select(e => e.Entity).ToList();

        _pendingEvents.AddRange(entries.SelectMany(e => e.DomainEvents));
        entries.ForEach(e => e.ClearDomainEvents());

        return await base.SaveChangesAsync(cancellationToken);
    }

    public IReadOnlyList<IEvent> ConsumeEvents()
    {
        var events = _pendingEvents.ToList();
        _pendingEvents.Clear();
        return events;
    }

    public async Task ExecuteTransactionalAsync(
        Func<Task> action,
        CancellationToken cancellationToken = default
    )
    {
        var strategy = CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken
            );
            try
            {
                await action();
                await SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }

    public Task<T> ExecuteTransactionalAsync<T>(
        Func<Task<T>> action,
        CancellationToken cancellationToken = default
    )
    {
        var strategy = CreateExecutionStrategy();
        return strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken
            );
            try
            {
                var result = await action();
                await SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return result;
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }

    private IExecutionStrategy CreateExecutionStrategy() => Database.CreateExecutionStrategy();
}

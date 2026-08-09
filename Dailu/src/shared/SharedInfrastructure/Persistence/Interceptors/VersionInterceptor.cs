using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SharedKernel.Entity;

namespace SharedInfrastructure.Persistence.Interceptors;

public sealed class VersionInterceptor : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default
    )
    {
        if (eventData.Context is not null)
        {
            UpdateVersionForModifiedEntities(eventData.Context);
        }

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result
    )
    {
        if (eventData.Context is not null)
        {
            UpdateVersionForModifiedEntities(eventData.Context);
        }

        return base.SavingChanges(eventData, result);
    }

    private static void UpdateVersionForModifiedEntities(DbContext context)
    {
        var modifiedEntries = context
            .ChangeTracker.Entries<IEntityVersion>()
            .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified);

        foreach (var entry in modifiedEntries)
        {
            entry.Entity.Version = Guid.NewGuid();
        }
    }
}

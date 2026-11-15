using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using StrictId;

namespace HabitUser.Application.Features.Integration.SyncLogs;

public static class IntegrationSyncCooldown
{
    /// <summary>Minimum gap between syncs of one integration when a user asks for one manually.</summary>
    public static readonly TimeSpan ManualSyncCooldown = TimeSpan.FromMinutes(1);

    public const string ManualSyncCooldownError =
        "This integration synced less than a minute ago. Please try again shortly.";

    // Any sync counts, including the background worker's, so a manual sync right after it is skipped too.
    public static Task<bool> IsSyncOnCooldownAsync(
        this IHabitUserDbContext dbContext,
        Id<IntegrationConfigEntity> integrationConfigId,
        DateTime utcNow,
        CancellationToken cancellationToken = default
    )
    {
        var threshold = utcNow - ManualSyncCooldown;
        return dbContext.IntegrationSyncLogs.AnyAsync(
            l => l.IntegrationConfigId == integrationConfigId && l.StartedAtUtc > threshold,
            cancellationToken
        );
    }
}

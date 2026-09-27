using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using StrictId;

namespace HabitUser.Application.Features.Integration.SyncLogs;

public static class IntegrationSyncLogWriter
{
    public static void AddSyncLog(
        this IHabitUserDbContext dbContext,
        Id<IntegrationConfigEntity> integrationConfigId,
        DateTime startedAtUtc,
        DateTime finishedAtUtc,
        DateTime? syncedFromUtc,
        int activitiesCount,
        string? errorMessage
    )
    {
        dbContext.IntegrationSyncLogs.Add(
            new IntegrationSyncLogEntity
            {
                Id = Id<IntegrationSyncLogEntity>.NewId(),
                IntegrationConfigId = integrationConfigId,
                StartedAtUtc = startedAtUtc,
                FinishedAtUtc = finishedAtUtc,
                SyncedFromUtc = syncedFromUtc,
                Status =
                    errorMessage is null
                        ? IntegrationSyncStatus.Success
                        : IntegrationSyncStatus.Failed,
                ActivitiesCount = activitiesCount,
                ErrorMessage = Truncate(errorMessage),
            }
        );
    }

    private static string? Truncate(string? value) =>
        value is { Length: > IntegrationSyncLogEntity.ErrorMessageMaxLength }
            ? value[..IntegrationSyncLogEntity.ErrorMessageMaxLength]
            : value;
}

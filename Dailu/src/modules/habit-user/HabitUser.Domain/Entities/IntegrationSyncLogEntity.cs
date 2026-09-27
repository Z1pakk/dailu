namespace HabitUser.Domain.Entities;

public class IntegrationSyncLogEntity : BaseEntity<Id<IntegrationSyncLogEntity>>
{
    public const int ErrorMessageMaxLength = 1000;

    public required Id<IntegrationConfigEntity> IntegrationConfigId { get; set; }

    public virtual IntegrationConfigEntity IntegrationConfig { get; set; } = null!;

    public required DateTime StartedAtUtc { get; set; }

    public required DateTime FinishedAtUtc { get; set; }

    public required IntegrationSyncStatus Status { get; set; }

    public int ActivitiesCount { get; set; }

    public DateTime? SyncedFromUtc { get; set; }

    public string? ErrorMessage { get; set; }
}

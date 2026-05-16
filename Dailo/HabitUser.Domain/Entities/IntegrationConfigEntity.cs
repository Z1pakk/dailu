using HabitUser.Domain.Integrations;

namespace HabitUser.Domain.Entities;

public class IntegrationConfigEntity : BaseEntity<Id<IntegrationConfigEntity>>
{
    public required Id<HabitUserEntity> HabitUserId { get; set; }

    public virtual HabitUserEntity HabitUser { get; set; } = null!;

    public required IntegrationProvider Provider { get; set; }
    public required IntegrationConfig Config { get; set; }
}

namespace HabitUser.Domain.Entities;

public class HabitUserEntity : BaseEntity<Id<HabitUserEntity>>
{
    public required Guid IdentityUserId { get; set; }

    public virtual ICollection<IntegrationConfigEntity> IntegrationConfigs { get; set; } = [];
}

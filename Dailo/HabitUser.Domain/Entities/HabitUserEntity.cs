namespace HabitUser.Domain.Entities;

public sealed class HabitUserEntity : BaseEntity<Id<HabitUserEntity>>
{
    public required Guid IdentityUserId { get; set; }
}

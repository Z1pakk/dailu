using HabitUser.Domain.Aggregates;

namespace HabitUser.Domain.Entities;

public sealed class HabitUserEntity : BaseEntity<Id<HabitUserEntity>>
{
    public required Guid IdentityUserId { get; set; }

    public HabitUserAggregate ToAggregate() => HabitUserAggregate.Restore(this);
}

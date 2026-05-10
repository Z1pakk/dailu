using HabitUser.Domain.Entities;

namespace HabitUser.Domain.Aggregates;

public sealed class HabitUserAggregate : Aggregate
{
    private Id<HabitUserAggregate> Id { get; set; }

    private Guid IdentityUserId { get; set; }

    private HabitUserAggregate() { }

    public static HabitUserAggregate Create(Guid identityUserId) =>
        new()
        {
            Id = Id<HabitUserAggregate>.NewId(),
            IdentityUserId = identityUserId,
        };

    internal static HabitUserAggregate Restore(HabitUserEntity entity) =>
        new()
        {
            Id = entity.Id.ToId(),
            IdentityUserId = entity.IdentityUserId,
        };

    public HabitUserEntity ToEntity() =>
        new()
        {
            Id = Id.ToId(),
            IdentityUserId = IdentityUserId,
        };
}

using StrictId;

namespace Habit.Domain.Entities;

public class HabitTagEntity : BaseEntity<Id<HabitTagEntity>>
{
    public required Id<HabitEntity> HabitId { get; set; }

    public required Id TagId { get; set; }

    public required Guid UserId { get; set; }

    public virtual HabitEntity Habit { get; set; } = null!;
}

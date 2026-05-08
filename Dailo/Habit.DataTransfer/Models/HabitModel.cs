using StrictId;

namespace Habit.DataTransfer.Models;

public class HabitModel
{
    public required Id<HabitModel> Id { get; set; }

    public required string Name { get; set; }
}
using Habit.Domain.Enums;
using StrictId;

namespace Habit.DataTransfer.Models;

public class HabitModel
{
    public required Id<HabitModel> Id { get; set; }

    public required string Name { get; set; }

    public required HabitType Type { get; set; }
}
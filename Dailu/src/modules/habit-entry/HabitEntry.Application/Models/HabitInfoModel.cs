using HabitEntry.Application.Enums;
using StrictId;

namespace HabitEntry.Application.Models;

public record HabitInfoModel(Id HabitId, string Name, HabitType HabitType);

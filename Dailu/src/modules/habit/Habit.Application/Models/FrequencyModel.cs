using Habit.Domain.Enums;

namespace Habit.Application.Models;

public sealed record FrequencyModel(FrequencyType Type, int TimesPerPeriod);

using DevHabit.Api.Entities;
using Microsoft.AspNetCore.Mvc;

namespace DevHabit.Api.DTOs.Habits;

public sealed record HabitsQueryParameters
{
    [FromQuery(Name = "q")]
    public string? SearchQuery { get; set; }
    public HabitStatus? Status { get; set; }
    public HabitType? Type { get; set; }
    public string? Sort { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

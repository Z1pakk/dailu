namespace HabitUser.Strava.Models;

public sealed record StravaActivityModel(
    long Id,
    string Name,
    string Type,
    DateTime StartDateUtc,
    float Distance,
    int MovingTime,
    string? Description = null
);

namespace HabitUser.GoogleHealth.Models;

public sealed record GoogleHealthActivityModel(
    string Id,
    string ExerciseType,
    string? DisplayName,
    DateTime StartDateUtc,
    DateTime EndDateUtc,
    int ActiveDurationSeconds
);

namespace HabitUser.Application.Features.Strava.Models;

public sealed record StravaAthleteModel(
    long Id,
    string Username,
    string FirstName,
    string LastName,
    string ProfileUrl
);

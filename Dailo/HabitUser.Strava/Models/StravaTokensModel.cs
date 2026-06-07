namespace HabitUser.Strava.Models;

public sealed record StravaTokensModel(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAtUtc,
    StravaAthleteModel? Athlete = null
);

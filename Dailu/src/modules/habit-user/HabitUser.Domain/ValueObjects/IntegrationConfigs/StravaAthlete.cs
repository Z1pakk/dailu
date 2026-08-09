namespace HabitUser.Domain.ValueObjects.IntegrationConfigs;

public sealed record StravaAthlete(
    long Id,
    string Username,
    string FirstName,
    string LastName,
    string ProfileUrl
);

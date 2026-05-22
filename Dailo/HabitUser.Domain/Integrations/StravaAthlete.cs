namespace HabitUser.Domain.Integrations;

public sealed record StravaAthlete(
    long Id,
    string Username,
    string FirstName,
    string LastName,
    string ProfileUrl
);

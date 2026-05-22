namespace HabitUser.Domain.Integrations;

public sealed record StravaIntegrationConfig(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAtUtc,
    StravaAthlete? Athlete = null
) : IntegrationConfig;

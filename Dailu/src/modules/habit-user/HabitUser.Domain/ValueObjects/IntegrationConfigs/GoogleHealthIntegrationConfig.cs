namespace HabitUser.Domain.ValueObjects.IntegrationConfigs;

public sealed record GoogleHealthIntegrationConfig(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAtUtc
) : IntegrationConfig;

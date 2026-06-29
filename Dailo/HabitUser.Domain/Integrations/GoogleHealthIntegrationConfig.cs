namespace HabitUser.Domain.Integrations;

public sealed record GoogleHealthIntegrationConfig(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAtUtc
) : IntegrationConfig;

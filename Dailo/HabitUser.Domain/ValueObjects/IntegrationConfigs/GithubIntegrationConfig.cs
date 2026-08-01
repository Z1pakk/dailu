namespace HabitUser.Domain.ValueObjects.IntegrationConfigs;

public sealed record GithubIntegrationConfig(string AccessToken, DateTime? ExpiresAtUtc)
    : IntegrationConfig;

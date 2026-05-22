namespace HabitUser.Domain.Integrations;

public sealed record GithubIntegrationConfig(string AccessToken, DateTime? ExpiresAtUtc)
    : IntegrationConfig;

namespace HabitUser.Domain.Integrations;

public sealed record GithubIntegrationConfig(string AccessToken, int? ExpiresInDays) : IntegrationConfig;

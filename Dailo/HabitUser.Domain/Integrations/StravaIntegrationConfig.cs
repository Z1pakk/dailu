namespace HabitUser.Domain.Integrations;

public sealed record StravaIntegrationConfig(string ClientId, string ClientSecret) : IntegrationConfig;

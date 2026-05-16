using System.Text.Json.Serialization;

namespace HabitUser.Application.Features.GetIntegrationConfigs;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(GithubIntegrationSummary), "github")]
[JsonDerivedType(typeof(StravaIntegrationSummary), "strava")]
public abstract record IntegrationSummary;

public sealed record GithubIntegrationSummary(DateTime? ExpiresAt) : IntegrationSummary;

public sealed record StravaIntegrationSummary : IntegrationSummary;

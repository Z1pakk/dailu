using System.Text.Json.Serialization;

namespace HabitUser.Domain.ValueObjects.IntegrationConfigs;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(GithubIntegrationConfig), "github")]
[JsonDerivedType(typeof(StravaIntegrationConfig), "strava")]
[JsonDerivedType(typeof(GoogleHealthIntegrationConfig), "google-health")]
public abstract record IntegrationConfig;

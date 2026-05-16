using System.Text.Json.Serialization;

namespace HabitUser.Domain.Integrations;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(GithubIntegrationConfig), "github")]
[JsonDerivedType(typeof(StravaIntegrationConfig), "strava")]
public abstract record IntegrationConfig;

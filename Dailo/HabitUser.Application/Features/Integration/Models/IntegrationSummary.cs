using System.Text.Json.Serialization;

namespace HabitUser.Application.Features.Integration.Models;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(GithubIntegrationSummary), "github")]
[JsonDerivedType(typeof(StravaIntegrationSummary), "strava")]
[JsonDerivedType(typeof(GoogleHealthIntegrationSummary), "google-health")]
public abstract record IntegrationSummary;

public sealed record GithubIntegrationSummary(DateTime? ExpiresAtUtc) : IntegrationSummary;

public sealed record StravaAthleteInfo(
    long Id,
    string Username,
    string FirstName,
    string LastName,
    string ProfileUrl
);

public sealed record StravaIntegrationSummary(DateTime ExpiresAtUtc, StravaAthleteInfo? Athlete)
    : IntegrationSummary;

public sealed record GoogleHealthIntegrationSummary(DateTime ExpiresAtUtc) : IntegrationSummary;

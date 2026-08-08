using System.Text.Json.Serialization;
using Habit.DataTransfer.Enums;

namespace Habit.DataTransfer.Models;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(GithubAutomationFilterModel), "github")]
[JsonDerivedType(typeof(StravaAutomationFilterModel), "strava")]
[JsonDerivedType(typeof(GoogleHealthAutomationFilterModel), "google-health")]
public abstract record AutomationFilterModel;

public sealed record GithubAutomationFilterModel(
    long RepositoryId,
    string RepositoryName,
    GithubEventType[] EventTypes
) : AutomationFilterModel;

public sealed record StravaAutomationFilterModel(StravaActivityType[] ActivityTypes)
    : AutomationFilterModel;

public sealed record GoogleHealthAutomationFilterModel(GoogleHealthMetric[] Metrics)
    : AutomationFilterModel;

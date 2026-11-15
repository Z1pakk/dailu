using System.Text.Json.Serialization;
using Habit.Domain.ValueObjects;
using Habit.Domain.ValueObjects.AutomationFilters;

namespace Habit.Application.Models.Request;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(GithubAutomationFilterRequestModel), "github")]
[JsonDerivedType(typeof(StravaAutomationFilterRequestModel), "strava")]
[JsonDerivedType(typeof(GoogleHealthAutomationFilterRequestModel), "google-health")]
public abstract record HabitAutomationFilterRequestModel
{
    public virtual HabitAutomationFilter ToDomain()
    {
        throw new NotImplementedException();
    }
}

public sealed record GithubAutomationFilterRequestModel(
    long RepositoryId,
    string RepositoryName,
    GithubEventType[] EventTypes
) : HabitAutomationFilterRequestModel
{
    public override HabitAutomationFilter ToDomain() =>
        new GithubAutomationFilter(RepositoryId, RepositoryName, EventTypes);
}

public sealed record StravaAutomationFilterRequestModel(StravaActivityType[] ActivityTypes)
    : HabitAutomationFilterRequestModel
{
    public override HabitAutomationFilter ToDomain() => new StravaAutomationFilter(ActivityTypes);
}

public sealed record GoogleHealthAutomationFilterRequestModel(GoogleHealthMetric[] Metrics)
    : HabitAutomationFilterRequestModel
{
    public override HabitAutomationFilter ToDomain() => new GoogleHealthAutomationFilter(Metrics);
}

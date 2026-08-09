using System.Text.Json.Serialization;
using Habit.Domain.ValueObjects;
using Habit.Domain.ValueObjects.AutomationFilters;

namespace Habit.Application.Models;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(GithubAutomationFilterModel), "github")]
[JsonDerivedType(typeof(StravaAutomationFilterModel), "strava")]
[JsonDerivedType(typeof(GoogleHealthAutomationFilterModel), "google-health")]
public abstract record HabitAutomationFilterModel
{
    public virtual HabitAutomationFilter ToDomain()
    {
        throw new NotImplementedException();
    }
}

public sealed record GithubAutomationFilterModel(
    long RepositoryId,
    string RepositoryName,
    GithubEventType[] EventTypes
) : HabitAutomationFilterModel
{
    public override HabitAutomationFilter ToDomain() =>
        new GithubAutomationFilter(RepositoryId, RepositoryName, EventTypes);
}

public sealed record StravaAutomationFilterModel(StravaActivityType[] ActivityTypes)
    : HabitAutomationFilterModel
{
    public override HabitAutomationFilter ToDomain() => new StravaAutomationFilter(ActivityTypes);
}

public sealed record GoogleHealthAutomationFilterModel(GoogleHealthMetric[] Metrics)
    : HabitAutomationFilterModel
{
    public override HabitAutomationFilter ToDomain() => new GoogleHealthAutomationFilter(Metrics);
}

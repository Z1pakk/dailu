using HabitEntry.Application.Enums;

namespace HabitEntry.Application.Models;

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

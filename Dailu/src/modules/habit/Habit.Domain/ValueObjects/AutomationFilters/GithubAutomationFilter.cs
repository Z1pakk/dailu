namespace Habit.Domain.ValueObjects.AutomationFilters;

public sealed record GithubAutomationFilter(
    long RepositoryId,
    string RepositoryName,
    GithubEventType[] EventTypes
) : HabitAutomationFilter;

public enum GithubEventType
{
    Push = 0,
    PullRequest = 1,
}

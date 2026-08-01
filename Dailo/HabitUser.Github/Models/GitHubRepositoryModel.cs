namespace HabitUser.Github.Models;

public sealed record GitHubRepositoryModel
{
    public required long Id { get; init; }
    public required string FullName { get; init; }
}

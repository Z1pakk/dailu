namespace HabitUser.Github.Models;

public sealed record GitHubEventModel
{
    public required string Id { get; set; }

    public required string Type { get; set; }

    public bool Public { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public string? RepoName { get; set; }

    public string? HeadCommitSha { get; set; }

    public string? CommitMessage { get; set; }

    public int? PrNumber { get; set; }

    public string? PrTitle { get; set; }

    public string? PrAction { get; set; }
}

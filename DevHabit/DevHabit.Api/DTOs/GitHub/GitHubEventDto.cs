namespace DevHabit.Api.DTOs.GitHub;

public sealed record GitHubEventDto
{
    public string Id { get; set; }

    public string Type { get; set; }

    public GitHubUserProfileDto Actor { get; set; }

    public bool Public { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

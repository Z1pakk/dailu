using System.Text.Json.Serialization;

namespace HabitUser.Integrations.GitHub.Models;

internal sealed record GitHubEventResponse
{
    [JsonPropertyName("id")]
    public required string Id { get; set; }

    [JsonPropertyName("type")]
    public required string Type { get; set; }

    [JsonPropertyName("public")]
    public bool Public { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAtUtc { get; set; }

    [JsonPropertyName("repo")]
    public GitHubEventRepoResponse? Repo { get; set; }

    [JsonPropertyName("payload")]
    public GitHubEventPayload? Payload { get; set; }
}

internal sealed record GitHubEventPayload
{
    [JsonPropertyName("head")]
    public string? Head { get; set; }

    [JsonPropertyName("action")]
    public string? Action { get; set; }

    [JsonPropertyName("number")]
    public int? Number { get; set; }

    [JsonPropertyName("pull_request")]
    public GitHubPrDetailsResponse? PullRequest { get; set; }
}

internal sealed record GitHubCommitDetailResponse
{
    [JsonPropertyName("commit")]
    public GitHubCommitDetailBodyResponse? Commit { get; set; }
}

internal sealed record GitHubCommitDetailBodyResponse
{
    [JsonPropertyName("message")]
    public string? Message { get; set; }
}

internal sealed record GitHubPrDetailsResponse
{
    [JsonPropertyName("title")]
    public string? Title { get; set; }
}

internal sealed record GitHubPullRequestDetailResponse
{
    [JsonPropertyName("title")]
    public string? Title { get; set; }
}

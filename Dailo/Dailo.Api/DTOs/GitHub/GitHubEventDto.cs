namespace Dailo.Api.DTOs.GitHub;

public sealed record GitHubEventDto
{
    public required string Id { get; set; }

    public required string Type { get; set; }

    public bool Public { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

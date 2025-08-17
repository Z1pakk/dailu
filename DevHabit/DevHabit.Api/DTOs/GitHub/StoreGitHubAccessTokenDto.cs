namespace DevHabit.Api.DTOs.GitHub;

public sealed record StoreGitHubAccessTokenDto
{
    public required string Token { get; init; }
    public required int ExpiresInDays { get; init; }
}

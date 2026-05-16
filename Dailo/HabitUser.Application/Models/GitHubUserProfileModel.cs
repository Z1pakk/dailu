namespace HabitUser.Application.Models;

public sealed record GitHubUserProfileModel
{
    public int Id { get; init; }
    public string? Login { get; init; }
    public string? Url { get; init; }
    public string? Name { get; init; }
    public string? Email { get; init; }
    public int PublicRepos { get; init; }
    public int Followers { get; init; }
    public int Following { get; init; }
}

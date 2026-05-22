using System.Text.Json.Serialization;

namespace HabitUser.Integrations.GitHub.Models;

internal sealed record GitHubUserResponse(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("login")] string? Login,
    [property: JsonPropertyName("url")] string? Url,
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("email")] string? Email,
    [property: JsonPropertyName("public_repos")] int PublicRepos,
    [property: JsonPropertyName("followers")] int Followers,
    [property: JsonPropertyName("following")] int Following
);

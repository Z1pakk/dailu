using System.Text.Json.Serialization;

namespace HabitUser.Integrations.GitHub.Models;

internal sealed record GitHubEventRepoResponse
{
    [JsonPropertyName("name")]
    public required string Name { get; set; }
}

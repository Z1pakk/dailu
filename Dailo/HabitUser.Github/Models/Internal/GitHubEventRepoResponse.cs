using System.Text.Json.Serialization;

namespace HabitUser.Github.Models.Internal;

internal sealed record GitHubEventRepoResponse
{
    [JsonPropertyName("name")]
    public required string Name { get; set; }
}

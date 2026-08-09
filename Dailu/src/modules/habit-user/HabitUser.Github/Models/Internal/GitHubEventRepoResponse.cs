using System.Text.Json.Serialization;

namespace HabitUser.Github.Models.Internal;

internal sealed record GitHubEventRepoResponse
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("name")]
    public required string Name { get; set; }
}

using System.Text.Json.Serialization;

namespace HabitUser.Strava.Models.Internal;

internal sealed record StravaActivityResponse
{
    [JsonPropertyName("id")]
    public long Id { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; init; } = string.Empty;

    [JsonPropertyName("start_date")]
    public DateTime StartDate { get; init; }

    [JsonPropertyName("distance")]
    public float Distance { get; init; }

    [JsonPropertyName("moving_time")]
    public int MovingTime { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }
}

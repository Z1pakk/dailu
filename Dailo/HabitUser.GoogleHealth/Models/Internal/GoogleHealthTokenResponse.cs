using System.Text.Json.Serialization;

namespace HabitUser.GoogleHealth.Models.Internal;

internal sealed record GoogleHealthTokenResponse
{
    [JsonPropertyName("access_token")]
    public string AccessToken { get; init; } = string.Empty;

    [JsonPropertyName("refresh_token")]
    public string RefreshToken { get; init; } = string.Empty;

    // Google returns seconds until expiry, unlike Strava's unix timestamp
    [JsonPropertyName("expires_in")]
    public int ExpiresIn { get; init; }
}

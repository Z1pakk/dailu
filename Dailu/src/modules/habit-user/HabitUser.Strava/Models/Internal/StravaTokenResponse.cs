using System.Text.Json.Serialization;

namespace HabitUser.Strava.Models.Internal;

internal sealed record StravaTokenResponse
{
    [JsonPropertyName("access_token")]
    public string AccessToken { get; init; } = string.Empty;

    [JsonPropertyName("refresh_token")]
    public string RefreshToken { get; init; } = string.Empty;

    [JsonPropertyName("expires_at")]
    public long ExpiresAt { get; init; }

    [JsonPropertyName("athlete")]
    public StravaAthleteResponse? Athlete { get; init; }
}

internal sealed record StravaAthleteResponse
{
    [JsonPropertyName("id")]
    public long Id { get; init; }

    [JsonPropertyName("username")]
    public string Username { get; init; } = string.Empty;

    [JsonPropertyName("firstname")]
    public string FirstName { get; init; } = string.Empty;

    [JsonPropertyName("lastname")]
    public string LastName { get; init; } = string.Empty;

    [JsonPropertyName("profile_medium")]
    public string ProfileUrl { get; init; } = string.Empty;
}

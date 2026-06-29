using System.Text.Json.Serialization;

namespace HabitUser.GoogleHealth.Models.Internal;

internal sealed record GoogleHealthUserInfoResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("name")]
    public string? Name { get; init; }

    [JsonPropertyName("given_name")]
    public string? GivenName { get; init; }

    [JsonPropertyName("family_name")]
    public string? FamilyName { get; init; }

    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("picture")]
    public string? Picture { get; init; }
}

using System.Text.Json.Serialization;

namespace HabitUser.Github.Models.Internal;

internal sealed record GitHubTokenResponse(
    [property: JsonPropertyName("access_token")] string? AccessToken,
    [property: JsonPropertyName("error")] string? Error,
    [property: JsonPropertyName("error_description")] string? ErrorDescription,
    [property: JsonPropertyName("error_uri")] string? ErrorUri
);

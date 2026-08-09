using System.Text.Json.Serialization;

namespace HabitUser.Github.Models.Internal;

internal sealed record GitHubTokenResponse(
    [property: JsonPropertyName("access_token")] string AccessToken
);

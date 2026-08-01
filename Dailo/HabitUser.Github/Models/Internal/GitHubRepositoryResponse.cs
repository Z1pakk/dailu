using System.Text.Json.Serialization;

namespace HabitUser.Github.Models.Internal;

internal sealed record GitHubRepositoryResponse(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("full_name")] string FullName
);

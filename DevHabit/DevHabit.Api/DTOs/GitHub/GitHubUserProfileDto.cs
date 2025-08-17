using System.Text.Json.Serialization;
using DevHabit.Api.DTOs.Common;

namespace DevHabit.Api.DTOs.GitHub;

public sealed record GitHubUserProfileDto
{
    public int Id { get; init; }
    public string Login { get; init; }
    public string Url { get; init; }
    public string Name { get; init; }
    public string Email { get; init; }

    public IEnumerable<LinkDto> Links { get; set; }
}

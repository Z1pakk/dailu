using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using HabitUser.Application.IntegratedServices;
using HabitUser.Application.Models;
using Microsoft.Extensions.Logging;

namespace HabitUser.Integrations.GitHub;

file sealed record GitHubApiUserResponse(
    int Id,
    string? Login,
    string? Url,
    string? Name,
    string? Email,
    [property: JsonPropertyName("public_repos")] int PublicRepos,
    int Followers,
    int Following
);

public sealed class GithubHttpClient(HttpClient httpclient, ILogger<GithubHttpClient> logger)
    : IGitHubHttpClient
{
    public async Task<GitHubUserProfileModel?> GetUserProfileAsync(
        string accessToken,
        CancellationToken cancellationToken = default
    )
    {
        using HttpClient client = CreateGitHubClient(accessToken);

        try
        {
            HttpResponseMessage response = await client.GetAsync("user", cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError(
                    "Failed to fetch GitHub user profile: {StatusCode}",
                    response.StatusCode
                );
                return null;
            }

            var raw = await response.Content.ReadFromJsonAsync<GitHubApiUserResponse>(
                JsonSerializerOptions.Web,
                cancellationToken
            );

            if (raw is null)
            {
                return null;
            }

            return new GitHubUserProfileModel
            {
                Id = raw.Id,
                Login = raw.Login,
                Url = raw.Url,
                Name = raw.Name,
                Email = raw.Email,
                PublicRepos = raw.PublicRepos,
                Followers = raw.Followers,
                Following = raw.Following,
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch GitHub user profile");
            return null;
        }
    }

    // public async Task<IEnumerable<GitHubEventDto>?> GetUserEventsAsync(
    //     string userName,
    //     string accessToken,
    //     CancellationToken cancellationToken = default
    // )
    // {
    //     ArgumentException.ThrowIfNullOrWhiteSpace(userName);
    //
    //     using HttpClient client = CreateGitHubClient(accessToken);
    //     try
    //     {
    //         HttpResponseMessage response = await client.GetAsync(
    //             $"users/{userName}/events?per_page=100",
    //             cancellationToken
    //         );
    //         if (!response.IsSuccessStatusCode)
    //         {
    //             logger.LogError(
    //                 "Failed to fetch GitHub user events: {StatusCode}",
    //                 response.StatusCode
    //             );
    //             return null;
    //         }
    //
    //         string content = await response.Content.ReadAsStringAsync(cancellationToken);
    //         return JsonSerializer.Deserialize<IEnumerable<GitHubEventDto>>(content);
    //     }
    //     catch (Exception ex)
    //     {
    //         logger.LogError(ex, "Failed to fetch GitHub user events");
    //         return null;
    //     }
    // }

    private HttpClient CreateGitHubClient(string accessToken)
    {
        httpclient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            accessToken
        );
        return httpclient;
    }
}

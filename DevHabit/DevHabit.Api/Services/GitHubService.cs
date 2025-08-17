using System.Net.Http.Headers;
using System.Text.Json;
using DevHabit.Api.DTOs.GitHub;

namespace DevHabit.Api.Services;

public sealed class GitHubService(HttpClient httpclient, ILogger<GitHubService> logger)
{
    public async Task<GitHubUserProfileDto?> GetUserProfileAsync(
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

            string content = await response.Content.ReadAsStringAsync(cancellationToken);
            return JsonSerializer.Deserialize<GitHubUserProfileDto>(
                content,
#pragma warning disable CA1869
                new JsonSerializerOptions() { PropertyNameCaseInsensitive = true }
#pragma warning restore CA1869
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch GitHub user profile");
            return null;
        }
    }

    public async Task<IEnumerable<GitHubEventDto>?> GetUserEventsAsync(
        string userName,
        string accessToken,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userName);

        using HttpClient client = CreateGitHubClient(accessToken);
        try
        {
            HttpResponseMessage response = await client.GetAsync(
                $"users/{userName}/events?per_page=100",
                cancellationToken
            );
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError(
                    "Failed to fetch GitHub user events: {StatusCode}",
                    response.StatusCode
                );
                return null;
            }

            string content = await response.Content.ReadAsStringAsync(cancellationToken);
            return JsonSerializer.Deserialize<IEnumerable<GitHubEventDto>>(content);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch GitHub user events");
            return null;
        }
    }

    private HttpClient CreateGitHubClient(string accessToken)
    {
        httpclient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            accessToken
        );
        return httpclient;
    }
}

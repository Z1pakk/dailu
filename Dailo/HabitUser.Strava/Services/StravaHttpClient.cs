using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HabitUser.Domain.Integrations;
using HabitUser.Strava.Models;
using HabitUser.Strava.Models.Internal;
using HabitUser.Strava.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SharedKernel.ResultPattern;

namespace HabitUser.Strava.Services;

public sealed class StravaHttpClient(
    HttpClient httpClient,
    IOptions<StravaOptions> options,
    TimeProvider timeProvider,
    ILogger<StravaHttpClient> logger
) : IStravaHttpClient
{
    private readonly StravaOptions _options = options.Value;

    public async Task<StravaTokensModel?> ExchangeAuthorizationCodeAsync(
        string code,
        CancellationToken cancellationToken = default
    )
    {
        using var content = new FormUrlEncodedContent([
            new KeyValuePair<string, string>("client_id", _options.ClientId),
            new KeyValuePair<string, string>("client_secret", _options.ClientSecret),
            new KeyValuePair<string, string>("code", code),
            new KeyValuePair<string, string>("grant_type", "authorization_code"),
        ]);

        try
        {
            var response = await httpClient.PostAsync("oauth/token", content, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("Strava code exchange failed: {StatusCode}", response.StatusCode);
                return null;
            }

            var raw = await response.Content.ReadFromJsonAsync<StravaTokenResponse>(
                JsonSerializerOptions.Web,
                cancellationToken
            );

            if (raw is null)
            {
                return null;
            }

            var athlete = raw.Athlete is { } a
                ? new StravaAthleteModel(a.Id, a.Username, a.FirstName, a.LastName, a.ProfileUrl)
                : null;

            return new StravaTokensModel(
                AccessToken: raw.AccessToken,
                RefreshToken: raw.RefreshToken,
                ExpiresAtUtc: DateTimeOffset.FromUnixTimeSeconds(raw.ExpiresAt).UtcDateTime,
                Athlete: athlete
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Strava code exchange failed unexpectedly");
            return null;
        }
    }

    public async Task<StravaTokensModel?> RefreshAccessTokenAsync(
        string refreshToken,
        CancellationToken cancellationToken = default
    )
    {
        using var content = new FormUrlEncodedContent([
            new KeyValuePair<string, string>("client_id", _options.ClientId),
            new KeyValuePair<string, string>("client_secret", _options.ClientSecret),
            new KeyValuePair<string, string>("refresh_token", refreshToken),
            new KeyValuePair<string, string>("grant_type", "refresh_token"),
        ]);

        try
        {
            var response = await httpClient.PostAsync("oauth/token", content, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("Strava token refresh failed: {StatusCode}", response.StatusCode);
                return null;
            }

            var raw = await response.Content.ReadFromJsonAsync<StravaTokenResponse>(
                JsonSerializerOptions.Web,
                cancellationToken
            );

            if (raw is null)
            {
                return null;
            }

            return new StravaTokensModel(
                AccessToken: raw.AccessToken,
                RefreshToken: raw.RefreshToken,
                ExpiresAtUtc: DateTimeOffset.FromUnixTimeSeconds(raw.ExpiresAt).UtcDateTime
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Strava token refresh failed unexpectedly");
            return null;
        }
    }

    public async Task<Result<StravaApiResult>> GetActivitiesAsync(
        StravaIntegrationConfig config,
        DateTime? after = null,
        CancellationToken cancellationToken = default
    )
    {
        var utcNow = timeProvider.GetUtcNow().UtcDateTime;

        StravaIntegrationConfig? refreshedConfig = null;
        var accessToken = config.AccessToken;

        if (config.ExpiresAtUtc <= utcNow)
        {
            var refreshed = await TryRefreshAsync(config, cancellationToken);
            if (refreshed is null)
            {
                return Result<StravaApiResult>.Failure("Failed to refresh Strava token.");
            }

            refreshedConfig = refreshed;
            accessToken = refreshedConfig.AccessToken;
        }

        var result = await FetchActivitiesAsync(accessToken, after, cancellationToken);

        if (result.IsFailure && result.Error == UnauthorizedError && refreshedConfig is null)
        {
            logger.LogInformation("Strava token rejected, attempting refresh");

            var refreshed = await TryRefreshAsync(config, cancellationToken);
            if (refreshed is null)
            {
                return Result<StravaApiResult>.Failure("Strava token invalid and refresh failed.");
            }

            refreshedConfig = refreshed;
            result = await FetchActivitiesAsync(
                refreshedConfig.AccessToken,
                after,
                cancellationToken
            );
        }

        if (result.IsFailure)
        {
            return Result<StravaApiResult>.Failure(result.Error);
        }

        return Result<StravaApiResult>.Success(new StravaApiResult(result.Value, refreshedConfig));
    }

    private async Task<Result<IReadOnlyList<StravaActivityModel>>> FetchActivitiesAsync(
        string accessToken,
        DateTime? after,
        CancellationToken cancellationToken
    )
    {
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            accessToken
        );

        var url = "api/v3/athlete/activities?per_page=100";
        if (after.HasValue)
        {
            var afterUnix = new DateTimeOffset(after.Value, TimeSpan.Zero).ToUnixTimeSeconds();
            url += $"&after={afterUnix}";
        }

        try
        {
            var response = await httpClient.GetAsync(url, cancellationToken);

            if (response.StatusCode == HttpStatusCode.Unauthorized)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogWarning("Strava 401 on activities. Body: {Body}", body);
                return Result<IReadOnlyList<StravaActivityModel>>.Failure(UnauthorizedError);
            }

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogError(
                    "Strava activities request failed: {StatusCode}. Body: {Body}",
                    response.StatusCode,
                    body
                );
                return Result<IReadOnlyList<StravaActivityModel>>.Failure(
                    "Strava API request failed."
                );
            }

            var raw = await response.Content.ReadFromJsonAsync<
                IReadOnlyList<StravaActivityResponse>
            >(JsonSerializerOptions.Web, cancellationToken);

            if (raw is null)
            {
                return Result<IReadOnlyList<StravaActivityModel>>.Success([]);
            }

            var activities = raw.Select(a => new StravaActivityModel(
                    Id: a.Id,
                    Name: a.Name,
                    Type: a.Type,
                    StartDateUtc: a.StartDate,
                    Distance: a.Distance,
                    MovingTime: a.MovingTime,
                    Description: a.Description
                ))
                .ToList();

            return Result<IReadOnlyList<StravaActivityModel>>.Success(activities);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Strava activities request failed unexpectedly");
            return Result<IReadOnlyList<StravaActivityModel>>.Failure(
                "Strava API request failed unexpectedly."
            );
        }
    }

    private async Task<StravaIntegrationConfig?> TryRefreshAsync(
        StravaIntegrationConfig config,
        CancellationToken cancellationToken
    )
    {
        var tokens = await RefreshAccessTokenAsync(config.RefreshToken, cancellationToken);
        if (tokens is null)
        {
            return null;
        }

        return new StravaIntegrationConfig(
            tokens.AccessToken,
            tokens.RefreshToken,
            tokens.ExpiresAtUtc,
            config.Athlete
        );
    }

    private const string UnauthorizedError = "UNAUTHORIZED";
}

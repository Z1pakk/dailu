using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using HabitUser.GoogleHealth.Models;
using HabitUser.GoogleHealth.Models.Internal;
using HabitUser.GoogleHealth.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SharedKernel.ResultPattern;

namespace HabitUser.GoogleHealth.Services;

public sealed class GoogleHealthHttpClient(
    HttpClient httpClient,
    IOptions<GoogleHealthOptions> options,
    TimeProvider timeProvider,
    ILogger<GoogleHealthHttpClient> logger
) : IGoogleHealthHttpClient
{
    private readonly GoogleHealthOptions _options = options.Value;

    private const string TokenEndpoint = "https://oauth2.googleapis.com/token";
    private const string UserInfoEndpoint = "https://www.googleapis.com/oauth2/v2/userinfo";
    private const string UnauthorizedError = "UNAUTHORIZED";

    public async Task<GoogleHealthTokensModel?> ExchangeAuthorizationCodeAsync(
        string code,
        CancellationToken cancellationToken = default
    )
    {
        using var content = new FormUrlEncodedContent([
            new KeyValuePair<string, string>("client_id", _options.ClientId),
            new KeyValuePair<string, string>("client_secret", _options.ClientSecret),
            new KeyValuePair<string, string>("code", code),
            new KeyValuePair<string, string>("redirect_uri", _options.RedirectUri),
            new KeyValuePair<string, string>("grant_type", "authorization_code"),
        ]);

        try
        {
            var response = await httpClient.PostAsync(
                new Uri(TokenEndpoint),
                content,
                cancellationToken
            );
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError(
                    "Google Health code exchange failed: {StatusCode}",
                    response.StatusCode
                );
                return null;
            }

            var raw = await response.Content.ReadFromJsonAsync<GoogleHealthTokenResponse>(
                JsonSerializerOptions.Web,
                cancellationToken
            );

            if (raw is null)
            {
                return null;
            }

            return new GoogleHealthTokensModel(
                AccessToken: raw.AccessToken,
                RefreshToken: raw.RefreshToken,
                ExpiresAtUtc: timeProvider.GetUtcNow().UtcDateTime.AddSeconds(raw.ExpiresIn)
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Google Health code exchange failed unexpectedly");
            return null;
        }
    }

    public async Task<Result<GoogleHealthApiResult>> GetActivitiesAsync(
        GoogleHealthIntegrationConfig config,
        DateTime? afterDateTimeUtc = null,
        CancellationToken cancellationToken = default
    )
    {
        var result = await FetchWithTokenAsync(
            config,
            (accessToken, ct) => FetchActivitiesAsync(accessToken, afterDateTimeUtc, ct),
            cancellationToken
        );

        if (result.IsFailure)
        {
            return Result<GoogleHealthApiResult>.Failure(result.Error);
        }

        return Result<GoogleHealthApiResult>.Success(
            new GoogleHealthApiResult(result.Value.Value, result.Value.RefreshedConfig)
        );
    }

    public async Task<Result<GoogleHealthStepsApiResult>> GetStepsAsync(
        GoogleHealthIntegrationConfig config,
        DateTime? afterDateTimeUtc = null,
        CancellationToken cancellationToken = default
    )
    {
        var result = await FetchWithTokenAsync(
            config,
            (accessToken, ct) => FetchStepsAsync(accessToken, afterDateTimeUtc, ct),
            cancellationToken
        );

        if (result.IsFailure)
        {
            return Result<GoogleHealthStepsApiResult>.Failure(result.Error);
        }

        return Result<GoogleHealthStepsApiResult>.Success(
            new GoogleHealthStepsApiResult(result.Value.Value, result.Value.RefreshedConfig)
        );
    }

    private sealed record TokenFetchResult<T>(T Value, GoogleHealthIntegrationConfig? RefreshedConfig);

    // Ensures the access token is valid before calling `fetch`, refreshing it up front if it's
    // already known to be expired, and retrying once more on a 401 in case it was revoked early.
    private async Task<Result<TokenFetchResult<T>>> FetchWithTokenAsync<T>(
        GoogleHealthIntegrationConfig config,
        Func<string, CancellationToken, Task<Result<T>>> fetch,
        CancellationToken cancellationToken
    )
    {
        var utcNow = timeProvider.GetUtcNow().UtcDateTime;

        GoogleHealthIntegrationConfig? refreshedConfig = null;
        var accessToken = config.AccessToken;

        if (config.ExpiresAtUtc <= utcNow)
        {
            var refreshed = await TryRefreshAsync(config, cancellationToken);
            if (refreshed is null)
            {
                return Result<TokenFetchResult<T>>.Failure(
                    "Failed to refresh Google Health token."
                );
            }

            refreshedConfig = refreshed;
            accessToken = refreshedConfig.AccessToken;
        }

        var result = await fetch(accessToken, cancellationToken);

        if (result.IsFailure && result.Error == UnauthorizedError && refreshedConfig is null)
        {
            logger.LogInformation("Google Health token rejected, attempting refresh");

            var refreshed = await TryRefreshAsync(config, cancellationToken);
            if (refreshed is null)
            {
                return Result<TokenFetchResult<T>>.Failure(
                    "Google Health token invalid and refresh failed."
                );
            }

            refreshedConfig = refreshed;
            result = await fetch(refreshedConfig.AccessToken, cancellationToken);
        }

        if (result.IsFailure)
        {
            return Result<TokenFetchResult<T>>.Failure(result.Error);
        }

        return Result<TokenFetchResult<T>>.Success(new TokenFetchResult<T>(result.Value, refreshedConfig));
    }

    private async Task<GoogleHealthIntegrationConfig?> TryRefreshAsync(
        GoogleHealthIntegrationConfig config,
        CancellationToken cancellationToken
    )
    {
        var tokens = await RefreshAccessTokenAsync(config.RefreshToken, cancellationToken);
        if (tokens is null)
        {
            return null;
        }

        return new GoogleHealthIntegrationConfig(
            tokens.AccessToken,
            tokens.RefreshToken,
            tokens.ExpiresAtUtc
        );
    }

    private async Task<GoogleHealthTokensModel?> RefreshAccessTokenAsync(
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
            var response = await httpClient.PostAsync(
                new Uri(TokenEndpoint),
                content,
                cancellationToken
            );
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError(
                    "Google Health token refresh failed: {StatusCode}",
                    response.StatusCode
                );
                return null;
            }

            var raw = await response.Content.ReadFromJsonAsync<GoogleHealthTokenResponse>(
                JsonSerializerOptions.Web,
                cancellationToken
            );

            if (raw is null)
            {
                return null;
            }

            return new GoogleHealthTokensModel(
                AccessToken: raw.AccessToken,
                RefreshToken: raw.RefreshToken,
                ExpiresAtUtc: timeProvider.GetUtcNow().UtcDateTime.AddSeconds(raw.ExpiresIn)
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Google Health token refresh failed unexpectedly");
            return null;
        }
    }

    public async Task<GoogleHealthUserProfileModel?> GetUserProfileAsync(
        string accessToken,
        CancellationToken cancellationToken = default
    )
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(UserInfoEndpoint));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        try
        {
            var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var responseMessage = await response.Content.ReadAsStringAsync(cancellationToken);

                logger.LogError(
                    "Google Health user info failed: {StatusCode}. Response message: {ResponseMessage}",
                    response.StatusCode,
                    responseMessage
                );
                return null;
            }

            var raw = await response.Content.ReadFromJsonAsync<GoogleHealthUserInfoResponse>(
                JsonSerializerOptions.Web,
                cancellationToken
            );

            if (raw is null)
            {
                return null;
            }

            return new GoogleHealthUserProfileModel(
                Id: raw.Id,
                Name: raw.Name,
                GivenName: raw.GivenName,
                FamilyName: raw.FamilyName,
                Email: raw.Email,
                PictureUrl: raw.Picture
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Google Health user info failed unexpectedly");
            return null;
        }
    }

    private async Task<Result<IReadOnlyList<GoogleHealthActivityModel>>> FetchActivitiesAsync(
        string accessToken,
        DateTime? after,
        CancellationToken cancellationToken
    )
    {
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            accessToken
        );

        var url = "users/me/dataTypes/exercise/dataPoints";
        if (after.HasValue)
        {
            var filterValue =
                $"exercise.interval.civil_start_time >= \"{after.Value:yyyy-MM-ddTHH:mm:ss}\"";
            url += $"?filter={Uri.EscapeDataString(filterValue)}";
        }

        try
        {
            var response = await httpClient.GetAsync(url, cancellationToken);

            if (response.StatusCode == HttpStatusCode.Unauthorized)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogWarning("Google Health 401 on activities. Body: {Body}", body);
                return Result<IReadOnlyList<GoogleHealthActivityModel>>.Failure(UnauthorizedError);
            }

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogError(
                    "Google Health activities request failed: {StatusCode}. Body: {Body}",
                    response.StatusCode,
                    body
                );
                return Result<IReadOnlyList<GoogleHealthActivityModel>>.Failure(
                    "Google Health API request failed."
                );
            }

            var raw = await response.Content.ReadFromJsonAsync<GoogleHealthDataPointsResponse>(
                JsonSerializerOptions.Web,
                cancellationToken
            );

            if (raw is null)
            {
                return Result<IReadOnlyList<GoogleHealthActivityModel>>.Success([]);
            }

            var activities = raw
                .DataPoints.Where(dp => dp.Exercise?.Interval is not null)
                .Select(dp => new GoogleHealthActivityModel(
                    Id: dp.Name,
                    ExerciseType: dp.Exercise!.ExerciseType,
                    DisplayName: dp.Exercise.DisplayName,
                    StartDateUtc: dp.Exercise.Interval!.StartTime,
                    EndDateUtc: dp.Exercise.Interval.EndTime,
                    ActiveDurationSeconds: ParseDurationSeconds(dp.Exercise.ActiveDuration)
                ))
                .ToList();

            return Result<IReadOnlyList<GoogleHealthActivityModel>>.Success(activities);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Google Health activities request failed unexpectedly");
            return Result<IReadOnlyList<GoogleHealthActivityModel>>.Failure(
                "Google Health API request failed unexpectedly."
            );
        }
    }

    private async Task<Result<IReadOnlyList<GoogleHealthStepsModel>>> FetchStepsAsync(
        string accessToken,
        DateTime? after,
        CancellationToken cancellationToken
    )
    {
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            accessToken
        );

        var utcNow = timeProvider.GetUtcNow().UtcDateTime;
        var startDate = (after ?? utcNow).Date;
        var endDate = utcNow.Date.AddDays(1);

        var requestBody = new GoogleHealthDailyRollupRequest
        {
            Range = new GoogleHealthCivilTimeIntervalRequest
            {
                Start = ToCivilDateTime(startDate),
                End = ToCivilDateTime(endDate),
            },
        };

        try
        {
            var response = await httpClient.PostAsJsonAsync(
                "users/me/dataTypes/steps/dataPoints:dailyRollUp",
                requestBody,
                JsonSerializerOptions.Web,
                cancellationToken
            );

            if (response.StatusCode == HttpStatusCode.Unauthorized)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogWarning("Google Health 401 on steps rollup. Body: {Body}", body);
                return Result<IReadOnlyList<GoogleHealthStepsModel>>.Failure(UnauthorizedError);
            }

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogError(
                    "Google Health steps rollup request failed: {StatusCode}. Body: {Body}",
                    response.StatusCode,
                    body
                );
                return Result<IReadOnlyList<GoogleHealthStepsModel>>.Failure(
                    "Google Health API request failed."
                );
            }

            var raw = await response.Content.ReadFromJsonAsync<GoogleHealthDailyRollupResponse>(
                JsonSerializerOptions.Web,
                cancellationToken
            );

            if (raw is null)
            {
                return Result<IReadOnlyList<GoogleHealthStepsModel>>.Success([]);
            }

            var steps = raw
                .RollupDataPoints.Where(dp => dp.Steps is not null && dp.CivilStartTime?.Date is not null)
                .Select(dp => new GoogleHealthStepsModel(
                    Date: new DateOnly(
                        dp.CivilStartTime!.Date!.Year,
                        dp.CivilStartTime.Date.Month,
                        dp.CivilStartTime.Date.Day
                    ),
                    StepCount: (long)dp.Steps!.CountSum
                ))
                .ToList();

            return Result<IReadOnlyList<GoogleHealthStepsModel>>.Success(steps);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Google Health steps rollup request failed unexpectedly");
            return Result<IReadOnlyList<GoogleHealthStepsModel>>.Failure(
                "Google Health API request failed unexpectedly."
            );
        }
    }

    private static GoogleHealthCivilDateTimeRequest ToCivilDateTime(DateTime date) =>
        new()
        {
            Date = new GoogleHealthCivilDateRequest
            {
                Year = date.Year,
                Month = date.Month,
                Day = date.Day,
            },
        };

    // Parses Google's duration format "1800s" into an integer number of seconds
    private static int ParseDurationSeconds(string? duration)
    {
        if (string.IsNullOrEmpty(duration) || !duration.EndsWith('s'))
        {
            return 0;
        }

        return int.TryParse(duration.AsSpan(0, duration.Length - 1), out var seconds) ? seconds : 0;
    }
}

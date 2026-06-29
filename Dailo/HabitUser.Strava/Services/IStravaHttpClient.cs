using HabitUser.Domain.Integrations;
using HabitUser.Strava.Models;
using SharedKernel.ResultPattern;

namespace HabitUser.Strava.Services;

public sealed record StravaApiResult(
    IReadOnlyList<StravaActivityModel> Activities,
    StravaIntegrationConfig? RefreshedConfig = null
);

public interface IStravaHttpClient
{
    /// <summary>
    /// Get activities from Strava API. Automatically refreshes the access token if needed.
    /// </summary>
    /// <param name="config">Config with credentials from db</param>
    /// <param name="afterDateTimeUtc">DateTime in UTC to take activities after this value</param>
    /// <param name="cancellationToken"></param>
    /// <returns></returns>
    Task<Result<StravaApiResult>> GetActivitiesAsync(
        StravaIntegrationConfig config,
        DateTime? afterDateTimeUtc = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Exchange authorization code for an access token using OAuth2 in Strava.
    /// </summary>
    /// <returns></returns>
    Task<StravaTokensModel?> ExchangeAuthorizationCodeAsync(
        string code,
        CancellationToken cancellationToken = default
    );
}

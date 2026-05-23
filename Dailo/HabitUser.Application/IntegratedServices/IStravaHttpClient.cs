using HabitUser.Application.Features.Strava.Models;
using HabitUser.Domain.Integrations;
using SharedKernel.ResultPattern;

namespace HabitUser.Application.IntegratedServices;

public sealed record StravaApiResult(
    IReadOnlyList<StravaActivityModel> Activities,
    StravaIntegrationConfig? RefreshedConfig = null
);

public interface IStravaHttpClient
{
    Task<Result<StravaApiResult>> GetActivitiesAsync(
        StravaIntegrationConfig config,
        DateTime? after = null,
        CancellationToken cancellationToken = default
    );

    Task<StravaTokensModel?> ExchangeAuthorizationCodeAsync(
        string code,
        CancellationToken cancellationToken = default
    );

    Task<StravaTokensModel?> RefreshAccessTokenAsync(
        string refreshToken,
        CancellationToken cancellationToken = default
    );
}

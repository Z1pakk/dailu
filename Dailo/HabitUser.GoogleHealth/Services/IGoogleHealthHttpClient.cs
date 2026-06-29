using HabitUser.Domain.Integrations;
using HabitUser.GoogleHealth.Models;
using SharedKernel.ResultPattern;

namespace HabitUser.GoogleHealth.Services;

public sealed record GoogleHealthApiResult(
    IReadOnlyList<GoogleHealthActivityModel> Activities,
    GoogleHealthIntegrationConfig? RefreshedConfig = null
);

public interface IGoogleHealthHttpClient
{
    Task<Result<GoogleHealthApiResult>> GetActivitiesAsync(
        GoogleHealthIntegrationConfig config,
        DateTime? afterDateTimeUtc = null,
        CancellationToken cancellationToken = default
    );

    Task<GoogleHealthTokensModel?> ExchangeAuthorizationCodeAsync(
        string code,
        CancellationToken cancellationToken = default
    );

    Task<GoogleHealthUserProfileModel?> GetUserProfileAsync(
        string accessToken,
        CancellationToken cancellationToken = default
    );
}

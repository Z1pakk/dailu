using SharedKernel.Options;

namespace HabitUser.Strava.Options;

public sealed class StravaOptions : IOptions
{
    public string SectionName => "Strava";
    public string ClientId { get; init; } = string.Empty;
    public string ClientSecret { get; init; } = string.Empty;
    public string RedirectUri { get; init; } = string.Empty;
    public string FrontendCallbackUrl { get; init; } = string.Empty;
}

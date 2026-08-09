using SharedKernel.Options;

namespace HabitUser.GoogleHealth.Options;

public sealed class GoogleHealthOptions : IOptions
{
    public string SectionName => "GoogleHealth";
    public string ClientId { get; init; } = string.Empty;
    public string ClientSecret { get; init; } = string.Empty;
    public string RedirectUri { get; init; } = string.Empty;
    public string FrontendCallbackUrl { get; init; } = string.Empty;
}

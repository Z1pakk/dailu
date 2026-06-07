using SharedKernel.Options;

namespace HabitUser.Github.Options;

public class GithubOptions : IOptions
{
    public string SectionName => "Github";
    public string ClientId { get; init; } = string.Empty;
    public string ClientSecret { get; init; } = string.Empty;
    public string RedirectUri { get; init; } = string.Empty;
    public string FrontendCallbackUrl { get; init; } = string.Empty;
}

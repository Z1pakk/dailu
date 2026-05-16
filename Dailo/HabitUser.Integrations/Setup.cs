using HabitUser.Application.IntegratedServices;
using HabitUser.Integrations.GitHub;
using HabitUser.Integrations.Identity.Services;
using Microsoft.Extensions.DependencyInjection;

namespace HabitUser.Integrations;

public static class Setup
{
    public static IServiceCollection AddHabitUserIntegrations(this IServiceCollection services)
    {
        services.AddScoped<IUserProfileService, UserProfileService>();

        services.AddHttpClient<IGitHubHttpClient, GithubHttpClient>(client =>
        {
            client.BaseAddress = new Uri($"https://api.github.com/");
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Dailu");
            client.DefaultRequestHeaders.Accept.Add(
                new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue(
                    "application/vnd.github+json"
                )
            );
        });

        return services;
    }
}

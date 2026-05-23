using HabitUser.Application.Features.Github;
using HabitUser.Application.Features.Strava;
using Microsoft.Extensions.DependencyInjection;

namespace HabitUser.Application;

public static class Setup
{
    public static IServiceCollection AddHabitUserServices(this IServiceCollection services)
    {
        services.AddScoped<IGitHubActivityService, GitHubActivityService>();
        services.AddScoped<IStravaActivityService, StravaActivityService>();

        return services;
    }
}

using HabitUser.Application.IntegratedServices;
using HabitUser.Integrations.Identity.Services;
using Microsoft.Extensions.DependencyInjection;

namespace HabitUser.Integrations;

public static class Setup
{
    public static IServiceCollection AddHabitUserIntegrations(
        this IServiceCollection services
    )
    {
        services.AddScoped<IUserProfileService, UserProfileService>();

        return services;
    }
}


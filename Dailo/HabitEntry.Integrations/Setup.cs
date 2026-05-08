using HabitEntry.Application.IntegratedServices;
using HabitEntry.Integrations.Habits.Services;
using Microsoft.Extensions.DependencyInjection;

namespace HabitEntry.Integrations;

public static class Setup
{
    extension(IServiceCollection services)
    {
        public IServiceCollection AddHabitEntryIntegrations()
        {
            services.AddScoped<IHabitService, HabitService>();

            return services;
        }
    }
}
using Habit.Application.IntegratedServices;
using Habit.Integrations.Tags.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Habit.Integrations;

public static class Setup
{
    extension(IServiceCollection services)
    {
        public IServiceCollection AddHabitIntegrations()
        {
            services.AddScoped<ITagService, TagService>();

            return services;
        }
    }
}

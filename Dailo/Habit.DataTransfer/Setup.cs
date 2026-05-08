using Habit.DataTransfer.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Habit.DataTransfer;

public static class Setup
{
    extension(IServiceCollection services)
    {
        public IServiceCollection AddHabitTransferServices()
        {
            services.AddScoped<IHabitDataTransferService, HabitDataTransferService>();

            return services;
        }
    }
}

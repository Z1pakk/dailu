using HabitUser.GoogleHealth.Options;
using HabitUser.GoogleHealth.Services;
using HabitUser.GoogleHealth.Workers;
using Microsoft.Extensions.DependencyInjection;
using SharedInfrastructure.CQRS;
using SharedInfrastructure.Endpoint;
using SharedInfrastructure.Options;

namespace HabitUser.GoogleHealth;

public static class Setup
{
    public static IServiceCollection AddGoogleHealthModule(this IServiceCollection services)
    {
        services.AddHttpClient<IGoogleHealthHttpClient, GoogleHealthHttpClient>(client =>
        {
            client.BaseAddress = new Uri("https://health.googleapis.com/v4/");
        });

        services.AddScoped<IGoogleHealthActivityService, GoogleHealthActivityService>();

        services.AddValidateOptions<GoogleHealthOptions>();

        services.AddHostedService<GoogleHealthActivityWorker>();

        services.AddHandlerAssembly<IHabitUserGoogleHealthRoot>();
        services.AddEndpoints(assemblies: typeof(IHabitUserGoogleHealthRoot).Assembly);

        return services;
    }
}

using HabitUser.Strava.Options;
using HabitUser.Strava.Services;
using HabitUser.Strava.Workers;
using Microsoft.Extensions.DependencyInjection;
using SharedInfrastructure.CQRS;
using SharedInfrastructure.Endpoint;
using SharedInfrastructure.Options;

namespace HabitUser.Strava;

public static class Setup
{
    public static IServiceCollection AddStravaModule(this IServiceCollection services)
    {
        services.AddHttpClient<IStravaHttpClient, StravaHttpClient>(client =>
        {
            client.BaseAddress = new Uri("https://www.strava.com/");
        });

        services.AddScoped<IStravaActivityService, StravaActivityService>();

        services.AddValidateOptions<StravaOptions>();

        services.AddHostedService<StravaActivityWorker>();

        services.AddHandlerAssembly<IHabitUserStravaRoot>();
        services.AddEndpoints(assemblies: typeof(IHabitUserStravaRoot).Assembly);

        return services;
    }
}

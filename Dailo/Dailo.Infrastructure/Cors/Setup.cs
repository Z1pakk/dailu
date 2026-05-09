using Microsoft.Extensions.DependencyInjection;
using SharedInfrastructure.Options;

namespace Dailo.Infrastructure.Cors;

public static class Setup
{
    public static IServiceCollection AddCorsServices(this IServiceCollection services)
    {
        services.AddValidateOptions<CorsOptions>();
        var corsOptions = services.GetOptions<CorsOptions>();

        services.AddCors(options =>
        {
            options.AddPolicy(CorsOptions.PolicyName, builder =>
            {
                builder
                    .WithOrigins(corsOptions.AllowedOrigins)
                    .AllowAnyMethod()
                    .AllowAnyHeader()
                    .AllowCredentials();
            });
        });

        return services;
    }
}

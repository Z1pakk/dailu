using Microsoft.Extensions.DependencyInjection;
using SharedInfrastructure.Options;

namespace Dailu.Infrastructure.Messaging;

public static class Setup
{
    public static IServiceCollection AddRabbitMq(this IServiceCollection services)
    {
        services.AddValidateOptions<RabbitMqOptions>();
        services.AddSingleton<RabbitMqConnection>();
        return services;
    }
}

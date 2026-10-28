using System.Collections.Frozen;
using Dailu.Events;
using Microsoft.Extensions.DependencyInjection;
using SharedInfrastructure.Event;
using SharedInfrastructure.Options;
using SharedKernel.Event;

namespace Dailu.Infrastructure.Messaging;

public static class Setup
{
    public static IServiceCollection AddRabbitMq(this IServiceCollection services)
    {
        services.AddValidateOptions<RabbitMqOptions>();
        services.AddSingleton<RabbitMqConnection>();

        services.AddSingleton<RabbitMqPublisher>();

        return services;
    }
}

using Dailu.Infrastructure.Messaging;
using Microsoft.Extensions.DependencyInjection;
using SharedInfrastructure.Event;
using SharedInfrastructure.Options;
using SharedKernel.CQRS;
using SharedKernel.Event;

namespace Dailu.Infrastructure.Event;

public static class Setup
{
    public static IServiceCollection AddEvents(this IServiceCollection services)
    {
        services.AddScoped<IEventDispatcher, EventDispatcher>();

        services.AddScoped<IEventPublisher, EventPublisher>();

        if (services.GetOptions<RabbitMqOptions>().IsEnabled)
        {
            services.AddRabbitMq();
            services.AddScoped<IIntegrationEventBus, RabbitMqIntegrationEventBus>();
        }
        else
        {
            services.AddScoped<IIntegrationEventBus, InMemoryIntegrationEventBus>();
        }

        return services;
    }
}

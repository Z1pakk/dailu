using Dailu.Infrastructure.Messaging;
using Microsoft.Extensions.DependencyInjection;
using SharedInfrastructure.Event;
using SharedKernel.Event;

namespace Dailu.Infrastructure.Event;

public static class Setup
{
    public static IServiceCollection AddEvents(this IServiceCollection services)
    {
        services.AddRabbitMq();

        services.AddScoped<IEventDispatcher, EventDispatcher>();
        services.AddScoped<IIntegrationEventBus, InMemoryIntegrationEventBus>();

        return services;
    }
}

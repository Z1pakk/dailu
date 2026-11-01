using System.Collections.Frozen;
using Dailu.Events;
using Dailu.Infrastructure.Messaging;
using Microsoft.Extensions.DependencyInjection;
using SharedKernel.Event;

namespace SharedInfrastructure.Event;

public static class IntegrationEventSubscriptionExtensions
{
    public static IServiceCollection AddIntegrationEventSubscription<TModuleRoot>(
        this IServiceCollection services,
        string queue
    )
    {
        var module = typeof(TModuleRoot).Assembly;

        var eventTypes = module
            .GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false })
            .SelectMany(t => t.GetInterfaces())
            .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEventHandler<>))
            .Select(i => i.GetGenericArguments()[0])
            .Where(e => typeof(IIntegrationEvent).IsAssignableFrom(e))
            .ToFrozenSet();

        if (eventTypes.Count == 0)
        {
            // return without error as module might not have event handlers
            return services;
        }

        foreach (var eventType in eventTypes)
        {
            IntegrationEventTypes.GetEventNameOf(eventType); // fail at startup, not on first message
        }

        services.AddSingleton(new IntegrationEventSubscription(queue, module, eventTypes));

        // phase 3: services.AddHostedService<RabbitMqConsumerWorker<TModuleRoot>>();

        return services;
    }
}

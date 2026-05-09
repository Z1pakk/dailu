using Mediator;
using Microsoft.Extensions.DependencyInjection;
using SharedInfrastructure.Event;
using SharedKernel.Event;

namespace Dailo.Infrastructure.CQRS;

public static class Setup
{
    public static IServiceCollection AddPipelines(this IServiceCollection services)
    {
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

        services.AddScoped<IEventDispatcher, EventDispatcher>();
        services.AddScoped<IIntegrationEventBus, InMemoryIntegrationEventBus>();

        return services;
    }
}

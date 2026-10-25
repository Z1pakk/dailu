using Dailu.Infrastructure.CQRS.Pipelines;
using Mediator;
using Microsoft.Extensions.DependencyInjection;

namespace Dailu.Infrastructure.CQRS;

public static class Setup
{
    public static IServiceCollection AddPipelines(this IServiceCollection services)
    {
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(TracingBehavior<,>));
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));

        return services;
    }
}

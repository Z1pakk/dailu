using Mediator;
using Microsoft.Extensions.DependencyInjection;

namespace Dailo.Infrastructure.CQRS;

public static class Setup
{
    public static IServiceCollection AddPipelines(this IServiceCollection services)
    {
        services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

        return services;
    }
}

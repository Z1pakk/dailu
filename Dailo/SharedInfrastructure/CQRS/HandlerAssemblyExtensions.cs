using System.Reflection;
using Microsoft.Extensions.DependencyInjection;

namespace SharedInfrastructure.CQRS;

public sealed record HandlerAssembly(Assembly Value);

public static class HandlerAssemblyExtensions
{
    public static IServiceCollection AddHandlerAssembly<TMarker>(this IServiceCollection services)
    {
        services.AddSingleton(new HandlerAssembly(typeof(TMarker).Assembly));
        return services;
    }
}

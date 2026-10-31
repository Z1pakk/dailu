using System.Collections.Concurrent;
using System.Reflection;
using Mediator;
using Microsoft.Extensions.DependencyInjection;
using SharedKernel.Event;

namespace Dailu.Infrastructure.Messaging;

internal static class ModuleHandlers
{
    private delegate Task Invoker(
        IServiceProvider services,
        IIntegrationEvent @event,
        Assembly module,
        CancellationToken ct
    );

    private static readonly ConcurrentDictionary<Type, Invoker> Invokers = new();

    public static Task InvokeAsync(
        IServiceProvider services,
        IIntegrationEvent @event,
        Assembly module,
        CancellationToken ct
    ) => Invokers.GetOrAdd(@event.GetType(), Build)(services, @event, module, ct);

    private static Invoker Build(Type eventType) =>
        typeof(ModuleHandlers)
#pragma warning disable S3011
            .GetMethod(nameof(InvokeTypedAsync), BindingFlags.NonPublic | BindingFlags.Static)!
#pragma warning restore S3011
            .MakeGenericMethod(eventType)
            .CreateDelegate<Invoker>();

    private static async Task InvokeTypedAsync<TEvent>(
        IServiceProvider services,
        IIntegrationEvent @event,
        Assembly module,
        CancellationToken ct
    )
        where TEvent : IIntegrationEvent
    {
        var handlers = services
            .GetServices<INotificationHandler<TEvent>>()
            .Where(h => h.GetType().Assembly == module)
            .ToList();

        if (handlers.Count == 0)
        {
            throw new InvalidOperationException(
                $"{module.GetName().Name} subscribes to {typeof(TEvent).Name} but has no handler for it."
            );
        }

        foreach (var handler in handlers)
        {
            await handler.Handle((TEvent)@event, ct);
        }
    }
}

using System.Collections.Frozen;
using SharedKernel.Event;

namespace Dailu.Events;

public static class IntegrationEventTypes
{
    private static readonly FrozenDictionary<string, Type> EventsByName =
        typeof(IntegrationEventTypes)
            .Assembly.GetTypes()
            .Where(t =>
                t is { IsClass: true, IsAbstract: false }
                && typeof(IIntegrationEvent).IsAssignableFrom(t)
            )
            .ToFrozenDictionary(t => t.Name);

    public static string GetEventNameOf(Type type) =>
        EventsByName.TryGetValue(type.Name, out var known) && known == type
            ? type.Name
            : throw new InvalidOperationException(
                $"{type} is not an integration event in Dailu.Events."
            );

    public static Type Resolve(string name) =>
        EventsByName.TryGetValue(name, out var type)
            ? type
            : throw new InvalidOperationException($"Unknown integration event '{name}'.");
}

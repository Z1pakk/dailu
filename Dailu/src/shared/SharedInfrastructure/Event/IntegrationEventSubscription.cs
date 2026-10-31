using System.Collections.Frozen;
using System.Reflection;

namespace Dailu.Infrastructure.Messaging;

/// <summary>
/// A module's queue and the integration events bound to it.
/// </summary>
public sealed record IntegrationEventSubscription(
    string Queue,
    Assembly Module, // handlers are only invoked from this assembly
    FrozenSet<Type> EventTypes
);

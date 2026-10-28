namespace SharedKernel.Event;

/// <summary>
/// The integration event couldn't be handed to the transport.
/// </summary>
public sealed class IntegrationEventPublishException(string eventType, Exception innerException)
    : Exception($"Failed to publish {eventType}.", innerException)
{
    public string EventType { get; } = eventType;
}

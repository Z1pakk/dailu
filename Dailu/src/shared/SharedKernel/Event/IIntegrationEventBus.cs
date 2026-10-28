namespace SharedKernel.Event;

/// <summary>
/// Base interface for integration event bus.
/// </summary>
public interface IIntegrationEventBus
{
    ValueTask PublishAsync(
        IIntegrationEvent integrationEvent,
        CancellationToken cancellationToken = default
    );
}

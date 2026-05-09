namespace SharedKernel.Event;

public interface IIntegrationEventBus
{
    ValueTask PublishAsync(IIntegrationEvent integrationEvent, CancellationToken cancellationToken = default);
}

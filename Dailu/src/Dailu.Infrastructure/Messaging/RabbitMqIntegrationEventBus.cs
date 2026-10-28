using Microsoft.Extensions.Logging;
using SharedKernel.Event;

namespace Dailu.Infrastructure.Messaging;

/// <summary>
/// Event bus for publishing integration events to RabbitMQ.
/// </summary>
public sealed partial class RabbitMqIntegrationEventBus(
    RabbitMqPublisher publisher,
    IEnumerable<IntegrationEventSubscription> subscriptions,
    ILogger<RabbitMqIntegrationEventBus> logger
) : IIntegrationEventBus
{
    public async ValueTask PublishAsync(
        IIntegrationEvent integrationEvent,
        CancellationToken cancellationToken = default
    )
    {
        var eventType = integrationEvent.GetType();

        if (!subscriptions.Any(s => s.EventTypes.Contains(eventType)))
        {
            // nobody handles it
            // publishing would only trip mandatory and log a false "event lost"
            LogNoModuleHandlesEventTypeNotPublished(eventType.Name);
            return;
        }

        try
        {
            await publisher.PublishAsync(integrationEvent, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // broker unreachable, nacked, or returned as unroutable — the caller decides
            throw new IntegrationEventPublishException(eventType.Name, ex);
        }
    }

    [LoggerMessage(LogLevel.Debug, "No module handles {EventType}; not published")]
    partial void LogNoModuleHandlesEventTypeNotPublished(string eventType);
}

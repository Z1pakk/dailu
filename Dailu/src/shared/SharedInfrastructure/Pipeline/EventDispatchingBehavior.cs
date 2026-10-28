using Mediator;
using Microsoft.Extensions.Logging;
using SharedKernel.Event;
using SharedKernel.Persistence;

namespace SharedInfrastructure.Pipeline;

public abstract class EventDispatchingBehavior<TMessage, TResponse, TDbContext>(
    IEventDispatcher eventDispatcher,
    TDbContext dbContext,
    ILogger<EventDispatchingBehavior<TMessage, TResponse, TDbContext>> logger
) : IPipelineBehavior<TMessage, TResponse>
    where TMessage : notnull, IMessage
    where TDbContext : IAppDbContextBase
{
    public async ValueTask<TResponse> Handle(
        TMessage message,
        MessageHandlerDelegate<TMessage, TResponse> next,
        CancellationToken cancellationToken
    )
    {
        var response = await next(message, cancellationToken);

        var events = dbContext.ConsumeEvents();
        if (events.Count == 0)
        {
            return response;
        }

        try
        {
            await eventDispatcher.SendAsync(events, cancellationToken);
        }
        catch (IntegrationEventPublishException ex)
        {
            // the command has already committed; failing the request now wouldn't undo it
            logger.LogError(ex, "Failed to publish {EventType}; the event is lost", ex.EventType);
        }

        return response;
    }
}

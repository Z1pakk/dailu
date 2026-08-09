using Mediator;
using SharedKernel.Event;
using SharedKernel.Persistence;

namespace SharedInfrastructure.Pipeline;

public abstract class EventDispatchingBehavior<TMessage, TResponse, TDbContext>(
    IEventDispatcher eventDispatcher,
    TDbContext dbContext
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

        await eventDispatcher.SendAsync(events, cancellationToken);

        return response;
    }
}

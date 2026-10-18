using Mediator;
using Search.Application.Persistence;
using SharedInfrastructure.Pipeline;
using SharedKernel.Event;

namespace Search.Infrastructure.Pipeline;

public sealed class SearchEventDispatchingBehavior<TMessage, TResponse>(
    IEventDispatcher eventDispatcher,
    ISearchDbContext dbContext
) : EventDispatchingBehavior<TMessage, TResponse, ISearchDbContext>(eventDispatcher, dbContext)
    where TMessage : notnull, IMessage;

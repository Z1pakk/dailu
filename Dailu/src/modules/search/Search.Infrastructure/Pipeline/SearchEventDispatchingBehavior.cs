using Mediator;
using Microsoft.Extensions.Logging;
using Search.Application.Persistence;
using SharedInfrastructure.Pipeline;
using SharedKernel.Event;

namespace Search.Infrastructure.Pipeline;

public sealed class SearchEventDispatchingBehavior<TMessage, TResponse>(
    IEventDispatcher eventDispatcher,
    ISearchDbContext dbContext,
    ILogger<SearchEventDispatchingBehavior<TMessage, TResponse>> logger
)
    : EventDispatchingBehavior<TMessage, TResponse, ISearchDbContext>(
        eventDispatcher,
        dbContext,
        logger
    )
    where TMessage : notnull, IMessage;

using Mediator;
using SharedInfrastructure.Pipeline;
using SharedKernel.Event;
using Tag.Application.Persistence;

namespace Tag.Infrastructure.Pipeline;

public sealed class TagEventDispatchingBehavior<TMessage, TResponse>(
    IEventDispatcher eventDispatcher,
    ITagDbContext dbContext
) : EventDispatchingBehavior<TMessage, TResponse, ITagDbContext>(eventDispatcher, dbContext)
    where TMessage : notnull, IMessage;

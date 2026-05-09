using Identity.Application.Persistence;
using Mediator;
using SharedInfrastructure.Pipeline;
using SharedKernel.Event;

namespace Identity.Infrastructure.Pipeline;

public sealed class IdentityEventDispatchingBehavior<TMessage, TResponse>(
    IEventDispatcher eventDispatcher,
    IIdentityDbContext dbContext
) : EventDispatchingBehavior<TMessage, TResponse, IIdentityDbContext>(eventDispatcher, dbContext)
    where TMessage : notnull, IMessage;

using Identity.Application.Persistence;
using Mediator;
using Microsoft.Extensions.Logging;
using SharedInfrastructure.Pipeline;
using SharedKernel.Event;

namespace Identity.Infrastructure.Pipeline;

public sealed class IdentityEventDispatchingBehavior<TMessage, TResponse>(
    IEventDispatcher eventDispatcher,
    IIdentityDbContext dbContext,
    ILogger<IdentityEventDispatchingBehavior<TMessage, TResponse>> logger
)
    : EventDispatchingBehavior<TMessage, TResponse, IIdentityDbContext>(
        eventDispatcher,
        dbContext,
        logger
    )
    where TMessage : notnull, IMessage;

using Mediator;
using Microsoft.Extensions.Logging;
using SharedInfrastructure.Pipeline;
using SharedKernel.Event;
using Tag.Application.Persistence;

namespace Tag.Infrastructure.Pipeline;

public sealed class TagEventDispatchingBehavior<TMessage, TResponse>(
    IEventDispatcher eventDispatcher,
    ITagDbContext dbContext,
    ILogger<TagEventDispatchingBehavior<TMessage, TResponse>> logger
) : EventDispatchingBehavior<TMessage, TResponse, ITagDbContext>(eventDispatcher, dbContext, logger)
    where TMessage : notnull, IMessage;

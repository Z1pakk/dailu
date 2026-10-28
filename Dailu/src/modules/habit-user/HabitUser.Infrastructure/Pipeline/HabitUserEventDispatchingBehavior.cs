using HabitUser.Application.Persistence;
using Mediator;
using Microsoft.Extensions.Logging;
using SharedInfrastructure.Pipeline;
using SharedKernel.Event;

namespace HabitUser.Infrastructure.Pipeline;

public sealed class HabitUserEventDispatchingBehavior<TMessage, TResponse>(
    IEventDispatcher eventDispatcher,
    IHabitUserDbContext dbContext,
    ILogger<HabitUserEventDispatchingBehavior<TMessage, TResponse>> logger
)
    : EventDispatchingBehavior<TMessage, TResponse, IHabitUserDbContext>(
        eventDispatcher,
        dbContext,
        logger
    )
    where TMessage : notnull, IMessage;

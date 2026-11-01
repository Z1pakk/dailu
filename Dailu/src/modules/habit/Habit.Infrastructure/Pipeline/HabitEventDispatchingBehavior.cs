using Habit.Application.Persistence;
using Mediator;
using Microsoft.Extensions.Logging;
using SharedInfrastructure.Pipeline;
using SharedKernel.Event;

namespace Habit.Infrastructure.Pipeline;

public sealed class HabitEventDispatchingBehavior<TMessage, TResponse>(
    IEventDispatcher eventDispatcher,
    IHabitDbContext dbContext,
    ILogger<HabitEventDispatchingBehavior<TMessage, TResponse>> logger
)
    : EventDispatchingBehavior<TMessage, TResponse, IHabitDbContext>(
        eventDispatcher,
        dbContext,
        logger
    )
    where TMessage : notnull, IMessage;

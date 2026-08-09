using Habit.Application.Persistence;
using Mediator;
using SharedInfrastructure.Pipeline;
using SharedKernel.Event;

namespace Habit.Infrastructure.Pipeline;

public sealed class HabitEventDispatchingBehavior<TMessage, TResponse>(
    IEventDispatcher eventDispatcher,
    IHabitDbContext dbContext
) : EventDispatchingBehavior<TMessage, TResponse, IHabitDbContext>(eventDispatcher, dbContext)
    where TMessage : notnull, IMessage;

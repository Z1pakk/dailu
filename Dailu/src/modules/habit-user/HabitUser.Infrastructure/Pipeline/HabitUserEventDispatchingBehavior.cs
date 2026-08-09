using HabitUser.Application.Persistence;
using Mediator;
using SharedInfrastructure.Pipeline;
using SharedKernel.Event;

namespace HabitUser.Infrastructure.Pipeline;

public sealed class HabitUserEventDispatchingBehavior<TMessage, TResponse>(
    IEventDispatcher eventDispatcher,
    IHabitUserDbContext dbContext
) : EventDispatchingBehavior<TMessage, TResponse, IHabitUserDbContext>(eventDispatcher, dbContext)
    where TMessage : notnull, IMessage;

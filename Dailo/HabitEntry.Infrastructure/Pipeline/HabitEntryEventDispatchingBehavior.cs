using HabitEntry.Application.Persistence;
using Mediator;
using SharedInfrastructure.Pipeline;
using SharedKernel.Event;

namespace HabitEntry.Infrastructure.Pipeline;

public sealed class HabitEntryEventDispatchingBehavior<TMessage, TResponse>(
    IEventDispatcher eventDispatcher,
    IHabitEntryDbContext dbContext
) : EventDispatchingBehavior<TMessage, TResponse, IHabitEntryDbContext>(eventDispatcher, dbContext)
    where TMessage : notnull, IMessage;

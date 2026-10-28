using HabitEntry.Application.Persistence;
using Mediator;
using Microsoft.Extensions.Logging;
using SharedInfrastructure.Pipeline;
using SharedKernel.Event;

namespace HabitEntry.Infrastructure.Pipeline;

public sealed class HabitEntryEventDispatchingBehavior<TMessage, TResponse>(
    IEventDispatcher eventDispatcher,
    IHabitEntryDbContext dbContext,
    ILogger<HabitEntryEventDispatchingBehavior<TMessage, TResponse>> logger
)
    : EventDispatchingBehavior<TMessage, TResponse, IHabitEntryDbContext>(
        eventDispatcher,
        dbContext,
        logger
    )
    where TMessage : notnull, IMessage;

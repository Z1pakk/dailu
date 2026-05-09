using Dailo.Events;
using Habit.Application.Persistence;
using Habit.Domain.Aggregates;
using Habit.Domain.Entities;
using Mediator;
using Microsoft.EntityFrameworkCore;
using StrictId;

namespace Habit.Application.Features.HabitEntryCreated;

public sealed class HabitEntryCreatedIntegrationEventHandler(IHabitDbContext dbContext)
    : INotificationHandler<HabitEntryCompletedIntegrationEvent>
{
    public async ValueTask Handle(
        HabitEntryCompletedIntegrationEvent notification,
        CancellationToken cancellationToken
    )
    {
        var entityId = new Id<HabitEntity>(notification.HabitId);
        var entity = await dbContext
            .Habits.Include(h => h.Tags)
            .AsNoTracking()
            .FirstOrDefaultAsync(h => h.Id == entityId, cancellationToken);

        if (entity is null)
        {
            return;
        }

        var aggregate = HabitAggregate.Restore(
            new Id<HabitAggregate>(notification.HabitId),
            entity.UserId,
            entity.Name,
            entity.Description,
            entity.Type,
            entity.Frequency,
            entity.Target,
            entity.Status,
            entity.IsArchived,
            entity.EndDate,
            entity.Milestone,
            entity.LastCompletedAtUtc,
            entity.Tags.ToList(),
            entity.Version // preserves version so ToEntity() passes the concurrency check
        );

        var result = aggregate.Complete(notification.CompletedAtUtc);

        if (result.IsFailure)
        {
            return;
        }

        var updatedEntity = aggregate.ToEntity();

        dbContext.Habits.Update(updatedEntity);

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}

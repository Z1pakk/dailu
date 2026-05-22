using Dailo.Events;
using HabitEntry.Application.IntegratedServices;
using HabitEntry.Application.Persistence;
using HabitEntry.Domain.Aggregates;
using HabitEntry.Domain.Enums;
using Mediator;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Event;
using StrictId;

namespace HabitEntry.Application.EventHandlers.IntegrationActivitiesDetected;

public sealed class IntegrationActivitiesDetectedIntegrationEventHandler(
    IHabitEntryDbContext dbContext,
    IHabitService habitService,
    IEventDispatcher eventDispatcher
) : INotificationHandler<IntegrationActivitiesDetectedIntegrationEvent>
{
    public async ValueTask Handle(
        IntegrationActivitiesDetectedIntegrationEvent notification,
        CancellationToken cancellationToken
    )
    {
        var habits = await habitService.GetByAutomationSourceAsync(
            notification.UserId,
            notification.Source,
            cancellationToken
        );

        if (habits.Count == 0)
        {
            return;
        }

        var incomingExternalIds = notification.Activities.Select(a => a.ExternalId).ToHashSet();

        var existingExternalIds = await dbContext
            .HabitEntries.AsNoTracking()
            .Where(e =>
                e.UserId == notification.UserId
                && e.ExternalId != null
                && incomingExternalIds.Contains(e.ExternalId)
            )
            .Select(e => e.ExternalId!)
            .ToHashSetAsync(cancellationToken);

        var newActivities = notification
            .Activities.Where(a => !existingExternalIds.Contains(a.ExternalId))
            .ToList();

        if (newActivities.Count == 0)
        {
            return;
        }

        foreach (var habit in habits)
        {
            foreach (var activity in newActivities)
            {
                var result = HabitEntryAggregate.Create(
                    Id<HabitEntryAggregate>.NewId(),
                    notification.UserId,
                    habit.HabitId,
                    value: 1,
                    notes: activity.Notes,
                    HabitEntrySource.Automation,
                    externalId: activity.ExternalId,
                    activity.OccurredAtUtc
                );

                if (result.IsFailure)
                {
                    continue;
                }

                dbContext.HabitEntries.Add(result.Value.ToEntity());
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var events = dbContext.ConsumeEvents();
        if (events.Count > 0)
        {
            await eventDispatcher.SendAsync(events, cancellationToken);
        }
    }
}

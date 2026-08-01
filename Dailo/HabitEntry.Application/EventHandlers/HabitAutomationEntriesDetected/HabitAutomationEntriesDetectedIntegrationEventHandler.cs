using Dailo.Events;
using HabitEntry.Application.Persistence;
using HabitEntry.Domain.Aggregates;
using HabitEntry.Domain.Enums;
using Mediator;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Event;
using StrictId;

namespace HabitEntry.Application.EventHandlers.HabitAutomationEntriesDetected;

public sealed class HabitAutomationEntriesDetectedIntegrationEventHandler(
    IHabitEntryDbContext dbContext,
    IEventDispatcher eventDispatcher
) : INotificationHandler<HabitAutomationEntriesDetectedIntegrationEvent>
{
    public async ValueTask Handle(
        HabitAutomationEntriesDetectedIntegrationEvent notification,
        CancellationToken cancellationToken
    )
    {
        var incomingExternalIds = notification.Entries.Select(e => e.ExternalId).ToHashSet();

        var existingExternalIds = await dbContext
            .HabitEntries.AsNoTracking()
            .Where(e =>
                e.UserId == notification.UserId
                && e.ExternalId != null
                && incomingExternalIds.Contains(e.ExternalId)
            )
            .Select(e => e.ExternalId!)
            .ToHashSetAsync(cancellationToken);

        var newEntries = notification
            .Entries.Where(e => !existingExternalIds.Contains(e.ExternalId))
            .ToList();

        if (newEntries.Count == 0)
        {
            return;
        }

        foreach (var entry in newEntries)
        {
            var result = HabitEntryAggregate.Create(
                Id<HabitEntryAggregate>.NewId(),
                notification.UserId,
                entry.HabitId,
                value: entry.Value,
                notes: entry.Notes,
                HabitEntrySource.Automation,
                externalId: entry.ExternalId,
                entry.OccurredAtUtc
            );

            if (result.IsFailure)
            {
                continue;
            }

            dbContext.HabitEntries.Add(result.Value.ToEntity());
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var events = dbContext.ConsumeEvents();
        if (events.Count > 0)
        {
            await eventDispatcher.SendAsync(events, cancellationToken);
        }
    }
}

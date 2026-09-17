using Dailu.Events;
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

        // Scoped to HabitId+ExternalId, not just ExternalId: the same external activity can
        // match more than one habit (e.g. two habits both filtered on GoogleHealth Steps), and
        // each of those habits needs its own entry rather than sharing/contending for one.
        var existingByKey = (
            await dbContext
                .HabitEntries.AsNoTracking()
                .Where(e =>
                    e.UserId == notification.UserId
                    && e.ExternalId != null
                    && incomingExternalIds.Contains(e.ExternalId)
                )
                .ToListAsync(cancellationToken)
        ).ToDictionary(e => (e.HabitId, ExternalId: e.ExternalId!));

        foreach (var entry in notification.Entries)
        {
            if (existingByKey.TryGetValue((entry.HabitId, entry.ExternalId), out var existing))
            {
                if (!entry.AllowUpdate)
                {
                    continue;
                }

                var aggregate = HabitEntryAggregate.Restore(
                    new Id<HabitEntryAggregate>(existing.Id.Value),
                    existing.UserId,
                    existing.HabitId,
                    existing.Value,
                    existing.Notes,
                    existing.Source,
                    existing.ExternalId,
                    existing.IsArchived,
                    existing.CompletedAtUtc,
                    existing.Version
                );

                var updateResult = aggregate.Update(entry.Value, entry.Notes, entry.OccurredAtUtc);

                if (updateResult.IsFailure)
                {
                    continue;
                }

                dbContext.HabitEntries.Update(aggregate.ToEntity());
                continue;
            }

            var createResult = HabitEntryAggregate.Create(
                Id<HabitEntryAggregate>.NewId(),
                notification.UserId,
                entry.HabitId,
                value: entry.Value,
                notes: entry.Notes,
                HabitEntrySource.Automation,
                externalId: entry.ExternalId,
                entry.OccurredAtUtc
            );

            if (createResult.IsFailure)
            {
                continue;
            }

            dbContext.HabitEntries.Add(createResult.Value.ToEntity());
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var events = dbContext.ConsumeEvents();
        if (events.Count > 0)
        {
            await eventDispatcher.SendAsync(events, cancellationToken);
        }
    }
}

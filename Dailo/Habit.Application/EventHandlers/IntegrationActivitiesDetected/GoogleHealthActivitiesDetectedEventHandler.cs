using Dailo.Events;
using Habit.Application.Persistence;
using Habit.Domain.Enums;
using Habit.Domain.ValueObjects.AutomationFilters;
using Mediator;
using Microsoft.EntityFrameworkCore;
using StrictId;

namespace Habit.Application.EventHandlers.IntegrationActivitiesDetected;

public sealed class GoogleHealthActivitiesDetectedEventHandler(
    IHabitDbContext dbContext,
    IPublisher publisher
) : INotificationHandler<IntegrationActivitiesDetectedIntegrationEvent>
{
    public async ValueTask Handle(
        IntegrationActivitiesDetectedIntegrationEvent notification,
        CancellationToken cancellationToken
    )
    {
        if (notification.Source != IntegrationActivitySource.GoogleHealth)
        {
            return;
        }

        var habits = await dbContext
            .Habits.AsNoTracking()
            .Where(h =>
                h.UserId == notification.UserId
                && h.AutomationSource == AutomationSource.GoogleHealth
                && !h.IsArchived
            )
            .Select(h => new { h.Id, h.AutomationFilter })
            .ToListAsync(cancellationToken);

        if (habits.Count == 0)
        {
            return;
        }

        var entries = new List<HabitAutomationEntryDetected>();

        foreach (var habit in habits)
        {
            var filter = habit.AutomationFilter as GoogleHealthAutomationFilter;

            foreach (var activity in notification.Activities)
            {
                if (!Matches(filter, activity.Source))
                {
                    continue;
                }

                entries.Add(
                    new HabitAutomationEntryDetected(
                        new Id(habit.Id.Value),
                        activity.ExternalId,
                        activity.OccurredAtUtc,
                        activity.Notes,
                        activity.Value
                    )
                );
            }
        }

        if (entries.Count == 0)
        {
            return;
        }

        await publisher.Publish(
            new HabitAutomationEntriesDetectedIntegrationEvent(notification.UserId, entries),
            cancellationToken
        );
    }

    // No filter set on the habit matches every activity from the source. A filter with an
    // empty metric list matches every value defined by GoogleHealthMetric - but never an
    // activity whose raw type string doesn't parse into the enum at all.
    private static bool Matches(
        GoogleHealthAutomationFilter? filter,
        IntegrationActivitySourceDetails? source
    )
    {
        if (filter is null)
        {
            return true;
        }

        return source is not null
            && Enum.TryParse<GoogleHealthMetric>(source.Type, out var metric)
            && (filter.Metrics.Length == 0 || filter.Metrics.Contains(metric));
    }
}

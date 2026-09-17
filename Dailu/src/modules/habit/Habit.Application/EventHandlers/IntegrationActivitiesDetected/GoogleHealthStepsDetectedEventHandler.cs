using Dailu.Events;
using Habit.Application.Persistence;
using Habit.Domain.Enums;
using Habit.Domain.ValueObjects.AutomationFilters;
using Mediator;
using Microsoft.EntityFrameworkCore;
using StrictId;

namespace Habit.Application.EventHandlers.IntegrationActivitiesDetected;

public sealed class GoogleHealthStepsDetectedEventHandler(
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
                if (
                    !TryParseMetric(activity.Source, out var metric)
                    || metric != GoogleHealthMetric.Steps
                    || !Matches(filter, metric)
                )
                {
                    continue;
                }

                entries.Add(
                    new HabitAutomationEntryDetected(
                        new Id(habit.Id.Value),
                        activity.ExternalId,
                        activity.OccurredAtUtc,
                        activity.Notes,
                        activity.Value,
                        // Steps re-report an accumulating total for the same day under the same
                        // ExternalId, so later polls should update today's entry, not skip it.
                        AllowUpdate: true
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

    private static bool TryParseMetric(
        IntegrationActivitySourceDetails? source,
        out GoogleHealthMetric metric
    )
    {
        metric = default;
        return source is not null && Enum.TryParse(source.Type, out metric);
    }

    // No filter set on the habit matches every activity from the source. A filter with an
    // empty metric list matches every value defined by GoogleHealthMetric.
    private static bool Matches(GoogleHealthAutomationFilter? filter, GoogleHealthMetric metric)
    {
        return filter is null || filter.Metrics.Length == 0 || filter.Metrics.Contains(metric);
    }
}

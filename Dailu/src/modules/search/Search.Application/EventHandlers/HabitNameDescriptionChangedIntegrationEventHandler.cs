using Dailu.Events;
using Microsoft.Extensions.Logging;
using Search.Application.Features.Indexing;
using Search.Domain.Enums;
using SharedKernel.Event;

namespace Search.Application.EventHandlers;

public class HabitNameDescriptionChangedIntegrationEventHandler(
    ISearchIndexService searchIndexService,
    ILogger<HabitNameDescriptionChangedIntegrationEventHandler> logger
) : IEventHandler<HabitNameDescriptionChangedIntegrationEvent>
{
    public async ValueTask Handle(
        HabitNameDescriptionChangedIntegrationEvent notification,
        CancellationToken cancellationToken
    )
    {
        var result = await searchIndexService.AddAsync(
            new SearchIndexModel(
                notification.UserId,
                SearchEntityType.Habit,
                notification.HabitId,
                notification.HabitId,
                SearchTextHelper.Combine(notification.Name, notification.Description),
                null, // habits have no occurrence time
                notification.IsArchived
            ),
            cancellationToken
        );

        if (result.IsFailure)
        {
            logger.LogError(
                "Failed to add search index model for habit {HabitId} name/description change: {Result}",
                notification.HabitId,
                result.Error
            );
        }
    }
}

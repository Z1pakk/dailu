using Dailu.Events;
using Microsoft.Extensions.Logging;
using Search.Application.Features.Indexing;
using Search.Domain.Enums;
using SharedKernel.Event;

namespace Search.Application.EventHandlers;

public sealed class HabitEntryNoteChangedIntegrationEventHandler(
    ISearchIndexService searchIndexService,
    ILogger<HabitEntryNoteChangedIntegrationEventHandler> logger
) : IEventHandler<HabitEntryNoteChangedIntegrationEvent>
{
    public async ValueTask Handle(
        HabitEntryNoteChangedIntegrationEvent notification,
        CancellationToken cancellationToken
    )
    {
        var result = await searchIndexService.AddAsync(
            new SearchIndexModel(
                notification.UserId,
                SearchEntityType.HabitEntry,
                notification.EntryId,
                notification.HabitId,
                notification.Notes,
                notification.CompletedAtUtc,
                notification.IsArchived
            ),
            cancellationToken
        );

        if (result.IsFailure)
        {
            logger.LogError(
                "Failed to add search index model for habit entry {EntryId} note change: {Result}",
                notification.EntryId,
                result.Error
            );
        }
    }
}

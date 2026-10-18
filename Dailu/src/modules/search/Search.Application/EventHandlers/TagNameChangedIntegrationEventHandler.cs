using Dailu.Events;
using Microsoft.Extensions.Logging;
using Search.Application.Features.Indexing;
using Search.Domain.Enums;
using SharedKernel.Event;

namespace Search.Application.EventHandlers;

public class TagNameChangedIntegrationEventHandler(
    ISearchIndexService searchIndexService,
    ILogger<TagNameChangedIntegrationEventHandler> logger
) : IEventHandler<TagNameChangedIntegrationEvent>
{
    public async ValueTask Handle(
        TagNameChangedIntegrationEvent notification,
        CancellationToken cancellationToken
    )
    {
        var result = await searchIndexService.AddAsync(
            new SearchIndexModel(
                notification.UserId,
                SearchEntityType.Tag,
                notification.TagId,
                null,
                notification.Name,
                null
            ),
            cancellationToken
        );

        if (result.IsFailure)
        {
            logger.LogError(
                "Failed to add search index model for tag {EntryId} name change: {Result}",
                notification.TagId,
                result.Error
            );
        }
    }
}

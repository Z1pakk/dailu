using Habit.Application.IntegratedServices;
using Habit.Application.Models;
using StrictId;
using Tag.DataTransfer.Services;

namespace Habit.Integrations.Tags.Services;

public class TagService(ITagDataTransferService tagDataTransferService) : ITagService
{
    public async Task<Dictionary<Id<TagModel>, TagModel>> GetByIdsAsync(
        IEnumerable<Id<TagModel>> ids,
        CancellationToken cancellationToken = default
    )
    {
        var targetIds = ids.Select(id => new Id<Tag.DataTransfer.Models.TagModel>(id.Value));

        var responseTags = await tagDataTransferService.GetByIdsAsync(targetIds, cancellationToken);

        var mappedTags = responseTags.ToDictionary(
            kvp => new Id<TagModel>(kvp.Key.Value),
            kvp => new TagModel(
                new Id<TagModel>(kvp.Value.Id.Value),
                kvp.Value.Name,
                kvp.Value.Description
            )
        );

        return mappedTags;
    }
}

using Microsoft.EntityFrameworkCore;
using SharedKernel.User;
using StrictId;
using Tag.Application.Persistence;
using Tag.DataTransfer.Models;
using Tag.Domain.Entities;

namespace Tag.DataTransfer.Services;

public interface ITagDataTransferService
{
    Task<Dictionary<Id<TagModel>, TagModel>> GetByIdsAsync(
        IEnumerable<Id<TagModel>> ids,
        CancellationToken cancellationToken = default
    );
}

public class TagDataTransferService(ITagDbContext dbContext, ICurrentUserService currentUserService)
    : ITagDataTransferService
{
    public async Task<Dictionary<Id<TagModel>, TagModel>> GetByIdsAsync(
        IEnumerable<Id<TagModel>> ids,
        CancellationToken cancellationToken = default
    )
    {
        var uniqueTagIds = ids.Select(id => new Id<TagEntity>(id.Value)).ToHashSet();

        var tags = await dbContext
            .Tags.AsNoTracking()
            .Where(t => uniqueTagIds.Contains(t.Id))
            .Where(t => t.UserId == currentUserService.UserId)
            .Select(t => new TagModel
            {
                Id = t.Id.ToGuid(),
                Name = t.Name,
                Description = t.Description,
            })
            .ToDictionaryAsync(t => t.Id, cancellationToken);

        return tags;
    }
}

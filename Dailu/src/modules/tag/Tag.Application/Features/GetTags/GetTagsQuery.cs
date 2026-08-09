using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;
using StrictId;
using Tag.Application.Models;
using Tag.Application.Persistence;

namespace Tag.Application.Features.GetTags;

public sealed class GetTagsQuery : IQuery<Result<GetTagsQueryResponse>> { }

public sealed record GetTagsQueryResponse(IEnumerable<TagModel> Tags);

public sealed class GetTagsQueryHandler(
    ITagDbContext dbContext,
    ICurrentUserService currentUserService
) : IQueryHandler<GetTagsQuery, Result<GetTagsQueryResponse>>
{
    public async ValueTask<Result<GetTagsQueryResponse>> Handle(
        GetTagsQuery request,
        CancellationToken cancellationToken
    )
    {
        var tags = await dbContext
            .Tags.Where(t => t.UserId == currentUserService.UserId)
            .Select(t => new TagModel
            {
                Id = new Id<TagModel>(t.Id.Value),
                Name = t.Name,
                Description = t.Description,
                CreatedAtUtc = t.CreatedAtUtc,
                LastModifiedAtUtc = t.LastModifiedAtUtc,
            })
            .ToListAsync(cancellationToken);

        return Result<GetTagsQueryResponse>.Success(new GetTagsQueryResponse(tags));
    }
}

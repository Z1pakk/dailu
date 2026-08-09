using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;
using StrictId;
using Tag.Application.Models;
using Tag.Application.Persistence;
using Tag.Domain.Aggregates;

namespace Tag.Application.Features.CreateTag;

public sealed record CreateTagCommand(string Name, string? Description)
    : ICommand<Result<CreateTagCommandResponse>>;

public sealed record CreateTagCommandResponse(Id<TagModel> Id);

public sealed class CreateTagCommandHandler(
    ITagDbContext dbContext,
    ICurrentUserService currentUserService
) : ICommandHandler<CreateTagCommand, Result<CreateTagCommandResponse>>
{
    public async ValueTask<Result<CreateTagCommandResponse>> Handle(
        CreateTagCommand request,
        CancellationToken cancellationToken
    )
    {
        var tagResult = TagAggregate.Create(
            currentUserService.UserId,
            request.Name,
            request.Description
        );

        if (tagResult.IsFailure)
        {
            return Result<CreateTagCommandResponse>.BadRequest(tagResult.Error);
        }

        var entity = tagResult.Value.ToEntity();

        dbContext.Tags.Add(entity);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result<CreateTagCommandResponse>.Success(
            new CreateTagCommandResponse(entity.Id.ToGuid())
        );
    }
}

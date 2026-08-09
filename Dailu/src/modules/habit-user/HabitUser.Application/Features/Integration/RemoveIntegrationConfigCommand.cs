using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace HabitUser.Application.Features.Integration;

public sealed record RemoveIntegrationConfigCommand(IntegrationProvider Provider)
    : ICommand<Result>;

public sealed class RemoveIntegrationConfigCommandHandler(
    IHabitUserDbContext dbContext,
    ICurrentUserService currentUserService
) : ICommandHandler<RemoveIntegrationConfigCommand, Result>
{
    public async ValueTask<Result> Handle(
        RemoveIntegrationConfigCommand request,
        CancellationToken cancellationToken
    )
    {
        var userId = currentUserService.UserId;

        var existing = await dbContext.IntegrationConfigs.FirstOrDefaultAsync(
            x => x.HabitUser.IdentityUserId == userId && x.Provider == request.Provider,
            cancellationToken
        );

        if (existing is not null)
        {
            dbContext.IntegrationConfigs.Remove(existing);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Result.Success();
    }
}

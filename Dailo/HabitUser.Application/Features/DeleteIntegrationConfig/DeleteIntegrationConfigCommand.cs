using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace HabitUser.Application.Features.DeleteIntegrationConfig;

public sealed record DeleteIntegrationConfigCommand(IntegrationProvider Provider) : ICommand<Result>;

public sealed class DeleteIntegrationConfigCommandHandler(
    IHabitUserDbContext dbContext,
    ICurrentUserService currentUserService
) : ICommandHandler<DeleteIntegrationConfigCommand, Result>
{
    public async ValueTask<Result> Handle(
        DeleteIntegrationConfigCommand request,
        CancellationToken cancellationToken
    )
    {
        var userId = currentUserService.UserId;

        var existing = await dbContext.IntegrationConfigs
            .FirstOrDefaultAsync(
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

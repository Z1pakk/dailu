using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.Integrations;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using StrictId;

namespace HabitUser.Application.Features.SaveStravaTokens;

public sealed record SaveStravaTokensCommand(Guid IdentityUserId, StravaIntegrationConfig Config)
    : ICommand<Result>;

public sealed class SaveStravaTokensCommandHandler(IHabitUserDbContext dbContext)
    : ICommandHandler<SaveStravaTokensCommand, Result>
{
    public async ValueTask<Result> Handle(
        SaveStravaTokensCommand request,
        CancellationToken cancellationToken
    )
    {
        var habitUser = await dbContext
            .HabitUsers.AsNoTracking()
            .FirstOrDefaultAsync(
                hu => hu.IdentityUserId == request.IdentityUserId,
                cancellationToken
            );

        if (habitUser is null)
        {
            return Result.Failure("Habit user not found.");
        }

        var existing = await dbContext.IntegrationConfigs.FirstOrDefaultAsync(
            x => x.HabitUserId == habitUser.Id && x.Provider == IntegrationProvider.Strava,
            cancellationToken
        );

        if (existing is not null)
        {
            existing.Config = request.Config;
        }
        else
        {
            dbContext.IntegrationConfigs.Add(
                new IntegrationConfigEntity
                {
                    Id = Id<IntegrationConfigEntity>.NewId(),
                    HabitUserId = habitUser.Id,
                    Provider = IntegrationProvider.Strava,
                    Config = request.Config,
                }
            );
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

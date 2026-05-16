using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.Integrations;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;
using StrictId;

namespace HabitUser.Application.Features.SaveIntegrationConfig;

public sealed record SaveIntegrationConfigCommand(IntegrationConfig Config) : ICommand<Result>;

public sealed class SaveIntegrationConfigCommandHandler(
    IHabitUserDbContext dbContext,
    ICurrentUserService currentUserService
) : ICommandHandler<SaveIntegrationConfigCommand, Result>
{
    public async ValueTask<Result> Handle(
        SaveIntegrationConfigCommand request,
        CancellationToken cancellationToken
    )
    {
        var userId = currentUserService.UserId;
        var provider = GetProviderOf(request.Config);

        var habitUser = await dbContext
            .HabitUsers.AsNoTracking()
            .FirstOrDefaultAsync(hu => hu.IdentityUserId == userId, cancellationToken);

        if (habitUser is null)
        {
            return Result.Failure("Habit user not found.");
        }

        var existingCnfig = await dbContext.IntegrationConfigs.FirstOrDefaultAsync(
            x => x.HabitUserId == habitUser.Id && x.Provider == provider,
            cancellationToken
        );

        if (existingCnfig is not null)
        {
            existingCnfig.Config = request.Config;
        }
        else
        {
            dbContext.IntegrationConfigs.Add(
                new IntegrationConfigEntity
                {
                    Id = Id<IntegrationConfigEntity>.NewId(),
                    HabitUserId = habitUser.Id,
                    Provider = provider,
                    Config = request.Config,
                }
            );
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }

    private static IntegrationProvider GetProviderOf(IntegrationConfig config) =>
        config switch
        {
            GithubIntegrationConfig => IntegrationProvider.Github,
            StravaIntegrationConfig => IntegrationProvider.Strava,
            _ => throw new ArgumentOutOfRangeException(
                nameof(config),
                "Unknown integration provider."
            ),
        };
}

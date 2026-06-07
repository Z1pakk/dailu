using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.Integrations;
using HabitUser.Strava.Services;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;

namespace HabitUser.Strava.Commands;

public sealed record PollStravaActivityCommand : ICommand<Result>;

public sealed class PollStravaActivityCommandHandler(
    IHabitUserDbContext dbContext,
    IStravaActivityService stravaActivityService,
    TimeProvider timeProvider
) : ICommandHandler<PollStravaActivityCommand, Result>
{
    public async ValueTask<Result> Handle(
        PollStravaActivityCommand request,
        CancellationToken cancellationToken
    )
    {
        var userIntegrationConfigs = await dbContext
            .IntegrationConfigs.AsNoTracking()
            .Select(x => new
            {
                x.Id,
                x.HabitUser.IdentityUserId,
                x.Provider,
                x.Config,
                x.LastSyncedAtUtc,
            })
            .Where(c => c.Provider == IntegrationProvider.Strava)
            .ToListAsync(cancellationToken);

        foreach (var config in userIntegrationConfigs)
        {
            if (config.Config is not StravaIntegrationConfig stravaConfig)
            {
                continue;
            }

            var stravaResult = await stravaActivityService.PollAndSendAsync(
                config.IdentityUserId,
                stravaConfig,
                config.LastSyncedAtUtc,
                cancellationToken
            );

            if (stravaResult.Result.IsFailure && stravaResult.RefreshedConfig is null)
            {
                continue;
            }

            var entity = await dbContext.IntegrationConfigs.FirstOrDefaultAsync(
                c => c.Id == config.Id,
                cancellationToken
            );

            if (entity is null)
            {
                continue;
            }

            if (stravaResult.RefreshedConfig is not null)
            {
                entity.Config = stravaResult.RefreshedConfig;
            }

            if (stravaResult.Result.IsFailure)
            {
                continue;
            }

            entity.LastSyncedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

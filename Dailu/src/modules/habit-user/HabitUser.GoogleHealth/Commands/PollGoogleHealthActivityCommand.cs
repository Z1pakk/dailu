using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using HabitUser.GoogleHealth.Services;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;

namespace HabitUser.GoogleHealth.Commands;

public class PollGoogleHealthActivityCommand : ICommand<Result>;

public class PollGoogleHealthActivityCommandHandler(
    IHabitUserDbContext dbContext,
    IGoogleHealthActivityService googleHealthActivityService,
    IGoogleHealthStepsService googleHealthStepsService,
    TimeProvider timeProvider
) : ICommandHandler<PollGoogleHealthActivityCommand, Result>
{
    public async ValueTask<Result> Handle(
        PollGoogleHealthActivityCommand request,
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
            .Where(c => c.Provider == IntegrationProvider.GoogleHealth)
            .ToListAsync(cancellationToken);

        foreach (var config in userIntegrationConfigs)
        {
            if (config.Config is not GoogleHealthIntegrationConfig googleHealthConfig)
            {
                continue;
            }

            var activityResult = await googleHealthActivityService.PollAndSendAsync(
                config.IdentityUserId,
                googleHealthConfig,
                config.LastSyncedAtUtc,
                cancellationToken
            );

            // Reuse whatever config the activity call ended up with, so the steps call doesn't
            // attempt a redundant refresh against a token that was just rotated.
            var effectiveConfig = activityResult.RefreshedConfig ?? googleHealthConfig;

            var stepsResult = await googleHealthStepsService.PollAndSendAsync(
                config.IdentityUserId,
                effectiveConfig,
                config.LastSyncedAtUtc,
                cancellationToken
            );

            var refreshedConfig = stepsResult.RefreshedConfig ?? activityResult.RefreshedConfig;
            var succeeded = activityResult.Result.IsSuccess && stepsResult.Result.IsSuccess;

            if (!succeeded && refreshedConfig is null)
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

            if (refreshedConfig is not null)
            {
                entity.Config = refreshedConfig;
            }

            if (!succeeded)
            {
                continue;
            }

            entity.LastSyncedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

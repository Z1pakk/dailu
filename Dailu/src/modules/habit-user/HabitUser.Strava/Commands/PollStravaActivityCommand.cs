using HabitUser.Application.Features.Integration.SyncLogs;
using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using HabitUser.Strava.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;

namespace HabitUser.Strava.Commands;

public sealed record PollStravaActivityCommand : ICommand<Result>;

public sealed class PollStravaActivityCommandHandler(
    IHabitUserDbContext dbContext,
    IStravaActivityService stravaActivityService,
    TimeProvider timeProvider,
    ILogger<PollStravaActivityCommandHandler> logger
) : ICommandHandler<PollStravaActivityCommand, Result>
{
    public async ValueTask<Result> Handle(
        PollStravaActivityCommand request,
        CancellationToken cancellationToken
    )
    {
        var integrationConfigs = await dbContext
            .IntegrationConfigs.Include(x => x.HabitUser)
            .Where(c => c.Provider == IntegrationProvider.Strava)
            .ToListAsync(cancellationToken);

        foreach (var entity in integrationConfigs)
        {
            if (entity.Config is not StravaIntegrationConfig stravaConfig)
            {
                continue;
            }

            var startedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
            var activitiesCount = 0;
            string? errorMessage;

            try
            {
                var stravaResult = await stravaActivityService.PollAndSendAsync(
                    entity.HabitUser.IdentityUserId,
                    stravaConfig,
                    entity.LastSyncedAtUtc,
                    cancellationToken
                );

                if (stravaResult.RefreshedConfig is not null)
                {
                    entity.Config = stravaResult.RefreshedConfig;
                }

                activitiesCount = stravaResult.ActivitiesCount;
                errorMessage = stravaResult.Result.IsFailure ? stravaResult.Result.Error : null;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Strava polling failed for config {ConfigId}", entity.Id);
                errorMessage = "Unexpected error while syncing Strava.";
            }

            var finishedAtUtc = timeProvider.GetUtcNow().UtcDateTime;

            dbContext.AddSyncLog(
                entity.Id,
                startedAtUtc,
                finishedAtUtc,
                entity.LastSyncedAtUtc,
                activitiesCount,
                errorMessage
            );

            if (errorMessage is null)
            {
                entity.LastSyncedAtUtc = finishedAtUtc;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

using HabitUser.Application.Features.Integration.SyncLogs;
using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using HabitUser.GoogleHealth.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;

namespace HabitUser.GoogleHealth.Commands;

public class PollGoogleHealthActivityCommand : ICommand<Result>;

public class PollGoogleHealthActivityCommandHandler(
    IHabitUserDbContext dbContext,
    IGoogleHealthActivityService googleHealthActivityService,
    IGoogleHealthStepsService googleHealthStepsService,
    TimeProvider timeProvider,
    ILogger<PollGoogleHealthActivityCommandHandler> logger
) : ICommandHandler<PollGoogleHealthActivityCommand, Result>
{
    public async ValueTask<Result> Handle(
        PollGoogleHealthActivityCommand request,
        CancellationToken cancellationToken
    )
    {
        var integrationConfigs = await dbContext
            .IntegrationConfigs.Include(x => x.HabitUser)
            .Where(c => c.Provider == IntegrationProvider.GoogleHealth)
            .ToListAsync(cancellationToken);

        foreach (var entity in integrationConfigs)
        {
            if (entity.Config is not GoogleHealthIntegrationConfig googleHealthConfig)
            {
                continue;
            }

            var startedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
            var activitiesCount = 0;
            string? errorMessage;

            try
            {
                var activityResult = await googleHealthActivityService.PollAndSendAsync(
                    entity.HabitUser.IdentityUserId,
                    googleHealthConfig,
                    entity.LastSyncedAtUtc,
                    cancellationToken
                );

                // Reuse whatever config the activity call ended up with, so the steps call doesn't
                // attempt a redundant refresh against a token that was just rotated.
                var effectiveConfig = activityResult.RefreshedConfig ?? googleHealthConfig;

                var stepsResult = await googleHealthStepsService.PollAndSendAsync(
                    entity.HabitUser.IdentityUserId,
                    effectiveConfig,
                    entity.LastSyncedAtUtc,
                    cancellationToken
                );

                var refreshedConfig = stepsResult.RefreshedConfig ?? activityResult.RefreshedConfig;

                if (refreshedConfig is not null)
                {
                    entity.Config = refreshedConfig;
                }

                activitiesCount = activityResult.ActivitiesCount + stepsResult.ActivitiesCount;

                var errors = new[] { activityResult.Result, stepsResult.Result }
                    .Where(r => r.IsFailure)
                    .Select(r => r.Error)
                    .ToList();

                errorMessage = errors.Count > 0 ? string.Join(" ", errors) : null;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(
                    ex,
                    "Google Health polling failed for config {ConfigId}",
                    entity.Id
                );
                errorMessage = "Unexpected error while syncing Google Health.";
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

using HabitUser.Application.Features.Integration.SyncLogs;
using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using HabitUser.GoogleHealth.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace HabitUser.GoogleHealth.Commands;

/// <summary>Manually syncs the current user's Google Health integration (activities and steps).</summary>
public sealed record SyncGoogleHealthIntegrationCommand
    : ICommand<Result<SyncGoogleHealthIntegrationCommandResponse>>;

public sealed record SyncGoogleHealthIntegrationCommandResponse(int ActivitiesCount);

public sealed class SyncGoogleHealthIntegrationCommandHandler(
    IHabitUserDbContext dbContext,
    ICurrentUserService currentUserService,
    IGoogleHealthActivityService googleHealthActivityService,
    IGoogleHealthStepsService googleHealthStepsService,
    TimeProvider timeProvider,
    ILogger<SyncGoogleHealthIntegrationCommandHandler> logger
)
    : ICommandHandler<
        SyncGoogleHealthIntegrationCommand,
        Result<SyncGoogleHealthIntegrationCommandResponse>
    >
{
    public async ValueTask<Result<SyncGoogleHealthIntegrationCommandResponse>> Handle(
        SyncGoogleHealthIntegrationCommand request,
        CancellationToken cancellationToken
    )
    {
        var userId = currentUserService.UserId;

        var entity = await dbContext
            .IntegrationConfigs.Include(x => x.HabitUser)
            .FirstOrDefaultAsync(
                c =>
                    c.HabitUser.IdentityUserId == userId
                    && c.Provider == IntegrationProvider.GoogleHealth,
                cancellationToken
            );

        if (entity?.Config is not GoogleHealthIntegrationConfig googleHealthConfig)
        {
            return Result<SyncGoogleHealthIntegrationCommandResponse>.NotFound(
                "Google Health integration not found."
            );
        }

        var startedAtUtc = timeProvider.GetUtcNow().UtcDateTime;

        if (await dbContext.IsSyncOnCooldownAsync(entity.Id, startedAtUtc, cancellationToken))
        {
            return Result<SyncGoogleHealthIntegrationCommandResponse>.BadRequest(
                IntegrationSyncCooldown.ManualSyncCooldownError
            );
        }

        var activitiesCount = 0;
        string? errorMessage;

        try
        {
            var activityResult = await googleHealthActivityService.PollAndSendAsync(
                userId,
                googleHealthConfig,
                entity.LastSyncedAtUtc,
                cancellationToken
            );

            // Reuse whatever config the activity call ended up with, so the steps call doesn't
            // attempt a redundant refresh against a token that was just rotated.
            var effectiveConfig = activityResult.RefreshedConfig ?? googleHealthConfig;

            var stepsResult = await googleHealthStepsService.PollAndSendAsync(
                userId,
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
                "Google Health manual sync failed for config {ConfigId}",
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

        await dbContext.SaveChangesAsync(cancellationToken);

        return errorMessage is null
            ? Result<SyncGoogleHealthIntegrationCommandResponse>.Success(
                new SyncGoogleHealthIntegrationCommandResponse(activitiesCount)
            )
            : Result<SyncGoogleHealthIntegrationCommandResponse>.Failure(errorMessage);
    }
}

using HabitUser.Application.Features.Integration.SyncLogs;
using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using HabitUser.Strava.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace HabitUser.Strava.Commands;

/// <summary>Manually syncs the current user's Strava integration.</summary>
public sealed record SyncStravaIntegrationCommand
    : ICommand<Result<SyncStravaIntegrationCommandResponse>>;

public sealed record SyncStravaIntegrationCommandResponse(int ActivitiesCount);

public sealed class SyncStravaIntegrationCommandHandler(
    IHabitUserDbContext dbContext,
    ICurrentUserService currentUserService,
    IStravaActivityService stravaActivityService,
    TimeProvider timeProvider,
    ILogger<SyncStravaIntegrationCommandHandler> logger
) : ICommandHandler<SyncStravaIntegrationCommand, Result<SyncStravaIntegrationCommandResponse>>
{
    public async ValueTask<Result<SyncStravaIntegrationCommandResponse>> Handle(
        SyncStravaIntegrationCommand request,
        CancellationToken cancellationToken
    )
    {
        var userId = currentUserService.UserId;

        var entity = await dbContext
            .IntegrationConfigs.Include(x => x.HabitUser)
            .FirstOrDefaultAsync(
                c => c.HabitUser.IdentityUserId == userId && c.Provider == IntegrationProvider.Strava,
                cancellationToken
            );

        if (entity?.Config is not StravaIntegrationConfig stravaConfig)
        {
            return Result<SyncStravaIntegrationCommandResponse>.NotFound(
                "Strava integration not found."
            );
        }

        var startedAtUtc = timeProvider.GetUtcNow().UtcDateTime;

        if (await dbContext.IsSyncOnCooldownAsync(entity.Id, startedAtUtc, cancellationToken))
        {
            return Result<SyncStravaIntegrationCommandResponse>.BadRequest(
                IntegrationSyncCooldown.ManualSyncCooldownError
            );
        }

        var activitiesCount = 0;
        string? errorMessage;

        try
        {
            var stravaResult = await stravaActivityService.PollAndSendAsync(
                userId,
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
            logger.LogError(ex, "Strava manual sync failed for config {ConfigId}", entity.Id);
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

        await dbContext.SaveChangesAsync(cancellationToken);

        return errorMessage is null
            ? Result<SyncStravaIntegrationCommandResponse>.Success(
                new SyncStravaIntegrationCommandResponse(activitiesCount)
            )
            : Result<SyncStravaIntegrationCommandResponse>.Failure(errorMessage);
    }
}

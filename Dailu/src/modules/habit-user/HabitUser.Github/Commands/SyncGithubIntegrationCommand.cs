using HabitUser.Application.Features.Integration.SyncLogs;
using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using HabitUser.Github.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace HabitUser.Github.Commands;

/// <summary>Manually syncs the current user's GitHub integration.</summary>
public sealed record SyncGithubIntegrationCommand
    : ICommand<Result<SyncGithubIntegrationCommandResponse>>;

public sealed record SyncGithubIntegrationCommandResponse(int ActivitiesCount);

public sealed class SyncGithubIntegrationCommandHandler(
    IHabitUserDbContext dbContext,
    ICurrentUserService currentUserService,
    IGitHubActivityService githubActivityService,
    TimeProvider timeProvider,
    ILogger<SyncGithubIntegrationCommandHandler> logger
) : ICommandHandler<SyncGithubIntegrationCommand, Result<SyncGithubIntegrationCommandResponse>>
{
    public async ValueTask<Result<SyncGithubIntegrationCommandResponse>> Handle(
        SyncGithubIntegrationCommand request,
        CancellationToken cancellationToken
    )
    {
        var userId = currentUserService.UserId;

        var entity = await dbContext
            .IntegrationConfigs.Include(x => x.HabitUser)
            .FirstOrDefaultAsync(
                c => c.HabitUser.IdentityUserId == userId && c.Provider == IntegrationProvider.Github,
                cancellationToken
            );

        if (entity?.Config is not GithubIntegrationConfig githubConfig)
        {
            return Result<SyncGithubIntegrationCommandResponse>.NotFound(
                "GitHub integration not found."
            );
        }

        var startedAtUtc = timeProvider.GetUtcNow().UtcDateTime;

        if (await dbContext.IsSyncOnCooldownAsync(entity.Id, startedAtUtc, cancellationToken))
        {
            return Result<SyncGithubIntegrationCommandResponse>.BadRequest(
                IntegrationSyncCooldown.ManualSyncCooldownError
            );
        }

        var activitiesCount = 0;
        string? errorMessage;

        try
        {
            var result = await githubActivityService.PollAndSendAsync(
                userId,
                githubConfig,
                entity.LastSyncedAtUtc,
                cancellationToken
            );

            activitiesCount = result.ActivitiesCount;
            errorMessage = result.Result.IsFailure ? result.Result.Error : null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "GitHub manual sync failed for config {ConfigId}", entity.Id);
            errorMessage = "Unexpected error while syncing GitHub.";
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
            ? Result<SyncGithubIntegrationCommandResponse>.Success(
                new SyncGithubIntegrationCommandResponse(activitiesCount)
            )
            : Result<SyncGithubIntegrationCommandResponse>.Failure(errorMessage);
    }
}

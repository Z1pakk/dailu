using HabitUser.Application.Features.Integration.SyncLogs;
using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using HabitUser.Github.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;

namespace HabitUser.Github.Commands;

public sealed record PollGithubActivityCommand : ICommand<Result>;

public sealed class PollGithubActivityCommandHandler(
    IHabitUserDbContext dbContext,
    IGitHubActivityService githubActivityService,
    TimeProvider timeProvider,
    ILogger<PollGithubActivityCommandHandler> logger
) : ICommandHandler<PollGithubActivityCommand, Result>
{
    public async ValueTask<Result> Handle(
        PollGithubActivityCommand request,
        CancellationToken cancellationToken
    )
    {
        var integrationConfigs = await dbContext
            .IntegrationConfigs.Include(x => x.HabitUser)
            .Where(c => c.Provider == IntegrationProvider.Github)
            .ToListAsync(cancellationToken);

        foreach (var entity in integrationConfigs)
        {
            if (entity.Config is not GithubIntegrationConfig githubConfig)
            {
                continue;
            }

            var startedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
            var activitiesCount = 0;
            string? errorMessage;

            try
            {
                var result = await githubActivityService.PollAndSendAsync(
                    entity.HabitUser.IdentityUserId,
                    githubConfig,
                    entity.LastSyncedAtUtc,
                    cancellationToken
                );

                activitiesCount = result.ActivitiesCount;
                errorMessage = result.Result.IsFailure ? result.Result.Error : null;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "GitHub polling failed for config {ConfigId}", entity.Id);
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
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.Integrations;
using HabitUser.Github.Services;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;

namespace HabitUser.Github.Commands;

public sealed record PollGithubActivityCommand : ICommand<Result>;

public sealed class PollGithubActivityCommandHandler(
    IHabitUserDbContext dbContext,
    IGitHubActivityService githubActivityService,
    TimeProvider timeProvider
) : ICommandHandler<PollGithubActivityCommand, Result>
{
    public async ValueTask<Result> Handle(
        PollGithubActivityCommand request,
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
            .Where(c => c.Provider == IntegrationProvider.Github)
            .ToListAsync(cancellationToken);

        foreach (var config in userIntegrationConfigs)
        {
            if (config.Config is not GithubIntegrationConfig githubConfig)
            {
                continue;
            }

            var result = await githubActivityService.PollAndSendAsync(
                config.IdentityUserId,
                githubConfig,
                config.LastSyncedAtUtc,
                cancellationToken
            );

            if (result.IsFailure)
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

            entity.LastSyncedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

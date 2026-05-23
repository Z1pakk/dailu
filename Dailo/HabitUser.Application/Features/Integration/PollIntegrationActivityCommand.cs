using HabitUser.Application.Features.Github;
using HabitUser.Application.Features.Strava;
using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.Integrations;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;

namespace HabitUser.Application.Features.Integration;

public record PollIntegrationActivityCommand(IntegrationProvider Provider)
    : ICommand<Result<PollIntegrationActivityCommandResponse>>;

public sealed record PollIntegrationActivityCommandResponse();

public class PollIntegrationActivityCommandHandler(
    IHabitUserDbContext dbContext,
    IGitHubActivityService githubActivityService,
    IStravaActivityService stravaActivityService,
    TimeProvider timeProvider
) : ICommandHandler<PollIntegrationActivityCommand, Result<PollIntegrationActivityCommandResponse>>
{
    public async ValueTask<Result<PollIntegrationActivityCommandResponse>> Handle(
        PollIntegrationActivityCommand request,
        CancellationToken cancellationToken
    )
    {
        var userIntegrationConfigs = await dbContext
            .IntegrationConfigs.AsNoTracking()
            .Select(x => new
            {
                x.Id,
                x.HabitUserId,
                x.HabitUser.IdentityUserId,
                x.Provider,
                x.Config,
                x.LastSyncedAtUtc,
            })
            .Where(c => c.Provider == request.Provider)
            .ToListAsync(cancellationToken);

        foreach (var config in userIntegrationConfigs)
        {
            if (config.Provider == IntegrationProvider.Github)
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
            else if (config.Provider == IntegrationProvider.Strava)
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
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result<PollIntegrationActivityCommandResponse>.Success(
            new PollIntegrationActivityCommandResponse()
        );
    }
}

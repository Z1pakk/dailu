using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.Integrations;
using HabitUser.GoogleHealth.Services;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;

namespace HabitUser.GoogleHealth.Commands;

public class PollGoogleHealthActivityCommand : ICommand<Result>;

public class PollGoogleHealthActivityCommandHandler(
    IHabitUserDbContext dbContext,
    IGoogleHealthActivityService googleHealthActivityService,
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

            var googleHealthResult = await googleHealthActivityService.PollAndSendAsync(
                config.IdentityUserId,
                googleHealthConfig,
                config.LastSyncedAtUtc,
                cancellationToken
            );

            if (googleHealthResult.Result.IsFailure && googleHealthResult.RefreshedConfig is null)
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

            if (googleHealthResult.RefreshedConfig is not null)
            {
                entity.Config = googleHealthResult.RefreshedConfig;
            }

            if (googleHealthResult.Result.IsFailure)
            {
                continue;
            }

            entity.LastSyncedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

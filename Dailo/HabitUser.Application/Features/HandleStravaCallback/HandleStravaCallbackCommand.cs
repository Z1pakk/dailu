using HabitUser.Application.IntegratedServices;
using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.Integrations;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using StrictId;

namespace HabitUser.Application.Features.HandleStravaCallback;

public sealed record HandleStravaCallbackCommand(Guid IdentityUserId, string Code) : ICommand<Result>;

public sealed class HandleStravaCallbackCommandHandler(
    IHabitUserDbContext dbContext,
    IStravaHttpClient stravaClient
) : ICommandHandler<HandleStravaCallbackCommand, Result>
{
    public async ValueTask<Result> Handle(
        HandleStravaCallbackCommand request,
        CancellationToken cancellationToken
    )
    {
        var tokens = await stravaClient.ExchangeAuthorizationCodeAsync(
            request.Code,
            cancellationToken
        );

        if (tokens is null)
        {
            return Result.Failure("Failed to exchange Strava authorization code.");
        }

        var habitUser = await dbContext
            .HabitUsers.AsNoTracking()
            .FirstOrDefaultAsync(u => u.IdentityUserId == request.IdentityUserId, cancellationToken);

        if (habitUser is null)
        {
            return Result.Failure("User not found.");
        }

        var athlete = tokens.Athlete is { } a
            ? new StravaAthlete(a.Id, a.Username, a.FirstName, a.LastName, a.ProfileUrl)
            : null;

        var config = new StravaIntegrationConfig(
            tokens.AccessToken,
            tokens.RefreshToken,
            tokens.ExpiresAtUtc,
            athlete
        );

        var existing = await dbContext.IntegrationConfigs.FirstOrDefaultAsync(
            c => c.HabitUserId == habitUser.Id && c.Provider == IntegrationProvider.Strava,
            cancellationToken
        );

        if (existing is not null)
        {
            existing.Config = config;
        }
        else
        {
            dbContext.IntegrationConfigs.Add(
                new IntegrationConfigEntity
                {
                    Id = Id<IntegrationConfigEntity>.NewId(),
                    HabitUserId = habitUser.Id,
                    Provider = IntegrationProvider.Strava,
                    Config = config,
                }
            );
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

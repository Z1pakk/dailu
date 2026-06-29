using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.Integrations;
using HabitUser.GoogleHealth.Services;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using StrictId;

namespace HabitUser.GoogleHealth.Commands;

public sealed record HandleGoogleHealthCallbackCommand(Guid IdentityUserId, string Code) : ICommand<Result>;

public sealed class HandleGoogleHealthCallbackCommandHandler(
    IHabitUserDbContext dbContext,
    IGoogleHealthHttpClient googleHealthClient
) : ICommandHandler<HandleGoogleHealthCallbackCommand, Result>
{
    public async ValueTask<Result> Handle(
        HandleGoogleHealthCallbackCommand request,
        CancellationToken cancellationToken
    )
    {
        var tokens = await googleHealthClient.ExchangeAuthorizationCodeAsync(
            request.Code,
            cancellationToken
        );

        if (tokens is null)
        {
            return Result.Failure("Failed to exchange Google Health authorization code.");
        }

        var habitUser = await dbContext
            .HabitUsers.AsNoTracking()
            .FirstOrDefaultAsync(u => u.IdentityUserId == request.IdentityUserId, cancellationToken);

        if (habitUser is null)
        {
            return Result.Failure("User not found.");
        }

        var config = new GoogleHealthIntegrationConfig(
            tokens.AccessToken,
            tokens.RefreshToken,
            tokens.ExpiresAtUtc
        );

        var existing = await dbContext.IntegrationConfigs.FirstOrDefaultAsync(
            c => c.HabitUserId == habitUser.Id && c.Provider == IntegrationProvider.GoogleHealth,
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
                    Provider = IntegrationProvider.GoogleHealth,
                    Config = config,
                }
            );
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

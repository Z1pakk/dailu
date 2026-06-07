using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.Integrations;
using HabitUser.Github.Services;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using StrictId;

namespace HabitUser.Github.Commands;

public sealed record HandleGithubCallbackCommand(Guid IdentityUserId, string Code) : ICommand<Result>;

public sealed class HandleGithubCallbackCommandHandler(
    IHabitUserDbContext dbContext,
    IGitHubHttpClient githubClient
) : ICommandHandler<HandleGithubCallbackCommand, Result>
{
    public async ValueTask<Result> Handle(
        HandleGithubCallbackCommand request,
        CancellationToken cancellationToken
    )
    {
        var accessToken = await githubClient.ExchangeAuthorizationCodeAsync(
            request.Code,
            cancellationToken
        );

        if (accessToken is null)
        {
            return Result.Failure("Failed to exchange GitHub authorization code.");
        }

        var habitUser = await dbContext
            .HabitUsers.AsNoTracking()
            .FirstOrDefaultAsync(u => u.IdentityUserId == request.IdentityUserId, cancellationToken);

        if (habitUser is null)
        {
            return Result.Failure("User not found.");
        }

        var config = new GithubIntegrationConfig(accessToken, ExpiresAtUtc: null);

        var existing = await dbContext.IntegrationConfigs.FirstOrDefaultAsync(
            c => c.HabitUserId == habitUser.Id && c.Provider == IntegrationProvider.Github,
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
                    Provider = IntegrationProvider.Github,
                    Config = config,
                }
            );
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

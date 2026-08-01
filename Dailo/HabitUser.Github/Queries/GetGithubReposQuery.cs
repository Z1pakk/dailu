using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using HabitUser.Github.Models;
using HabitUser.Github.Services;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace HabitUser.Github.Queries;

public sealed class GetGithubReposQuery : IQuery<Result<GetGithubReposQueryResponse>> { }

public sealed record GetGithubReposQueryResponse(IEnumerable<GitHubRepositoryModel> Repositories);

public sealed class GetGithubReposQueryHandler(
    IHabitUserDbContext dbContext,
    ICurrentUserService currentUserService,
    IGitHubHttpClient githubHttpClient
) : IQueryHandler<GetGithubReposQuery, Result<GetGithubReposQueryResponse>>
{
    public async ValueTask<Result<GetGithubReposQueryResponse>> Handle(
        GetGithubReposQuery request,
        CancellationToken cancellationToken
    )
    {
        var userId = currentUserService.UserId;

        var config = await dbContext
            .IntegrationConfigs.AsNoTracking()
            .Where(x =>
                x.HabitUser.IdentityUserId == userId && x.Provider == IntegrationProvider.Github
            )
            .Select(x => x.Config)
            .FirstOrDefaultAsync(cancellationToken);

        if (config is not GithubIntegrationConfig githubConfig)
        {
            return Result<GetGithubReposQueryResponse>.Failure("GitHub integration not found.");
        }

        var reposResult = await githubHttpClient.GetUserRepositoriesAsync(
            githubConfig.AccessToken,
            cancellationToken
        );

        if (reposResult is null || reposResult.IsFailure)
        {
            return Result<GetGithubReposQueryResponse>.Failure(
                "Failed to fetch GitHub repositories."
            );
        }

        return Result<GetGithubReposQueryResponse>.Success(
            new GetGithubReposQueryResponse(reposResult.Value)
        );
    }
}

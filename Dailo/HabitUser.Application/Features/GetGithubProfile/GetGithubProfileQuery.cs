using HabitUser.Application.IntegratedServices;
using HabitUser.Application.Models;
using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.Integrations;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace HabitUser.Application.Features.GetGithubProfile;

public sealed class GetGithubProfileQuery : IQuery<Result<GetGithubProfileQueryResponse>> { }

public sealed record GetGithubProfileQueryResponse(GitHubUserProfileModel Profile);

public sealed class GetGithubProfileQueryHandler(
    IHabitUserDbContext dbContext,
    ICurrentUserService currentUserService,
    IGitHubHttpClient githubHttpClient
) : IQueryHandler<GetGithubProfileQuery, Result<GetGithubProfileQueryResponse>>
{
    public async ValueTask<Result<GetGithubProfileQueryResponse>> Handle(
        GetGithubProfileQuery request,
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
            return Result<GetGithubProfileQueryResponse>.Failure("GitHub integration not found.");
        }

        var profile = await githubHttpClient.GetUserProfileAsync(
            githubConfig.AccessToken,
            cancellationToken
        );

        if (profile is null)
        {
            return Result<GetGithubProfileQueryResponse>.Failure("Failed to fetch GitHub profile.");
        }

        return Result<GetGithubProfileQueryResponse>.Success(
            new GetGithubProfileQueryResponse(profile)
        );
    }
}

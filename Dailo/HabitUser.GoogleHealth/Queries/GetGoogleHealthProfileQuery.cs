using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.Integrations;
using HabitUser.GoogleHealth.Models;
using HabitUser.GoogleHealth.Services;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace HabitUser.GoogleHealth.Queries;

public sealed class GetGoogleHealthProfileQuery : IQuery<Result<GetGoogleHealthProfileQueryResponse>> { }

public sealed record GetGoogleHealthProfileQueryResponse(GoogleHealthUserProfileModel Profile);

public sealed class GetGoogleHealthProfileQueryHandler(
    IHabitUserDbContext dbContext,
    ICurrentUserService currentUserService,
    IGoogleHealthHttpClient googleHealthHttpClient
) : IQueryHandler<GetGoogleHealthProfileQuery, Result<GetGoogleHealthProfileQueryResponse>>
{
    public async ValueTask<Result<GetGoogleHealthProfileQueryResponse>> Handle(
        GetGoogleHealthProfileQuery request,
        CancellationToken cancellationToken
    )
    {
        var userId = currentUserService.UserId;

        var config = await dbContext
            .IntegrationConfigs.AsNoTracking()
            .Where(x =>
                x.HabitUser.IdentityUserId == userId && x.Provider == IntegrationProvider.GoogleHealth
            )
            .Select(x => x.Config)
            .FirstOrDefaultAsync(cancellationToken);

        if (config is not GoogleHealthIntegrationConfig googleHealthConfig)
        {
            return Result<GetGoogleHealthProfileQueryResponse>.Failure("Google Health integration not found.");
        }

        var profile = await googleHealthHttpClient.GetUserProfileAsync(
            googleHealthConfig.AccessToken,
            cancellationToken
        );

        if (profile is null)
        {
            return Result<GetGoogleHealthProfileQueryResponse>.Failure("Failed to fetch Google Health profile.");
        }

        return Result<GetGoogleHealthProfileQueryResponse>.Success(
            new GetGoogleHealthProfileQueryResponse(profile)
        );
    }
}

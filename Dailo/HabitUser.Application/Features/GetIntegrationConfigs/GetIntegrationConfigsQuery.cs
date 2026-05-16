using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.Integrations;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace HabitUser.Application.Features.GetIntegrationConfigs;

public sealed class GetIntegrationConfigsQuery
    : IQuery<Result<GetIntegrationConfigsQueryResponse>> { }

public sealed record GetIntegrationConfigsQueryResponse(
    IReadOnlyList<IntegrationSummary> Summaries
);

public sealed class GetIntegrationConfigsQueryHandler(
    IHabitUserDbContext dbContext,
    ICurrentUserService currentUserService
) : IQueryHandler<GetIntegrationConfigsQuery, Result<GetIntegrationConfigsQueryResponse>>
{
    public async ValueTask<Result<GetIntegrationConfigsQueryResponse>> Handle(
        GetIntegrationConfigsQuery request,
        CancellationToken cancellationToken
    )
    {
        var userId = currentUserService.UserId;

        var entities = await dbContext
            .IntegrationConfigs.Where(x => x.HabitUser.IdentityUserId == userId)
            .ToListAsync(cancellationToken);

        var summaries = entities.Select(ToSummary).ToList();

        return Result<GetIntegrationConfigsQueryResponse>.Success(
            new GetIntegrationConfigsQueryResponse(summaries)
        );
    }

    private static IntegrationSummary ToSummary(IntegrationConfigEntity entity)
    {
        var savedAt = entity.LastModifiedAtUtc ?? entity.CreatedAtUtc;

        return entity.Config switch
        {
            GithubIntegrationConfig github => new GithubIntegrationSummary(
                github.ExpiresInDays.HasValue ? savedAt.AddDays(github.ExpiresInDays.Value) : null
            ),
            StravaIntegrationConfig => new StravaIntegrationSummary(),
            _ => throw new ArgumentException("Unknown integration config type."),
        };
    }
}

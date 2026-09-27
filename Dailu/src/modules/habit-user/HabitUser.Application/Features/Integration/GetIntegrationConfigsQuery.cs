using HabitUser.Application.Features.Integration.Models;
using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace HabitUser.Application.Features.Integration;

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

        var configIds = entities.Select(x => x.Id).ToList();

        var lastSyncs = await dbContext
            .IntegrationSyncLogs.AsNoTracking()
            .Where(x => configIds.Contains(x.IntegrationConfigId))
            .GroupBy(x => x.IntegrationConfigId)
            .Select(g =>
                g.OrderByDescending(x => x.StartedAtUtc)
                    .Select(x => new
                    {
                        x.IntegrationConfigId,
                        Log = new IntegrationSyncLogModel(
                            x.StartedAtUtc,
                            x.FinishedAtUtc,
                            x.Status,
                            x.ActivitiesCount,
                            x.ErrorMessage
                        ),
                    })
                    .First()
            )
            .ToDictionaryAsync(x => x.IntegrationConfigId, x => x.Log, cancellationToken);

        var summaries = entities
            .Select(x => ToSummary(x) with { LastSync = lastSyncs.GetValueOrDefault(x.Id) })
            .ToList();

        return Result<GetIntegrationConfigsQueryResponse>.Success(
            new GetIntegrationConfigsQueryResponse(summaries)
        );
    }

    private static IntegrationSummary ToSummary(IntegrationConfigEntity entity)
    {
        return entity.Config switch
        {
            GithubIntegrationConfig github => new GithubIntegrationSummary(github.ExpiresAtUtc),
            StravaIntegrationConfig strava => new StravaIntegrationSummary(
                strava.ExpiresAtUtc,
                strava.Athlete is { } a
                    ? new StravaAthleteInfo(a.Id, a.Username, a.FirstName, a.LastName, a.ProfileUrl)
                    : null
            ),
            GoogleHealthIntegrationConfig google => new GoogleHealthIntegrationSummary(
                google.ExpiresAtUtc
            ),
            _ => throw new ArgumentException("Unknown integration config type."),
        };
    }
}

using HabitUser.Application.Features.Integration.Models;
using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace HabitUser.Application.Features.Integration.SyncLogs;

public sealed record GetIntegrationSyncLogsQuery(IntegrationProvider Provider, int Take)
    : IQuery<Result<GetIntegrationSyncLogsQueryResponse>>
{
    public const int DefaultTake = 10;
    public const int MaxTake = 50;
}

public sealed record GetIntegrationSyncLogsQueryResponse(IReadOnlyList<IntegrationSyncLogModel> Logs);

public sealed class GetIntegrationSyncLogsQueryHandler(
    IHabitUserDbContext dbContext,
    ICurrentUserService currentUserService
) : IQueryHandler<GetIntegrationSyncLogsQuery, Result<GetIntegrationSyncLogsQueryResponse>>
{
    public async ValueTask<Result<GetIntegrationSyncLogsQueryResponse>> Handle(
        GetIntegrationSyncLogsQuery request,
        CancellationToken cancellationToken
    )
    {
        var userId = currentUserService.UserId;
        var take = Math.Clamp(request.Take, 1, GetIntegrationSyncLogsQuery.MaxTake);

        var logs = await dbContext
            .IntegrationSyncLogs.AsNoTracking()
            .Where(x =>
                x.IntegrationConfig.HabitUser.IdentityUserId == userId
                && x.IntegrationConfig.Provider == request.Provider
            )
            .OrderByDescending(x => x.StartedAtUtc)
            .Take(take)
            .Select(x => new IntegrationSyncLogModel(
                x.StartedAtUtc,
                x.FinishedAtUtc,
                x.Status,
                x.ActivitiesCount,
                x.ErrorMessage
            ))
            .ToListAsync(cancellationToken);

        return Result<GetIntegrationSyncLogsQueryResponse>.Success(
            new GetIntegrationSyncLogsQueryResponse(logs)
        );
    }
}

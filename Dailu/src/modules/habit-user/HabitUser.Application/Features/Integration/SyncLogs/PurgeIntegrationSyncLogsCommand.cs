using HabitUser.Application.Persistence;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;

namespace HabitUser.Application.Features.Integration.SyncLogs;

public sealed record PurgeIntegrationSyncLogsCommand : ICommand<Result>
{
    public static readonly TimeSpan Retention = TimeSpan.FromDays(30);
}

public sealed class PurgeIntegrationSyncLogsCommandHandler(
    IHabitUserDbContext dbContext,
    TimeProvider timeProvider
) : ICommandHandler<PurgeIntegrationSyncLogsCommand, Result>
{
    public async ValueTask<Result> Handle(
        PurgeIntegrationSyncLogsCommand request,
        CancellationToken cancellationToken
    )
    {
        var threshold =
            timeProvider.GetUtcNow().UtcDateTime - PurgeIntegrationSyncLogsCommand.Retention;

        await dbContext
            .IntegrationSyncLogs.IgnoreQueryFilters()
            .Where(x => x.StartedAtUtc < threshold)
            .ExecuteDeleteAsync(cancellationToken);

        return Result.Success();
    }
}

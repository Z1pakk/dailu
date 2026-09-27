using HabitUser.Application.Features.Integration.SyncLogs;
using Mediator;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HabitUser.Infrastructure.Workers;

public sealed class IntegrationSyncLogCleanupWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<IntegrationSyncLogCleanupWorker> logger
) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var sender = scope.ServiceProvider.GetRequiredService<ISender>();
                await sender.Send(new PurgeIntegrationSyncLogsCommand(), stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Integration sync log cleanup failed");
            }

            await timer.WaitForNextTickAsync(stoppingToken);
        }
    }
}

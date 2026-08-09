using HabitUser.GoogleHealth.Commands;
using Mediator;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HabitUser.GoogleHealth.Workers;

public class GoogleHealthActivityWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<GoogleHealthActivityWorker> logger
) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var sender = scope.ServiceProvider.GetRequiredService<ISender>();
                await sender.Send(new PollGoogleHealthActivityCommand(), stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Google health activity polling failed");
            }

            await timer.WaitForNextTickAsync(stoppingToken);
        }
    }
}

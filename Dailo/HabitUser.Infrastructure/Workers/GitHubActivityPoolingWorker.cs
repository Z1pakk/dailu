using HabitUser.Application.Features.Integration;
using HabitUser.Domain.Entities;
using Mediator;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HabitUser.Infrastructure.Workers;

public class GitHubActivityPoolingWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<GitHubActivityPoolingWorker> logger
) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(2));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var sender = scope.ServiceProvider.GetRequiredService<ISender>();
                await sender.Send(
                    new PollIntegrationActivityCommand(IntegrationProvider.Github),
                    stoppingToken
                );
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "GitHub activity polling failed");
            }

            await timer.WaitForNextTickAsync(stoppingToken);
        }
    }
}

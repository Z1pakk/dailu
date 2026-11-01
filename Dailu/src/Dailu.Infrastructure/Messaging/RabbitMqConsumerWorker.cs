using Dailu.Events;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Dailu.Infrastructure.Messaging;

public sealed class RabbitMqConsumerWorker : BackgroundService
{
    private readonly RabbitMqQueueConsumer[] _consumers;

    public RabbitMqConsumerWorker(
        IEnumerable<IntegrationEventSubscription> subscriptions,
        RabbitMqConnection connection,
        IServiceScopeFactory scopeFactory,
        ILoggerFactory loggerFactory
    )
    {
        var all = subscriptions.ToArray();

        // runs when the host starts: a bad subscription fails startup, not the first message
        var duplicate = all.GroupBy(s => s.Queue).FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null)
        {
            throw new InvalidOperationException(
                $"Queue '{duplicate.Key}' is subscribed by more than one module."
            );
        }

        foreach (var eventType in all.SelectMany(s => s.EventTypes))
        {
            IntegrationEventTypes.GetEventNameOf(eventType);
        }

        var consumerLogger = loggerFactory.CreateLogger<RabbitMqQueueConsumer>();

        _consumers = all.Select(s => new RabbitMqQueueConsumer(
                s,
                connection,
                scopeFactory,
                consumerLogger
            ))
            .ToArray();
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
        Task.WhenAll(_consumers.Select(c => c.RunAsync(stoppingToken)));

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        foreach (var consumer in _consumers)
        {
            await consumer.StopAsync(cancellationToken);
        }

        await base.StopAsync(cancellationToken);
    }
}

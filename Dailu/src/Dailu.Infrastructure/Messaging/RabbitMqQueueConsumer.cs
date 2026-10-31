using System.Text.Json;
using Dailu.Events;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using SharedKernel.Event;

namespace Dailu.Infrastructure.Messaging;

/// <summary>Consumes one module's queue. Created by <see cref="RabbitMqConsumerWorker"/>, not by DI.</summary>
public sealed class RabbitMqQueueConsumer(
    IntegrationEventSubscription subscription,
    RabbitMqConnection connection,
    IServiceScopeFactory scopeFactory,
    ILogger<RabbitMqQueueConsumer> logger
)
{
    private const int MaxAttempts = 5;

    private readonly IntegrationEventSubscription _subscription = subscription;
    private readonly string _deadLetterQueue = RabbitMqTopology.DeadLetterQueueOf(
        subscription.Queue
    );

    private IChannel? _channel;

    public async Task RunAsync(CancellationToken stoppingToken)
    {
        // automatic recovery only covers connections that were established once,
        // so the first connect (broker still starting) is retried here
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await StartConsumingAsync(stoppingToken);
                return; // deliveries now arrive on the client's dispatcher
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(
                    ex,
                    "Can't start consuming {Queue}; retrying in 10 s",
                    _subscription.Queue
                );
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }
    }

    private async Task StartConsumingAsync(CancellationToken ct)
    {
        var amqpConnection = await connection.GetAsync(ct);
        _channel = await amqpConnection.CreateChannelAsync(cancellationToken: ct);

        await RabbitMqTopology.DeclareConsumerAsync(_channel, _subscription, ct);

        // one unacked message at a time: in order, and a slow handler can't
        // pull the whole queue into memory
        await _channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false, ct);

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.ReceivedAsync += OnReceivedAsync;

        await _channel.BasicConsumeAsync(_subscription.Queue, autoAck: false, consumer, ct);
    }

    private async Task OnReceivedAsync(object sender, BasicDeliverEventArgs delivery)
    {
        var channel = ((AsyncEventingBasicConsumer)sender).Channel;

        IIntegrationEvent integrationEvent;
        try
        {
            var type = IntegrationEventTypes.Resolve(delivery.BasicProperties.Type ?? "");
            integrationEvent = (IIntegrationEvent)
                JsonSerializer.Deserialize(
                    delivery.Body.Span,
                    type,
                    IntegrationEventJsonConst.Options
                )!;
        }
        catch (Exception ex)
        {
            // retrying can't fix a message we can't read
            await ParkAsync(channel, delivery, ex);
            return;
        }

        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            await ModuleHandlers.InvokeAsync(
                scope.ServiceProvider,
                integrationEvent,
                _subscription.Module,
                delivery.CancellationToken
            );

            await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false);
        }
        catch (Exception ex)
        {
            var attempt =
                RabbitMqDeathHeader.GetRejectedCount(delivery.BasicProperties, _subscription.Queue)
                + 1;

            if (attempt >= MaxAttempts)
            {
                await ParkAsync(channel, delivery, ex);
                return;
            }

            logger.LogWarning(
                ex,
                "{EventType} {MessageId} failed (attempt {Attempt}/{MaxAttempts}); retrying in {Delay} ms",
                delivery.BasicProperties.Type,
                delivery.BasicProperties.MessageId,
                attempt,
                MaxAttempts,
                RabbitMqTopology.RetryDelayMs
            );

            // requeue: false → dead-lettered to the retry queue instead of straight back to the front
            await channel.BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: false);
        }
    }

    private async Task ParkAsync(IChannel channel, BasicDeliverEventArgs delivery, Exception error)
    {
        logger.LogError(
            error,
            "Parking {EventType} {MessageId} in {DeadLetterQueue}",
            delivery.BasicProperties.Type,
            delivery.BasicProperties.MessageId,
            _deadLetterQueue
        );

        var properties = new BasicProperties(delivery.BasicProperties)
        {
            Headers = new Dictionary<string, object?>(
                delivery.BasicProperties.Headers ?? new Dictionary<string, object?>()
            )
            {
                ["x-last-error"] = error.Message,
            },
        };

        // body is only valid until this handler returns, so publish before acking
        await channel.BasicPublishAsync(
            "",
            _deadLetterQueue,
            mandatory: false,
            properties,
            delivery.Body
        );
        await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false);
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_channel is not null)
        {
            // unacked in-flight message goes back to the queue and is redelivered on next start
            await _channel.CloseAsync(cancellationToken);
            await _channel.DisposeAsync();
        }
    }
}

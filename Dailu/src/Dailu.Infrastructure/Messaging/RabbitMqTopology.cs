using Dailu.Events;
using RabbitMQ.Client;

namespace Dailu.Infrastructure.Messaging;

public static class RabbitMqTopology
{
    // exchange on the rabbit mq that is used for events
    public const string Exchange = "dailu.integration";

    public const int RetryDelayMs = 10_000;

    public static string RetryQueueOf(string queue) => $"{queue}.retry";

    public static string DeadLetterQueueOf(string queue) => $"{queue}.dlq";

    public static async Task DeclareConsumerAsync(
        IChannel channel,
        IntegrationEventSubscription subscription,
        CancellationToken ct
    )
    {
        var retryQueueName = RetryQueueOf(subscription.Queue);
        var deadLetterQueueName = DeadLetterQueueOf(subscription.Queue);

        // Each consumer declares its own three queues.
        await channel.ExchangeDeclareAsync(
            Exchange,
            ExchangeType.Topic,
            durable: true,
            autoDelete: false,
            cancellationToken: ct
        );

        await channel.QueueDeclareAsync(
            subscription.Queue,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: new Dictionary<string, object?>
            {
                ["x-queue-type"] = "quorum",
                ["x-dead-letter-exchange"] = "", // default exchange: routes by queue name
                ["x-dead-letter-routing-key"] = retryQueueName,
            },
            cancellationToken: ct
        );

        await channel.QueueDeclareAsync(
            retryQueueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: new Dictionary<string, object?>
            {
                ["x-queue-type"] = "quorum",
                ["x-message-ttl"] = RetryDelayMs,
                ["x-dead-letter-exchange"] = "",
                ["x-dead-letter-routing-key"] = subscription.Queue, // expired → back to the main queue
            },
            cancellationToken: ct
        );

        await channel.QueueDeclareAsync(
            deadLetterQueueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: new Dictionary<string, object?> { ["x-queue-type"] = "quorum" },
            cancellationToken: ct
        );

        foreach (var eventType in subscription.EventTypes)
        {
            await channel.QueueBindAsync(
                subscription.Queue,
                Exchange,
                routingKey: IntegrationEventTypes.GetEventNameOf(eventType),
                cancellationToken: ct
            );
        }
    }
}

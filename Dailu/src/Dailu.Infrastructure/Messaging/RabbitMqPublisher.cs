using System.Collections.Concurrent;
using System.Net.Mime;
using System.Text.Json;
using Dailu.Events;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using SharedKernel.Event;

namespace Dailu.Infrastructure.Messaging;

public class RabbitMqPublisher(RabbitMqConnection connection) : IAsyncDisposable
{
    private const string SequenceHeader = "x-publish-seq";
    private static readonly TimeSpan ConfirmTimeout = TimeSpan.FromSeconds(10);

    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly ConcurrentDictionary<ulong, PendingConfirm> _pendingConfirms = new();
    private IChannel? _channel;

    public async Task PublishAsync(
        IIntegrationEvent integrationEvent,
        CancellationToken cancellationToken
    )
    {
        var type = integrationEvent.GetType();
        var name = IntegrationEventTypes.GetEventNameOf(type);
        var body = JsonSerializer.SerializeToUtf8Bytes(
            integrationEvent,
            type,
            IntegrationEventJsonConst.Options
        );

        var pending = new PendingConfirm(name);
        ulong sequence;

        await _lock.WaitAsync(cancellationToken);

        try
        {
            var channel = await GetChannelAsync(cancellationToken);

            // take the number and send under the same lock, so the broker's numbering
            // (one per publish on this channel) matches ours
            sequence = await channel.GetNextPublishSequenceNumberAsync(cancellationToken);

            _pendingConfirms[sequence] = pending;

            var properties = new BasicProperties
            {
                MessageId = Guid.CreateVersion7().ToString(), // once per publish, see 2.2
                Type = name,
                AppId = "dailu-api", // CloudEvents "source", see 2.2
                ContentType = MediaTypeNames.Application.Json,
                DeliveryMode = DeliveryModes.Persistent, // survive a broker restart
                Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds()),
                // a returned message has no delivery tag; this is how OnReturnAsync finds it
                Headers = new Dictionary<string, object?> { [SequenceHeader] = (long)sequence },
            };

            try
            {
                // returns once the frames are written, *not* when the broker confirms
                await channel.BasicPublishAsync(
                    RabbitMqTopology.Exchange,
                    routingKey: name,
                    mandatory: true,
                    basicProperties: properties,
                    body: body,
                    cancellationToken: cancellationToken
                );
            }
            catch
            {
                _pendingConfirms.TryRemove(sequence, out _);
                throw;
            }
        }
        finally
        {
            _lock.Release();
        }

        // outside the lock: other publishes go out while we wait for our ack
        try
        {
            await pending.Confirmed.Task.WaitAsync(ConfirmTimeout, cancellationToken);
        }
        catch (Exception ex) when (ex is TimeoutException or OperationCanceledException)
        {
            // we've stopped waiting; don't leave the entry behind. A late ack finds nothing,
            // which is harmless
            _pendingConfirms.TryRemove(sequence, out _);
            throw;
        }
    }

    private async Task<IChannel> GetChannelAsync(CancellationToken cancellationToken)
    {
        if (_channel is { IsOpen: true })
        {
            return _channel;
        }

        if (_channel is not null)
        {
            // closed by a channel-level error (e.g. a failed declare); those don't auto-recover
            await _channel.DisposeAsync();
        }

        var currentConnection = await connection.GetAsync(cancellationToken);

        _channel = await currentConnection.CreateChannelAsync(
            new CreateChannelOptions(
                publisherConfirmationsEnabled: true, // broker sends acks/nacks
                publisherConfirmationTrackingEnabled: false // ...and we match them ourselves
            ),
            cancellationToken
        );

        // once per channel; an auto-recovered channel keeps its handlers
        _channel.BasicAcksAsync += OnAckAsync;
        _channel.BasicNacksAsync += OnNackAsync;
        _channel.BasicReturnAsync += OnReturnAsync;
        _channel.ChannelShutdownAsync += OnShutdownAsync;

        // declare exchange only for a new channel
        await _channel.ExchangeDeclareAsync(
            RabbitMqTopology.Exchange,
            ExchangeType.Topic,
            durable: true,
            autoDelete: false,
            cancellationToken: cancellationToken
        );

        return _channel;
    }

    private Task OnAckAsync(object sender, BasicAckEventArgs e)
    {
        foreach (var pending in Take(e.DeliveryTag, e.Multiple))
        {
            if (pending.Returned)
            {
                pending.Confirmed.TrySetException(
                    new InvalidOperationException(
                        $"{pending.EventType} is unroutable: no queue is bound for it."
                    )
                );
            }
            else
            {
                pending.Confirmed.TrySetResult();
            }
        }

        return Task.CompletedTask;
    }

    private Task OnNackAsync(object sender, BasicNackEventArgs e)
    {
        foreach (var pending in Take(e.DeliveryTag, e.Multiple))
        {
            pending.Confirmed.TrySetException(
                new InvalidOperationException($"The broker nacked {pending.EventType}.")
            );
        }

        return Task.CompletedTask;
    }

    private Task OnReturnAsync(object sender, BasicReturnEventArgs e)
    {
        // the broker sends basic.return *before* the basic.ack for the same message
        if (
            e.BasicProperties.Headers?.TryGetValue(SequenceHeader, out var raw) == true
            && raw is long sequence
            && _pendingConfirms.TryGetValue((ulong)sequence, out var pending)
        )
        {
            pending.Returned = true;
        }

        return Task.CompletedTask;
    }

    private Task OnShutdownAsync(object sender, ShutdownEventArgs e)
    {
        // no acks will come for these; sequence numbers restart on a recovered channel
        FailAll(
            new InvalidOperationException(
                $"Channel closed before the broker confirmed: {e.ReplyText}"
            )
        );
        return Task.CompletedTask;
    }

    // multiple = true confirms every sequence number up to and including tag
    private List<PendingConfirm> Take(ulong tag, bool multiple)
    {
        var sequences = multiple ? _pendingConfirms.Keys.Where(s => s <= tag).ToList() : [tag];
        var taken = new List<PendingConfirm>(sequences.Count);

        foreach (var sequence in sequences)
        {
            if (_pendingConfirms.TryRemove(sequence, out var pending))
            {
                taken.Add(pending);
            }
        }

        return taken;
    }

    private void FailAll(Exception error)
    {
        foreach (var sequence in _pendingConfirms.Keys)
        {
            if (_pendingConfirms.TryRemove(sequence, out var pending))
            {
                pending.Confirmed.TrySetException(error);
            }
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel is not null)
        {
            await _channel.CloseAsync();
            await _channel.DisposeAsync();
        }

        FailAll(new ObjectDisposedException(nameof(RabbitMqPublisher)));
        _lock.Dispose();
    }

    private sealed class PendingConfirm(string eventType)
    {
        public string EventType { get; } = eventType;

        // continuations must not run on the client's dispatch thread, or one slow caller
        // would hold up every other ack
        public TaskCompletionSource Confirmed { get; } =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public volatile bool Returned;
    }
}

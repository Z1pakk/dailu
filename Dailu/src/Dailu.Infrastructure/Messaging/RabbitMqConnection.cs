using RabbitMQ.Client;

namespace Dailu.Infrastructure.Messaging;

public class RabbitMqConnection(RabbitMqOptions options) : IAsyncDisposable
{
    private readonly SemaphoreSlim _lock = new(1, 1);

    private IConnection? _connection;

    public async Task<IConnection> GetAsync(CancellationToken cancellationToken)
    {
        // don't check IsOpen: during automatic recovery it's false and we'd open a second connection
        if (_connection is not null)
        {
            return _connection;
        }

        await _lock.WaitAsync(cancellationToken);
        try
        {
#pragma warning disable CA1508
            if (_connection is not null)
#pragma warning restore CA1508
            {
                return _connection;
            }

            var factory = new ConnectionFactory()
            {
                HostName = options.Host,
                Port = options.Port,
                UserName = options.UserName,
                Password = options.Password,
                VirtualHost = options.VirtualHost,
                ClientProvidedName = "dailu-api", // shown in the UI's Connections tab
                AutomaticRecoveryEnabled = true, // default, spelled out on purpose
                TopologyRecoveryEnabled = true,
            };

            _connection = await factory.CreateConnectionAsync(cancellationToken);

            return _connection;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection is not null)
        {
            await _connection.CloseAsync();
            _connection.Dispose();
        }

        _lock.Dispose();
    }
}

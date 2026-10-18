# Phase 1 — Broker and connection

**Goal:** RabbitMQ running next to Postgres, its management UI reachable, connection settings in
`appsettings`, and one shared, lazily created `IConnection` in the API.

**Builds on:** [tutorial 1](https://www.rabbitmq.com/tutorials/tutorial-one-dotnet) (connection,
channel) and the [.NET client API guide](https://www.rabbitmq.com/client-libraries/dotnet-api-guide)
sections on connections, channels and automatic recovery.

```
src/shared/SharedInfrastructure/Messaging/
├── RabbitMqOptions.cs        ← "RabbitMq" config section
├── RabbitMqConnection.cs     ← one IConnection per process, created on first use
└── Setup.cs                  ← AddRabbitMq()
```

---

## 1.1 Run RabbitMQ

Add a service to `docker-compose.yml`, next to `dailo.postgres`:

```yaml
  dailo.rabbitmq:
    image: rabbitmq:4-management
    hostname: dailo-rabbitmq            # node name (and so the data directory) depends on it
    environment:
      RABBITMQ_DEFAULT_USER: dailo
      RABBITMQ_DEFAULT_PASS: Dailo123!@
    volumes:
      - dailo_rabbitmq_data:/var/lib/rabbitmq
    ports:
      - 5672:5672                       # AMQP
      - 15672:15672                     # management UI
```

and the volume:

```yaml
volumes:
  dailo_posgres_data:
    external: false
  dailo_rabbitmq_data:
    external: false
```

- **`-management` image** — the same broker plus the web UI on port 15672. You'll use the UI in
  every Verify step: queues, bindings, message rates, "Get messages" to peek at payloads.
- **`hostname` is not cosmetic.** RabbitMQ stores data under a directory named after the node
  (`rabbit@<hostname>`). Without a fixed hostname, every recreated container gets a new random
  one and "loses" the queues and messages that are still in the volume.
- **Default user** — `RABBITMQ_DEFAULT_USER/PASS` only apply when the data volume is empty. The
  built-in `guest` user only works from localhost *inside* the container, so you'd need this
  anyway.
- **Production** — don't reuse these credentials; put them in `docker-compose.override.prod.yml`
  or environment variables, the same way the Postgres password should be handled.

```
docker compose up -d dailo.rabbitmq
```

## 1.2 Packages

`Directory.Packages.props`:

```xml
<PackageVersion Include="RabbitMQ.Client" Version="7.2.1" />
<PackageVersion Include="Microsoft.Extensions.Hosting.Abstractions" Version="10.0.10" />
```

Check [nuget.org](https://www.nuget.org/packages/RabbitMQ.Client/) for the latest 7.x patch
before pinning. `Microsoft.Extensions.Hosting.Abstractions` is for `BackgroundService` in phase
3; skip it if `SharedInfrastructure` already gets it transitively.

`src/shared/SharedInfrastructure/SharedInfrastructure.csproj`:

```xml
<PackageReference Include="RabbitMQ.Client" />
<PackageReference Include="Microsoft.Extensions.Hosting.Abstractions" />
```

## 1.3 Options

`src/shared/SharedInfrastructure/Messaging/RabbitMqOptions.cs` — same shape as `AiOptions`:

```csharp
public sealed class RabbitMqOptions : IOptions        // SharedKernel.Options.IOptions
{
    public string SectionName => "RabbitMq";

    /// <summary>
    /// False keeps every integration event in-memory and starts no consumers — for tests and for
    /// running the API without the broker.
    /// </summary>
    public bool Enabled { get; init; } = true;

    [Required]
    public string Host { get; init; } = "localhost";

    [Range(1, 65535)]
    public int Port { get; init; } = 5672;

    [Required]
    public string UserName { get; init; } = "";

    [Required]
    public string Password { get; init; } = "";

    public string VirtualHost { get; init; } = "/";
}
```

`src/api/Dailu.Api/appsettings.Development.json`:

```json
"RabbitMq": {
  "Enabled": true,
  "Host": "localhost",
  "Port": 5672,
  "UserName": "dailo",
  "Password": "Dailo123!@"
}
```

**Decision:** `Enabled` is a single switch on purpose. Integration tests that boot the API set it
to `false` and keep today's synchronous behaviour, so they don't need a broker and don't have to
wait for background indexing.

## 1.4 One connection per process

`src/shared/SharedInfrastructure/Messaging/RabbitMqConnection.cs`:

```csharp
public sealed class RabbitMqConnection(RabbitMqOptions options) : IAsyncDisposable
{
    private readonly SemaphoreSlim _lock = new(1, 1);
    private IConnection? _connection;

    public async Task<IConnection> GetAsync(CancellationToken ct)
    {
        if (_connection is not null)
        {
            return _connection;
        }

        await _lock.WaitAsync(ct);
        try
        {
            if (_connection is not null)
            {
                return _connection;
            }

            var factory = new ConnectionFactory
            {
                HostName = options.Host,
                Port = options.Port,
                UserName = options.UserName,
                Password = options.Password,
                VirtualHost = options.VirtualHost,
                ClientProvidedName = "dailu-api",          // shown in the UI's Connections tab
                AutomaticRecoveryEnabled = true,           // default, spelled out on purpose
                TopologyRecoveryEnabled = true,
            };

            _connection = await factory.CreateConnectionAsync(ct);
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
```

- **Connections are expensive, channels are cheap.** A connection is a TCP socket plus an AMQP
  handshake; open one per process and keep it. Channels are lightweight sessions *inside* it —
  the publisher (phase 2) and each consumer worker (phase 3) get their own.
- **Lazy, not at startup.** `CreateConnectionAsync` throws `BrokerUnreachableException` if the
  broker isn't up yet (common right after `docker compose up`). Creating it on first use lets the
  callers decide what to do: the publisher logs and drops the event, the consumer retries.
- **Automatic recovery** reconnects after a network blip or broker restart, re-declares queues,
  exchanges and bindings, and restarts consumers. It does *not* cover the very first connect —
  hence the retry loop in phase 3.
- **Not `IOptions<RabbitMqOptions>`** — `AddValidateOptions` already registers the bound
  `RabbitMqOptions` as a singleton, the same as `AiOptions`.

## 1.5 Register

`src/shared/SharedInfrastructure/Messaging/Setup.cs`:

```csharp
public static class Setup
{
    public static IServiceCollection AddRabbitMq(this IServiceCollection services)
    {
        services.AddValidateOptions<RabbitMqOptions>();
        services.AddSingleton<RabbitMqConnection>();
        return services;
    }
}
```

Call it from `src/Dailu.Infrastructure/CQRS/Setup.cs` → `AddPipelines`, next to the event bus
registration — phase 2 replaces that registration anyway.

---

## Verify

1. `docker compose ps` shows `dailo.rabbitmq` running; `docker compose logs dailo.rabbitmq` ends
   with `Server startup complete`.
2. <http://localhost:15672> — log in as `dailo`. The **Overview** tab shows one node,
   `rabbit@dailo-rabbitmq`.
3. Point your **tutorial 1** console apps at this broker (`UserName`/`Password` = `dailo`), run
   *Send* and watch the `hello` queue appear under **Queues** with 1 message; run *Receive* and
   watch it drop to 0. Delete the `hello` queue afterwards.
4. `docker compose restart dailo.rabbitmq` and reload the UI: the node name is unchanged.
5. The API still starts and behaves exactly as before — nothing uses the connection yet.

Commit: `Add RabbitMQ broker and shared connection`.

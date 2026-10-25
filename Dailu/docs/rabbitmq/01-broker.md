# Phase 1 — Broker and connection

**Goal:** RabbitMQ running next to Postgres, its management UI reachable, connection settings in
`appsettings` behind an `IsEnabled` switch, and one shared, lazily created `IConnection` in the
API.

**Builds on:** [tutorial 1](https://www.rabbitmq.com/tutorials/tutorial-one-dotnet) (connection,
channel) and the [.NET client API guide](https://www.rabbitmq.com/client-libraries/dotnet-api-guide)
sections on connections, channels and automatic recovery.

```
src/Dailu.Infrastructure/
├── Messaging/
│   ├── RabbitMqOptions.cs        ← "RabbitMq" config section, IsEnabled switch
│   ├── RabbitMqConnection.cs     ← one IConnection per process, created on first use
│   └── Setup.cs                  ← AddRabbitMq()
└── Event/
    └── Setup.cs                  ← AddEvents(): calls AddRabbitMq() only when enabled
```

---

## 1.1 Run RabbitMQ

Add a service to `docker-compose.yml`, next to `dailo.postgres`:

```yaml
  dailo.rabbitmq:
    image: rabbitmq:4-management
    hostname: dailu-rabbitmq            # node name (and so the data directory) depends on it
    environment:
      RABBITMQ_DEFAULT_USER: dailu
      RABBITMQ_DEFAULT_PASS: Dailo123!@
    volumes:
      - dailu_rabbitmq_data:/var/lib/rabbitmq
    ports:
      - 5672:5672                       # AMQP
      - 15672:15672                     # management UI
```

and the volume:

```yaml
volumes:
  dailo_posgres_data:
    external: false
  dailu_rabbitmq_data:
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
  or environment variables, the same way the Postgres password is handled.

```
docker compose up -d dailo.rabbitmq
```

## 1.2 Packages

`Directory.Packages.props`:

```xml
<PackageVersion Include="RabbitMQ.Client" Version="7.2.2" />
```

Check [nuget.org](https://www.nuget.org/packages/RabbitMQ.Client/) for the latest 7.x patch
before pinning.

`src/Dailu.Infrastructure/Dailu.Infrastructure.csproj` — **not** `SharedInfrastructure.csproj`,
which every module references:

```xml
<PackageReference Include="RabbitMQ.Client" />
```

`BackgroundService` (phase 3) comes from `Microsoft.Extensions.Hosting.Abstractions`, which
`Dailu.Infrastructure` already gets through `OpenTelemetry.Extensions.Hosting` and the ASP.NET
Core packages. Add it explicitly only if the build says otherwise.

## 1.3 Options

`src/Dailu.Infrastructure/Messaging/RabbitMqOptions.cs` — same shape as `AiOptions`:

```csharp
public sealed class RabbitMqOptions : IOptions        // SharedKernel.Options.IOptions
{
    public string SectionName => "RabbitMq";

    /// <summary>
    /// False keeps every integration event in-memory and starts no consumers — for tests and for
    /// running the API without the broker.
    /// </summary>
    public bool IsEnabled { get; init; } = true;

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
  "IsEnabled": true,
  "Host": "localhost",
  "Port": 5672,
  "UserName": "dailu",
  "Password": "Dailo123!@"
}
```

`src/api/Dailu.Api/appsettings.json` — off until production has a broker:

```json
"RabbitMq": {
  "IsEnabled": false
}
```

- **The JSON key must match the property name.** Configuration binding matches by name, so
  `"Enabled"` would silently leave `IsEnabled` at its default `true`.
- **Don't put empty or zero values in the base file.** `"Port": 0` overrides the `5672` default
  with a value `[Range]` rejects, and `ValidateOnStart` turns that into a startup failure in every
  environment that doesn't override it. Leave keys out instead.
- **Turning it on in production** means `RabbitMq__IsEnabled`, `RabbitMq__Host`,
  `RabbitMq__UserName` and `RabbitMq__Password` in `docker-compose.override.prod.yml`, plus a
  broker to point them at.

**Decision:** `IsEnabled` is a single switch on purpose. When it's `false` nothing RabbitMQ-related
is registered at all — no options validation, no connection, no consumers — and the API behaves
exactly as before this guide.

## 1.4 One connection per process

`src/Dailu.Infrastructure/Messaging/RabbitMqConnection.cs`:

```csharp
public sealed class RabbitMqConnection(RabbitMqOptions options) : IAsyncDisposable
{
    private readonly SemaphoreSlim _lock = new(1, 1);
    private IConnection? _connection;

    public async Task<IConnection> GetAsync(CancellationToken ct)
    {
        // don't check IsOpen: during automatic recovery it's false, and we'd open a second
        // connection while the first one is still reconnecting
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
  callers decide what to do: a publish fails with an exception (phase 2 decides who catches it),
  and the consumer worker retries connecting.
- **Automatic recovery** reconnects after a network blip or broker restart, re-declares queues,
  exchanges and bindings, and restarts consumers. It does *not* cover the very first connect —
  hence the retry loop in phase 3.
- **Not `IOptions<RabbitMqOptions>`** — `AddValidateOptions` already registers the bound
  `RabbitMqOptions` as a singleton, the same as `AiOptions`.
- **CA1508 on the second null check** is a false positive for double-checked locking; suppress it
  with a `#pragma` around that line.

## 1.5 Register

`src/Dailu.Infrastructure/Messaging/Setup.cs`:

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

Call it from `src/Dailu.Infrastructure/Event/Setup.cs` → `AddEvents`, only when the switch is on.
The bus stays in-memory for now; phase 2 replaces it.

```csharp
public static IServiceCollection AddEvents(this IServiceCollection services)
{
    services.AddScoped<IEventDispatcher, EventDispatcher>();
    services.AddScoped<IIntegrationEventBus, InMemoryIntegrationEventBus>();

    if (services.GetOptions<RabbitMqOptions>().IsEnabled)
    {
        services.AddRabbitMq();
    }

    return services;
}
```

`GetOptions<T>()` (`SharedInfrastructure.Options`) binds the section without validating it — the
same helper `AddInfrastructure` uses for `DataEncryptionOptions`. Validation only happens inside
`AddRabbitMq()`, so a disabled section with no host or credentials doesn't fail startup.

---

## Verify

1. `docker compose ps` shows `dailo.rabbitmq` running; `docker compose logs dailo.rabbitmq` ends
   with `Server startup complete`.
2. <http://localhost:15672> — log in as `dailu`. The **Overview** tab shows one node,
   `rabbit@dailu-rabbitmq`.
3. Point your **tutorial 1** console apps at this broker (`UserName` = `dailu`), run *Send* and
   watch the `hello` queue appear under **Queues** with 1 message; run *Receive* and watch it
   drop to 0. Delete the `hello` queue afterwards.
4. `docker compose restart dailo.rabbitmq` and reload the UI: the node name is unchanged.
5. The API still starts and behaves exactly as before — nothing uses the connection yet, so the
   **Connections** tab stays empty.
6. Temporarily remove the `RabbitMq` section from `appsettings.Development.json` and start the
   API: it still starts, because the base file says `IsEnabled: false` and nothing is validated.
   Put the section back.

Commit: `Add RabbitMQ broker and shared connection`.

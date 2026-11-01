# Phase 4 — Retry settings in config, applied as a policy

**Goal:** the number of attempts and the retry delay come from `appsettings`, and changing either
takes only a restart: no queue to delete, no `PRECONDITION_FAILED`. The delay moves out of the
retry queues' arguments into a RabbitMQ **policy** that the API creates itself at startup
through the management HTTP API.

**Builds on:** phase 3 working end to end, and the [policies](https://www.rabbitmq.com/docs/policies)
and [management HTTP API](https://www.rabbitmq.com/docs/management#http-api) docs.

```
src/Dailu.Infrastructure/Messaging/
├── RabbitMqOptions.cs                ← + MaxAttempts, RetryDelayMs, ManagementUrl
├── RabbitMqTopology.cs               ← retry queue loses x-message-ttl
├── RabbitMqPolicyClient.cs           ← PUT /api/policies/{vhost}/{name}
├── RabbitMqQueueConsumer.cs          ← MaxAttempts from options instead of a constant
├── RabbitMqConsumerWorker.cs         ← applies the policy before starting the consumers
└── Setup.cs                          ← + AddHttpClient<RabbitMqPolicyClient>
```

```
API start ──► RabbitMqConsumerWorker.ExecuteAsync
                ├─ RabbitMqPolicyClient ──HTTP PUT──► management API (port 15672)
                │     policy "dailu-retry-delay": ^(habit\.retry|…|search\.retry)$ → message-ttl = RetryDelayMs
                │     (retried every 10 s until it succeeds)
                └─ then a RabbitMqQueueConsumer per queue, exactly as in phase 3
```

---

## 4.1 Why a policy

A queue's `x-arguments` are fixed when the queue is created. Phase 3 sets `x-message-ttl` on
every `*.retry` queue, so changing `RetryDelayMs` means deleting those queues by hand. Otherwise
`DeclareConsumerAsync` fails with `PRECONDITION_FAILED`, and that queue's consumer never starts.

A **policy** is a broker-side rule: a regex on queue names → a set of settings. It applies to
queues that match now and later, and it can be **changed on a live queue**.

| Setting | Where after this phase | Why |
|---|---|---|
| `x-queue-type: quorum` | argument | a queue's type can't come from a policy |
| `x-dead-letter-exchange`, `x-dead-letter-routing-key` | argument | routing structure; it comes from the queue names and never changes |
| retry delay (`message-ttl`) | **policy** | the value you want to tune |
| max attempts | **`appsettings`**, used in code | not a broker setting at all — the worker decides from `x-death` (3.2) |

- **The routing keys can't be a policy.** They differ per queue (`search` → `search.retry`,
  `search.retry` → `search`), and a policy has one fixed definition per regex. Without an
  explicit dead-letter routing key, a message leaving `search.retry` keeps the key
  `search.retry` and the default exchange routes it straight back into `search.retry`, forever.
- **AMQP can't create policies.** `RabbitMQ.Client` has no call for it; the management plugin's
  HTTP API does. The `rabbitmq:4-management` image from phase 1 already runs it on 15672.

## 4.2 Options

Add to `RabbitMqOptions`:

```csharp
/// <summary>Tries per message, including the first; then it's parked in the DLQ.</summary>
[Range(1, 100)]
public int MaxAttempts { get; init; } = 5;

/// <summary>How long a failed message waits in its retry queue. Applied as a policy.</summary>
[Range(1_000, 3_600_000)]
public int RetryDelayMs { get; init; } = 10_000;

/// <summary>Management HTTP API, for creating policies.</summary>
[Required]
public string ManagementUrl { get; init; } = "http://localhost:15672/";
```

`appsettings.Development.json`:

```json
"RabbitMq": {
  ...,
  "MaxAttempts": 5,
  "RetryDelayMs": 10000,
  "ManagementUrl": "http://localhost:15672/"
}
```

- **Attempts, not retries.** `MaxAttempts = 5` is one try plus four retries. The check in the
  consumer is `attempt >= MaxAttempts`; a property called `MaxRetries` invites an off-by-one.
- **`ManagementUrl` is its own setting**, not built from `Host`. On a managed broker (CloudAMQP,
  Amazon MQ) the API is often on a different host, behind HTTPS, or at a different path.
- **Remove `RabbitMqTopology.RetryDelayMs`.** The delay has one source now. The log line in
  `OnReceivedAsync` that prints the delay reads it from the options instead.

## 4.3 Retry queue without `x-message-ttl`

In `RabbitMqTopology.DeclareConsumerAsync` (3.1), drop the TTL from the retry queue:

```csharp
await channel.QueueDeclareAsync(
    retryQueue,
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: new Dictionary<string, object?>
    {
        ["x-queue-type"] = "quorum",
        ["x-dead-letter-exchange"] = "",
        ["x-dead-letter-routing-key"] = subscription.Queue,      // expired → back to the main queue
    },
    cancellationToken: ct
);
```

- **The argument must go, not just be overridden.** When a policy and an argument both set a
  TTL, RabbitMQ uses the **lower** one, so a leftover `x-message-ttl = 10000` would cap every
  delay you configure at 10 s.
- **Existing retry queues still have the old argument** and declaring them without it fails
  with `PRECONDITION_FAILED`. Delete the four `*.retry` queues once in the UI (they're empty
  except during a retry) and let the consumers declare them again.
- **Decision — no safety ceiling.** You could keep a large `x-message-ttl` (say 1 h) as a
  ceiling, so a missing policy delays retries instead of stalling them. It's never changed, so
  it wouldn't cause `PRECONDITION_FAILED`. This guide doesn't, because 4.5 refuses to consume
  without the policy anyway; add it if you'd rather have both.

## 4.4 The policy client

`src/Dailu.Infrastructure/Messaging/RabbitMqPolicyClient.cs`:

```csharp
/// <summary>Creates or updates broker policies through the management HTTP API.</summary>
public sealed class RabbitMqPolicyClient(HttpClient http, IOptions<RabbitMqOptions> options)
{
    public const string RetryDelayPolicy = "dailu-retry-delay";

    public async Task ApplyRetryDelayAsync(IEnumerable<string> retryQueues, CancellationToken ct)
    {
        var o = options.Value;
        var vhost = Uri.EscapeDataString(o.VirtualHost);           // "/" → "%2F"

        // exactly our retry queues, not every queue on the vhost that ends in ".retry"
        var pattern = "^(" + string.Join("|", retryQueues.Select(Regex.Escape)) + ")$";

        var response = await http.PutAsJsonAsync(
            $"api/policies/{vhost}/{RetryDelayPolicy}",
            new Dictionary<string, object>
            {
                ["pattern"] = pattern,
                ["apply-to"] = "queues",
                ["priority"] = 1,
                ["definition"] = new Dictionary<string, object> { ["message-ttl"] = o.RetryDelayMs },
            },
            ct
        );

        response.EnsureSuccessStatusCode();
    }
}
```

Register it in `AddRabbitMq()` (`Messaging/Setup.cs`):

```csharp
services.AddHttpClient<RabbitMqPolicyClient>((sp, http) =>
{
    var o = sp.GetRequiredService<IOptions<RabbitMqOptions>>().Value;

    http.BaseAddress = new Uri(o.ManagementUrl);
    http.Timeout = TimeSpan.FromSeconds(10);
    http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
        "Basic",
        Convert.ToBase64String(Encoding.UTF8.GetBytes($"{o.UserName}:{o.Password}"))
    );
});
```

- **`PUT` is idempotent.** It creates the policy or replaces it, so calling it on every start
  is safe, and a new `RetryDelayMs` simply overwrites the old value.
- **The pattern is built from the subscriptions**, so a new module's retry queue is covered
  automatically, and the regex can't touch queues that aren't Dailu's if the vhost is shared.
- **The `{vhost}` segment must be URL-encoded.** The default vhost `/` is `%2F`; an unencoded
  `/` makes the path `api/policies///dailu-retry-delay`, which returns 404.
- **Same credentials as AMQP.** Fine for dev. See 4.6 for what they need to be allowed to do.
- **`AddHttpClient`** comes from `Microsoft.Extensions.Http`, which the modules already use for
  their API clients. Add the package reference to `Dailu.Infrastructure` if the build can't find
  it.

## 4.5 Apply before consuming

In `RabbitMqConsumerWorker` (3.4), take the options and the policy client, and apply the policy
before starting the consumers:

```csharp
public sealed class RabbitMqConsumerWorker : BackgroundService
{
    private readonly IntegrationEventSubscription[] _subscriptions;
    private readonly RabbitMqQueueConsumer[] _consumers;
    private readonly RabbitMqPolicyClient _policyClient;
    private readonly ILogger<RabbitMqConsumerWorker> _logger;

    public RabbitMqConsumerWorker(
        IEnumerable<IntegrationEventSubscription> subscriptions,
        RabbitMqConnection connection,
        RabbitMqPolicyClient policyClient,
        IOptions<RabbitMqOptions> options,
        IServiceScopeFactory scopeFactory,
        ILoggerFactory loggerFactory,
        ILogger<RabbitMqConsumerWorker> logger
    )
    {
        _subscriptions = subscriptions.ToArray();
        _policyClient = policyClient;
        _logger = logger;

        // startup checks from 3.4 stay here

        var consumerLogger = loggerFactory.CreateLogger<RabbitMqQueueConsumer>();

        _consumers = _subscriptions
            .Select(s => new RabbitMqQueueConsumer(s, connection, scopeFactory, options, consumerLogger))
            .ToArray();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (_subscriptions.Length == 0)
        {
            return;
        }

        await ApplyPoliciesAsync(stoppingToken);
        await Task.WhenAll(_consumers.Select(c => c.RunAsync(stoppingToken)));
    }

    private async Task ApplyPoliciesAsync(CancellationToken ct)
    {
        var retryQueues = _subscriptions.Select(s => RabbitMqTopology.RetryQueueOf(s.Queue)).ToArray();

        // without the policy the retry queues have no TTL and failed messages never come back,
        // so don't consume until it's in place
        while (true)
        {
            try
            {
                await _policyClient.ApplyRetryDelayAsync(retryQueues, ct);
                return;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Can't apply RabbitMQ policies; retrying in 10 s");
                await Task.Delay(TimeSpan.FromSeconds(10), ct);
            }
        }
    }

    // StopAsync unchanged
}
```

And in `RabbitMqQueueConsumer`, replace the constant with the option:

```csharp
public sealed class RabbitMqQueueConsumer(
    IntegrationEventSubscription subscription,
    RabbitMqConnection connection,
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<RabbitMqQueueConsumer> logger
)
{
    private readonly int _maxAttempts = options.Value.MaxAttempts;
    private readonly int _retryDelayMs = options.Value.RetryDelayMs;   // for the log line only
    ...
}
```

and use `_maxAttempts` / `_retryDelayMs` where `OnReceivedAsync` used `MaxAttempts` /
`RabbitMqTopology.RetryDelayMs`.

- **No consuming without the policy.** A consumer that started anyway would nack failures into
  retry queues that never expire. They'd sit there until someone notices. Waiting costs nothing:
  messages stay safely in the main queues meanwhile.
- **The policy applies to queues that don't exist yet.** It doesn't matter that the consumers
  declare the retry queues *after* the `PUT` — a policy matches whenever a queue with that name
  appears.
- **A changed delay affects new arrivals.** Messages already waiting in a retry queue may keep
  the expiry they were given. At 10 s that's never worth worrying about.
- **Only one policy applies to a queue: the highest priority wins**, and policies aren't merged.
  If you add another one later (say `max-length` for every queue), either put both keys into one
  policy for the retry queues, or give `dailu-retry-delay` the higher priority — otherwise one
  silently hides the other.

## 4.6 Permissions and production

Setting policies needs the user tag **`policymaker`** (or `administrator`), on top of the AMQP
permissions the API already has.

- **Dev:** the user that `RABBITMQ_DEFAULT_USER` creates in the Docker image is an
  `administrator`, so this works as is.
- **Production:** giving the API policy rights means it can change broker-wide behaviour on its
  vhost. Two common alternatives:
  - a separate user for the management API — add `ManagementUserName` / `ManagementPassword` to
    the options, tagged `policymaker` only;
  - **the broker owns its policies**: a `definitions.json` loaded at boot (`load_definitions` in
    `rabbitmq.conf`), versioned next to `docker-compose.yml`. Then the API only *checks* the
    policy (`GET api/policies/{vhost}/dailu-retry-delay`) and doesn't consume until it exists.
    Note that when definitions are loaded at boot, the broker doesn't create the default user
    from `RABBITMQ_DEFAULT_USER`, so the `dailu` user must be in the file too.
- **The management port** (15672) needs to be reachable from the API, but not from the
  internet. In compose it's on the same network already.

**Decision:** the API applies its own policy. It keeps the retry settings in `appsettings` next
to the rest of the RabbitMQ config, with nothing to remember on a fresh broker. Switch to a
definitions file when someone other than the API should own the broker's configuration.

---

## Verify

1. **Fresh queues.** Delete the four `*.retry` queues, start the API. The log shows no policy
   warning; **Admin → Policies** lists `dailu-retry-delay` with the four retry queue names in its
   pattern and `message-ttl: 10000`. On **Queues**, the *Features* column of each `*.retry`
   queue shows the policy name, and the queue's own arguments have no `x-message-ttl`.
2. **Retry still works.** Stop Ollama, edit a tag: `search.retry` holds the message for 10 s,
   then it's back in `search` — the same as phase 3, Verify step 7.
3. **Change the delay.** Set `RetryDelayMs` to `30000`, restart. No `PRECONDITION_FAILED`; the
   policy shows `30000`; a new failure waits 30 s.
4. **Change the attempts.** Set `MaxAttempts` to `2`, restart, keep Ollama stopped: the message
   is parked in `search.dlq` after the second failure.
5. **Management API unreachable.** Set `ManagementUrl` to a wrong port, start the API. It serves
   requests, logs "Can't apply RabbitMQ policies; retrying in 10 s", and **Queues** shows no
   consumers. Edit a tag: the message waits in `search`. Fix the URL and restart: it's processed.
6. **Leftover argument.** Re-create one retry queue with `x-message-ttl` in the UI and start the
   API: that queue's consumer logs `PRECONDITION_FAILED` and retries. That's the failure mode
   4.3 asks you to clean up once.

Commit: `Apply RabbitMQ retry delay as a policy from config`.

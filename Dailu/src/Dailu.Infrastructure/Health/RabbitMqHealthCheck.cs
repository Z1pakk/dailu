using Dailu.Infrastructure.Messaging;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Dailu.Infrastructure.Health;

/// <summary>
/// Reuses the API's shared broker connection instead of opening a new one per probe.
/// </summary>
internal sealed class RabbitMqHealthCheck(RabbitMqConnection rabbitMqConnection) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default
    )
    {
        var connection = await rabbitMqConnection.GetAsync(cancellationToken);

        // false while automatic recovery is in progress — not ready to publish either
        return connection.IsOpen
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy("RabbitMQ connection is not open.");
    }
}

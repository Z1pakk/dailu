using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace Dailu.Infrastructure.Health;

/// <summary>
/// Opens a connection and runs <c>SELECT 1</c> against every distinct Postgres connection string —
/// modules may point at the same database or at separate ones.
/// </summary>
internal sealed class PostgresHealthCheck(IConfiguration configuration) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default
    )
    {
        var connectionStrings = configuration
            .GetSection("ConnectionStrings")
            .GetChildren()
            .Where(c => c.Key.EndsWith("PostgresConnectionString", StringComparison.Ordinal))
            .Select(c => c.Value)
            .OfType<string>()
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (connectionStrings.Count == 0)
        {
            return HealthCheckResult.Unhealthy("No Postgres connection strings configured.");
        }

        // exceptions propagate on purpose: HealthCheckService reports them as Unhealthy
        foreach (var connectionString in connectionStrings)
        {
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new NpgsqlCommand("SELECT 1", connection);
            await command.ExecuteScalarAsync(cancellationToken);
        }

        return HealthCheckResult.Healthy();
    }
}

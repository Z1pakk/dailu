using Microsoft.Extensions.Configuration;

namespace SharedInfrastructure.Persistence;

public static class ConnectionStringExtensions
{
    /// <summary>
    /// The module's own connection string. Every module has its own key on purpose, so it
    /// can move to its own database (or service) without touching the others.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// The key is missing or empty — thrown at startup, naming the key, instead of Npgsql's
    /// "ConnectionString property has not been initialized" on the first query.
    /// </exception>
    public static string GetRequiredConnectionString(
        this IConfiguration configuration,
        string connectionStringName
    )
    {
        // empty counts as missing: appsettings.json lists the module keys with "" as placeholders
        var connectionString = configuration.GetConnectionString(connectionStringName);

        return string.IsNullOrWhiteSpace(connectionString)
            ? throw new InvalidOperationException(
                $"Connection string 'ConnectionStrings:{connectionStringName}' is not configured "
                    + $"(env var ConnectionStrings__{connectionStringName})."
            )
            : connectionString;
    }
}

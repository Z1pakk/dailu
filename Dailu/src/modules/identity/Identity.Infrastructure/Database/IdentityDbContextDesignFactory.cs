using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;

namespace Identity.Infrastructure.Database;

internal sealed class IdentityDbContextDesignFactory
    : IDesignTimeDbContextFactory<IdentityDbContext>
{
    public IdentityDbContext CreateDbContext(string[] args)
    {
        // Get the base path for the Infrastructure project
        var basePath = Directory.GetCurrentDirectory();

        // Build configuration from the startup project's appsettings
        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString(Setup.IdentityDbConnectionString);

        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException(
                $"Connection string 'HabitPostgresConnectionString' not found. Looked in: {basePath}/appsettings.json"
            );
        }

        var optionsBuilder = new DbContextOptionsBuilder<IdentityDbContext>();
        optionsBuilder
            .UseNpgsql(
                (string?)connectionString,
                b =>
                    b.MigrationsAssembly(AssemblyReference.Assembly.GetName().Name)
                        .MigrationsHistoryTable(
                            HistoryRepository.DefaultTableName,
                            IdentitySchema.Name
                        )
            )
            .UseSnakeCaseNamingConvention();

        // Return context with null services for design-time only
        return new IdentityDbContext(optionsBuilder.Options);
    }
}

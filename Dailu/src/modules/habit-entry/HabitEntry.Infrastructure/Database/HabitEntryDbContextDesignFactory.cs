using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;

namespace HabitEntry.Infrastructure.Database;

internal sealed class HabitEntryDbContextDesignFactory
    : IDesignTimeDbContextFactory<HabitEntryDbContext>
{
    public HabitEntryDbContext CreateDbContext(string[] args)
    {
        // Get the base path for the Infrastructure project
        var basePath = Directory.GetCurrentDirectory();

        // Build configuration from the startup project's appsettings
        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString(
            Setup.HabitEntryDbConnectionString
        );

        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException(
                $"Connection string 'HabitEntryPostgresConnectionString' not found. Looked in: {basePath}/appsettings.json"
            );
        }

        var optionsBuilder = new DbContextOptionsBuilder<HabitEntryDbContext>();
        optionsBuilder
            .UseNpgsql(
                (string?)connectionString,
                b =>
                    b.MigrationsAssembly(AssemblyReference.Assembly.GetName().Name)
                        .MigrationsHistoryTable(
                            HistoryRepository.DefaultTableName,
                            HabitEntrySchema.NAME
                        )
            )
            .UseSnakeCaseNamingConvention();

        // Return context with null services for design-time only
        return new HabitEntryDbContext(optionsBuilder.Options);
    }
}

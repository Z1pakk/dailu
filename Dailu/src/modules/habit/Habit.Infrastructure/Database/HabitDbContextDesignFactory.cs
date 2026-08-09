using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;

namespace Habit.Infrastructure.Database;

internal sealed class HabitDbContextDesignFactory : IDesignTimeDbContextFactory<HabitDbContext>
{
    public HabitDbContext CreateDbContext(string[] args)
    {
        // Get the base path for the Infrastructure project
        var basePath = Directory.GetCurrentDirectory();

        // Build configuration from the startup project's appsettings
        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString(Setup.HabitDbConnectionString);

        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException(
                $"Connection string 'HabitPostgresConnectionString' not found. Looked in: {basePath}/appsettings.json"
            );
        }

        var optionsBuilder = new DbContextOptionsBuilder<HabitDbContext>();
        optionsBuilder
            .UseNpgsql(
                (string?)connectionString,
                b =>
                    b.MigrationsAssembly(AssemblyReference.Assembly.GetName().Name)
                        .MigrationsHistoryTable(
                            HistoryRepository.DefaultTableName,
                            HabitSchema.NAME
                        )
            )
            .UseSnakeCaseNamingConvention();

        // Return context with null services for design-time only
        return new HabitDbContext(optionsBuilder.Options);
    }
}

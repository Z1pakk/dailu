using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;

namespace HabitUser.Infrastructure.Database;

internal sealed class HabitUserDbContextDesignFactory
    : IDesignTimeDbContextFactory<HabitUserDbContext>
{
    public HabitUserDbContext CreateDbContext(string[] args)
    {
        var basePath = Directory.GetCurrentDirectory();

        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString(Setup.HabitUserDbConnectionString);

        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException(
                $"Connection string 'HabitEntryPostgresConnectionString' not found. Looked in: {basePath}/appsettings.json"
            );
        }

        var optionsBuilder = new DbContextOptionsBuilder<HabitUserDbContext>();
        optionsBuilder
            .UseNpgsql(
                (string?)connectionString,
                b =>
                    b.MigrationsAssembly(AssemblyReference.Assembly.GetName().Name)
                        .MigrationsHistoryTable(
                            HistoryRepository.DefaultTableName,
                            HabitUserSchema.NAME
                        )
            )
            .UseSnakeCaseNamingConvention();

        // EphemeralDataProtectionProvider is safe for design-time — migrations don't process data.
        return new HabitUserDbContext(optionsBuilder.Options, new EphemeralDataProtectionProvider());
    }
}

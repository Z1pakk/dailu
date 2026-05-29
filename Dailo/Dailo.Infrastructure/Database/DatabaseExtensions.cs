using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SharedKernel.Persistence;

namespace Dailo.Infrastructure.Database;

public static class DatabaseExtensions
{
    public static IHostApplicationBuilder AddDatabaseInitialization(
        this IHostApplicationBuilder builder
    )
    {
        var dbContextTypes = builder
            .Services.Where(d =>
                !d.ServiceType.IsAbstract
                && !d.ServiceType.IsInterface
                && !d.ServiceType.IsGenericType
                && d.ServiceType != typeof(DbContext)
                && typeof(DbContext).IsAssignableFrom(d.ServiceType)
            )
            .Select(d => d.ServiceType)
            .Distinct()
            .ToList();

        foreach (var type in dbContextTypes)
        {
            builder.Services.AddSingleton(new MigrationContextRegistration(type));
        }

        builder.Services.AddHostedService<DatabaseInitializationService>();
        return builder;
    }
}

internal sealed record MigrationContextRegistration(Type ContextType);

internal sealed class DatabaseInitializationService(
    IServiceProvider services,
    IHostEnvironment environment
) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = services.CreateAsyncScope();

        var registrations = scope.ServiceProvider.GetServices<MigrationContextRegistration>();
        foreach (var registration in registrations)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                return;
            }

            var dbContext = (DbContext)
                scope.ServiceProvider.GetRequiredService(registration.ContextType);
            await dbContext.Database.MigrateAsync(cancellationToken);
        }

        var seeders = scope.ServiceProvider.GetServices<IDataSeeder>();
        foreach (var seeder in seeders)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                return;
            }

            await seeder.SeedAsync(cancellationToken);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

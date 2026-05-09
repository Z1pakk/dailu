using FluentValidation;
using HabitEntry.Api;
using HabitEntry.Application;
using HabitEntry.Application.Persistence;
using HabitEntry.Infrastructure.Database;
using HabitEntry.Infrastructure.Pipeline;
using HabitEntry.Integrations;
using Mediator;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SharedInfrastructure.CQRS;
using SharedInfrastructure.Endpoint;

namespace HabitEntry.Infrastructure;

public static class Setup
{
    public const string HabitEntryDbConnectionString = "HabitEntryPostgresConnectionString";

    public static IServiceCollection AddHabitEntryModule(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        var connectionString = configuration.GetConnectionString(HabitEntryDbConnectionString);

        services.AddDbContext<IHabitEntryDbContext, HabitEntryDbContext>(opt =>
            opt.UseNpgsql(
                    connectionString,
                    b =>
                    {
                        b.MigrationsAssembly(AssemblyReference.Assembly)
                            .MigrationsHistoryTable(
                                HistoryRepository.DefaultTableName,
                                HabitEntrySchema.NAME
                            );
                        // Enable retry on failure for transient errors
                        b.EnableRetryOnFailure(
                            maxRetryCount: 3,
                            maxRetryDelay: TimeSpan.FromSeconds(30),
                            errorCodesToAdd: null
                        );

                        // Set command timeout for long-running queries
                        b.CommandTimeout(60);
                    }
                )
                .UseSnakeCaseNamingConvention()
        );

        services.AddScoped(
            typeof(IPipelineBehavior<,>),
            typeof(HabitEntryEventDispatchingBehavior<,>)
        );

        services.AddValidatorsFromAssemblyContaining<IHabitEntryApplicationRoot>();

        services.AddEndpoints(assemblies: HabitEntryApiRoot.Assembly);

        services.AddHandlerAssembly<IHabitEntryApplicationRoot>();

        services.AddHabitEntryIntegrations();

        return services;
    }
}

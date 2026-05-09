using FluentValidation;
using Habit.Api;
using Habit.Application;
using Habit.Application.Persistence;
using Habit.DataTransfer;
using Habit.Infrastructure.Database;
using Habit.Infrastructure.Pipeline;
using Habit.Integrations;
using Mediator;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SharedInfrastructure.CQRS;
using SharedInfrastructure.Endpoint;

namespace Habit.Infrastructure;

public static class Setup
{
    public const string HabitDbConnectionString = "HabitPostgresConnectionString";

    public static IServiceCollection AddHabitModule(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        var connectionString = configuration.GetConnectionString(HabitDbConnectionString);

        services.AddDbContext<IHabitDbContext, HabitDbContext>(opt =>
            opt.UseNpgsql(
                    connectionString,
                    b =>
                    {
                        b.MigrationsAssembly(AssemblyReference.Assembly)
                            .MigrationsHistoryTable(
                                HistoryRepository.DefaultTableName,
                                HabitSchema.NAME
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
            typeof(HabitEventDispatchingBehavior<,>)
        );

        services.AddValidatorsFromAssemblyContaining<IHabitApplicationRoot>();

        services.AddEndpoints(assemblies: HabitApiRoot.Assembly);

        services.AddHandlerAssembly<IHabitApplicationRoot>();

        services.AddHabitTransferServices();

        services.AddHabitIntegrations();

        return services;
    }
}

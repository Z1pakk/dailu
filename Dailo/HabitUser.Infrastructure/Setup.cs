using FluentValidation;
using HabitUser.Api;
using HabitUser.Application;
using HabitUser.Application.Persistence;
using HabitUser.Infrastructure.Database;
using HabitUser.Infrastructure.Pipeline;
using Mediator;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SharedInfrastructure.CQRS;
using SharedInfrastructure.Endpoint;

namespace HabitUser.Infrastructure;

public static class Setup
{
    public const string HabitUserDbConnectionString = "HabitUserPostgresConnectionString";

    public static IServiceCollection AddHabitUserModule(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        var connectionString = configuration.GetConnectionString(HabitUserDbConnectionString);

        services.AddDbContext<IHabitUserDbContext, HabitUserDbContext>(opt =>
            opt.UseNpgsql(
                    connectionString,
                    b =>
                    {
                        b.MigrationsAssembly(AssemblyReference.Assembly.FullName)
                            .MigrationsHistoryTable(
                                HistoryRepository.DefaultTableName,
                                HabitUserSchema.NAME
                            );
                        b.EnableRetryOnFailure(
                            maxRetryCount: 3,
                            maxRetryDelay: TimeSpan.FromSeconds(30),
                            errorCodesToAdd: null
                        );
                        b.CommandTimeout(60);
                    }
                )
                .UseSnakeCaseNamingConvention()
        );

        services.AddScoped(
            typeof(IPipelineBehavior<,>),
            typeof(HabitUserEventDispatchingBehavior<,>)
        );

        services.AddValidatorsFromAssemblyContaining<IHabitUserApplicationRoot>();

        services.AddEndpoints(assemblies: HabitUserApiRoot.Assembly);

        services.AddHandlerAssembly<IHabitUserApplicationRoot>();

        return services;
    }
}

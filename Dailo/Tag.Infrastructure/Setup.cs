using FluentValidation;
using Mediator;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SharedInfrastructure.CQRS;
using SharedInfrastructure.Endpoint;
using Tag.Api;
using Tag.Application;
using Tag.Application.Persistence;
using Tag.DataTransfer;
using Tag.Infrastructure.Database;
using Tag.Infrastructure.Pipeline;

namespace Tag.Infrastructure;

public static class Setup
{
    public const string TagDbConnectionString = "TagPostgresConnectionString";

    public static IServiceCollection AddTagModule(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        var connectionString = configuration.GetConnectionString(TagDbConnectionString);

        services.AddDbContext<ITagDbContext, TagDbContext>(opt =>
            opt.UseNpgsql(
                    connectionString,
                    b =>
                    {
                        b.MigrationsAssembly(AssemblyReference.Assembly)
                            .MigrationsHistoryTable(
                                HistoryRepository.DefaultTableName,
                                TagSchema.NAME
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
            typeof(TagEventDispatchingBehavior<,>)
        );

        services.AddValidatorsFromAssemblyContaining<ITagApplicationRoot>();

        services.AddEndpoints(assemblies: TagApiRoot.Assembly);

        services.AddHandlerAssembly<ITagApplicationRoot>();

        services.AddTagDataTransferServices();

        return services;
    }
}

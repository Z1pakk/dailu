using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SharedKernel.CQRS;
using SharedKernel.Endpoint;
using Tag.Api;
using Tag.Application;
using Tag.Application.Persistence;
using Tag.Infrastructure.Database;

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

        services.AddValidatorsFromAssemblyContaining<ITagApplicationRoot>();

        services.AddEndpoints(assemblies: TagApiRoot.Assembly);

        services.AddHandlerAssembly<ITagApplicationRoot>();

        return services;
    }
}

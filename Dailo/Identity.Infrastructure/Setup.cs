using System.Text;
using Identity.Api;
using Identity.Application;
using Identity.Application.Persistence;
using Identity.Application.Services;
using Identity.Domain.Entities;
using Identity.Infrastructure.Database;
using Identity.Infrastructure.Database.Seeders;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using SharedKernel.Configuration;
using SharedKernel.CQRS;
using SharedKernel.Endpoint;
using SharedKernel.Persistence;

namespace Identity.Infrastructure;

public static class Setup
{
    public const string IdentityDbConnectionString = "IdentityPostgresConnectionString";

    public static IServiceCollection AddIdentityModule(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        var connectionString = configuration.GetConnectionString(IdentityDbConnectionString);

        services.AddDbContext<IIdentityDbContext, IdentityDbContext>(opt =>
            opt.UseNpgsql(
                    connectionString,
                    b =>
                    {
                        b.MigrationsAssembly(AssemblyReference.Assembly)
                            .MigrationsHistoryTable(
                                HistoryRepository.DefaultTableName,
                                IdentitySchema.Name
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

        services
            .AddIdentityCore<User>()
            .AddRoles<Role>()
            .AddEntityFrameworkStores<IdentityDbContext>()
            .AddDefaultTokenProviders()
            .AddSignInManager();

        services.AddScoped<ITokenProvider, TokenProvider>();

        services.AddScoped<IDataSeeder, RoleSeeder>();

        services.AddEndpoints(assemblies: IdentityApiRoot.Assembly);

        services.AddHandlerAssembly<IIdentityApplicationRoot>();

        return services;
    }
}

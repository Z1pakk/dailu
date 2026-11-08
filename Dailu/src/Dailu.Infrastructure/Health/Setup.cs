using System.Reflection;
using Dailu.Infrastructure.Messaging;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using SharedInfrastructure.Health;
using SharedInfrastructure.Options;

namespace Dailu.Infrastructure.Health;

public static class Setup
{
    // under /api so the reverse proxy routes them to the API, not to the frontend's nginx
    public const string LivePath = "/api/health/live";
    public const string ReadyPath = "/api/health/ready";
    public const string VersionPath = "/api/version";

    private static readonly TimeSpan CheckTimeout = TimeSpan.FromSeconds(5);

    public static IServiceCollection AddHealthServices(this IServiceCollection services)
    {
        var healthChecks = services
            .AddHealthChecks()
            .AddCheck<PostgresHealthCheck>("postgres", tags: [HealthCheckTags.Ready], timeout: CheckTimeout);

        if (services.GetOptions<RabbitMqOptions>().IsEnabled)
        {
            healthChecks.AddCheck<RabbitMqHealthCheck>(
                "rabbitmq",
                tags: [HealthCheckTags.Ready],
                timeout: CheckTimeout
            );
        }

        return services;
    }

    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        // liveness: the process is up and serving requests — no dependency checks
        app.MapHealthChecks(
                LivePath,
                new HealthCheckOptions { Predicate = _ => false, ResponseWriter = WriteResponse }
            )
            .AllowAnonymous();

        // readiness: dependencies (database, broker) are reachable
        app.MapHealthChecks(
                ReadyPath,
                new HealthCheckOptions
                {
                    Predicate = check => check.Tags.Contains(HealthCheckTags.Ready),
                    ResponseWriter = WriteResponse,
                }
            )
            .AllowAnonymous();

        // lets the post-deploy smoke test wait until the new build is the one actually serving
        var version = GetVersion();
        app.MapGet(VersionPath, () => TypedResults.Ok(new { version }))
            .AllowAnonymous()
            .ExcludeFromDescription();

        return app;
    }

    // statuses only — exception messages and descriptions could leak hosts or connection details
    private static Task WriteResponse(HttpContext context, HealthReport report) =>
        context.Response.WriteAsJsonAsync(
            new
            {
                status = report.Status.ToString(),
                checks = report.Entries.ToDictionary(
                    entry => entry.Key,
                    entry => entry.Value.Status.ToString()
                ),
            },
            context.RequestAborted
        );

    // GIT_SHA is baked in as InformationalVersion by the Dockerfile; the SDK may append "+<commit>"
    private static string GetVersion()
    {
        var informationalVersion =
            Assembly
                .GetEntryAssembly()
                ?.GetCustomAttribute<AssemblyInformationalVersionAttribute>()
                ?.InformationalVersion ?? "unknown";

        var plusIndex = informationalVersion.IndexOf('+', StringComparison.Ordinal);
        return plusIndex >= 0 ? informationalVersion[..plusIndex] : informationalVersion;
    }
}

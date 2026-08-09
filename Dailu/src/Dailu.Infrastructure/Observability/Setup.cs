using Dailu.Infrastructure.CQRS.Pipelines;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;
using OpenTelemetry;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace Dailu.Infrastructure.Observability;

public static class Setup
{
    public static IServiceCollection AddObservability(
        this IServiceCollection services,
        string name,
        string version,
        string environmentName
    )
    {
        services
            .AddOpenTelemetry()
            .ConfigureResource(resource =>
            {
                resource
                    .AddService(serviceName: name, serviceVersion: version)
                    .AddAttributes([
                        new KeyValuePair<string, object>("deployment.environment", environmentName),
                    ]);
            })
            .WithTracing(tracing =>
            {
                tracing
                    .AddSource(CqrsDiagnostics.SourceName)
                    .AddAspNetCoreInstrumentation(options =>
                    {
                        options.EnrichWithHttpRequest = (activity, request) =>
                        {
                            activity.SetTag(
                                "client.address",
                                request.HttpContext.Connection.RemoteIpAddress?.ToString()
                            );
                        };
                    })
                    .AddHttpClientInstrumentation()
                    .AddNpgsql();
            })
            .WithMetrics(metrics =>
            {
                metrics
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation();
            })
            .UseOtlpExporter();

        services.AddLogging(logging =>
        {
            logging.AddOpenTelemetry(options =>
            {
                options.IncludeFormattedMessage = true;
                options.IncludeScopes = true;
            });
        });

        return services;
    }
}

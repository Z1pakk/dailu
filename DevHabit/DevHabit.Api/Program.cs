using DevHabit.Api.Database;
using DevHabit.Api.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder
    .Services.AddControllers(options =>
    {
        // Configure the API to return 406 Not Acceptable if the requested format(Accept header) is not supported
        options.ReturnHttpNotAcceptable = true;
    })
    .AddXmlSerializerFormatters();

builder.Services.AddOpenApi();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options
        .UseNpgsql(
            builder.Configuration.GetConnectionString("Database"),
            npgsqlOptions =>
                npgsqlOptions.MigrationsHistoryTable(
                    HistoryRepository.DefaultTableName,
                    Schemas.Application
                )
        )
        .UseSnakeCaseNamingConvention()
);

builder
    .Services.AddOpenTelemetry()
    .ConfigureResource(resource =>
    {
        resource.AddService(builder.Environment.ApplicationName);
    })
    .WithTracing(tracing =>
    {
        tracing.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddNpgsql();
    })
    .WithMetrics(metrics =>
    {
        metrics
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddRuntimeInstrumentation();
    })
    .UseOtlpExporter();

builder.Logging.AddOpenTelemetry(options =>
{
    options.IncludeFormattedMessage = true;
    options.IncludeScopes = true;
});

WebApplication app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    await app.ApplyMigrationsAsync();
}

app.UseHttpsRedirection();

app.MapControllers();

await app.RunAsync();

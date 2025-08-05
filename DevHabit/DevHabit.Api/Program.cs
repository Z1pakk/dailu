using DevHabit.Api.Database;
using DevHabit.Api.DTOs.Habits;
using DevHabit.Api.Entities;
using DevHabit.Api.Extensions;
using DevHabit.Api.Middleware;
using DevHabit.Api.Services;
using DevHabit.Api.Services.Sorting;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Newtonsoft.Json.Serialization;
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
    .AddNewtonsoftJson(options =>
        options.SerializerSettings.ContractResolver = new CamelCasePropertyNamesContractResolver()
    )
    .AddXmlSerializerFormatters();

builder.Services.AddValidatorsFromAssemblyContaining<Program>(includeInternalTypes: true);
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Extensions.TryAdd("requestId", context.HttpContext.TraceIdentifier);
    };
});

builder.Services.AddExceptionHandler<ValidationExceptionHandler>();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

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

builder.Services.AddTransient<SortMappingProvider>();
builder.Services.AddSingleton<ISortMappingDefinition, SortMappingDefinition<HabitDto, Habit>>(_ =>
    HabitMappings.SortMapping
);
builder.Services.AddTransient<DataShapingService>();

WebApplication app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    await app.ApplyMigrationsAsync();
}

app.UseHttpsRedirection();

app.UseExceptionHandler();

app.MapControllers();

await app.RunAsync();

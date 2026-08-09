using Dailo.Api.Extensions;
using Dailo.Infrastructure;
using Dailo.Infrastructure.Database;
using Habit.Infrastructure;
using HabitEntry.Infrastructure;
using HabitUser.Infrastructure;
using Identity.Infrastructure;
using Microsoft.AspNetCore.HttpOverrides;
using Scalar.AspNetCore;
using SharedInfrastructure.Endpoint;
using Tag.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure();
builder.Services.AddHttpClient();

builder
    .Services.AddHabitModule(builder.Configuration)
    .AddHabitEntryModule(builder.Configuration)
    .AddHabitUserModule(builder.Configuration)
    .AddTagModule(builder.Configuration)
    .AddIdentityModule(builder.Configuration);

builder.Services.AddMediator(opt => opt.ServiceLifetime = ServiceLifetime.Scoped);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

if (!builder.IsOpenApiExecution() && builder.Environment.IsDevelopment())
{
    builder.AddDatabaseInitialization();
}

var app = builder.Build();

var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
};
forwardedHeadersOptions.KnownIPNetworks.Clear();
forwardedHeadersOptions.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedHeadersOptions);

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(
        "/scalar",
        opt =>
        {
            opt.WithTitle("Dailo Requests Documentation");
        }
    );
}

app.UseStatusCodePages();

app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

app.MapEndpointGroups();

await app.RunAsync();

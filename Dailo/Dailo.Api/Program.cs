using Dailo.Api.Extensions;
using Dailo.Infrastructure;
using Dailo.Infrastructure.Database;
using Habit.Infrastructure;
using Identity.Infrastructure;
using Scalar.AspNetCore;
using SharedKernel.Endpoint;
using Tag.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure();
builder.Services.AddHttpClient();

builder
    .Services.AddHabitModule(builder.Configuration)
    .AddTagModule(builder.Configuration)
    .AddIdentityModule(builder.Configuration);

builder.Services.AddMediator(opt => opt.ServiceLifetime = ServiceLifetime.Scoped);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

if (!builder.IsOpenApiExecution())
{
    builder.AddDatabaseSeeding();
}

var app = builder.Build();

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

app.UseHttpsRedirection();

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseAuthentication();
app.UseAuthorization();

app.MapEndpointGroups();

await app.RunAsync();

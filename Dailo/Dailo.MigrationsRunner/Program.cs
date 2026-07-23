using Dailo.Infrastructure.Database;
using Habit.Infrastructure;
using HabitEntry.Infrastructure;
using HabitUser.Infrastructure;
using Identity.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Tag.Infrastructure;

var builder = Host.CreateApplicationBuilder(args);

// HabitUserDbContext requires an IDataProtectionProvider; migrations don't process
// encrypted data, so an ephemeral (non-persisted) provider is sufficient here.
builder.Services.AddDataProtection();

builder
    .Services.AddHabitPersistence(builder.Configuration)
    .AddHabitEntryPersistence(builder.Configuration)
    .AddHabitUserPersistence(builder.Configuration)
    .AddIdentityPersistence(builder.Configuration)
    .AddTagPersistence(builder.Configuration);

builder.AddDatabaseInitialization();

var host = builder.Build();

// These sentinels are the authoritative success/failure signal for CI - it greps
// deployment logs for them rather than trusting Dokploy's own deployment-lifecycle
// status, which reflects "the container was started" and can go "done" before this
// one-shot process has actually finished applying migrations.
try
{
    await host.StartAsync();
    await host.StopAsync();
    Console.WriteLine("MIGRATIONS_RUNNER_RESULT=SUCCESS");
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex);
    Console.WriteLine("MIGRATIONS_RUNNER_RESULT=FAILURE");
    Environment.Exit(1);
}

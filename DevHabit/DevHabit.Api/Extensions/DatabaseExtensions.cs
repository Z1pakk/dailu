using DevHabit.Api.Database;
using DevHabit.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace DevHabit.Api.Extensions;

public static class DatabaseExtensions
{
    public static async Task ApplyMigrationsAsync(this WebApplication app)
    {
        using IServiceScope scope = app.Services.CreateScope();

        ApplicationDbContext applicationDbContext =
            scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        ApplicationIdentityDbContext applicationIdentityDbContext =
            scope.ServiceProvider.GetRequiredService<ApplicationIdentityDbContext>();

        try
        {
            await applicationDbContext.Database.MigrateAsync();
            app.Logger.LogInformation("Database migrations applied successfully.");

            await applicationIdentityDbContext.Database.MigrateAsync();
            app.Logger.LogInformation("Database Identity migrations applied successfully.");
        }
        catch (Exception ex)
        {
            app.Logger.LogError(ex, "An error occurred while applying database migrations.");
            throw;
        }
    }

    public static async Task SeedDataAsync(this WebApplication app)
    {
        using IServiceScope scope = app.Services.CreateScope();

        RoleManager<IdentityRole> roleManager = scope.ServiceProvider.GetRequiredService<
            RoleManager<IdentityRole>
        >();

        try
        {
            if (!await roleManager.RoleExistsAsync(Roles.Member))
            {
                await roleManager.CreateAsync(new IdentityRole(Roles.Member));
            }

            if (!await roleManager.RoleExistsAsync(Roles.Admin))
            {
                await roleManager.CreateAsync(new IdentityRole(Roles.Admin));
            }

            app.Logger.LogInformation("Roles seeded successfully.");
        }
        catch (Exception ex)
        {
            app.Logger.LogError(ex, "An error occurred while seeding the database.");
            throw;
        }
    }
}

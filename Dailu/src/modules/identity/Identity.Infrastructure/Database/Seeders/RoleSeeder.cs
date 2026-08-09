using Identity.Domain.Consts;
using Identity.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using SharedKernel.Persistence;

namespace Identity.Infrastructure.Database.Seeders;

internal sealed class RoleSeeder(RoleManager<Role> roleManager) : IDataSeeder
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        foreach (var roleName in Roles.All)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                await roleManager.CreateAsync(new Role { Name = roleName });
            }
        }
    }
}

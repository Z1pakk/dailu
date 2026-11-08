using Identity.Application.Services;
using Identity.Domain.Consts;
using Identity.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Identity.Infrastructure.Health;

/// <summary>
/// Verifies that sign-up and login can actually succeed, not just that the database is reachable.
/// </summary>
internal sealed class IdentityHealthCheck(
    RoleManager<Role> roleManager,
    ITokenProvider tokenProvider
) : IHealthCheck
{
    private static readonly Guid ProbeUserId = Guid.Empty;
    private const string ProbeEmail = "healthcheck@dailu.invalid";

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default
    )
    {
        // exceptions propagate on purpose: HealthCheckService reports them as Unhealthy
        // registration assigns Roles.Member — a missing role fails every sign-up
        foreach (var role in Roles.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                return HealthCheckResult.Unhealthy($"Role '{role}' is not seeded.");
            }
        }

        // signs a throwaway token: catches a missing or too-short JWT key before a user does
        tokenProvider.Create(new TokenRequest(ProbeUserId, ProbeEmail, []));

        return HealthCheckResult.Healthy();
    }
}

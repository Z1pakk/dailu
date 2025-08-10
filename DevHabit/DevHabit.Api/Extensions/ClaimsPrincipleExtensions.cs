using System.Security.Claims;

namespace DevHabit.Api.Extensions;

public static class ClaimsPrincipleExtensions
{
    public static string? GetUserIdentityId(this ClaimsPrincipal principal)
    {
        return principal.FindFirstValue(ClaimTypes.NameIdentifier);
    }
}

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using SharedKernel.User;

namespace Dailu.Infrastructure.User;

public class CurrentUserService(IHttpContextAccessor httpAccessor) : ICurrentUserService
{
    public Guid UserId => GetClaimAsGuid(ClaimTypes.NameIdentifier);

    public ClaimsPrincipal? User => httpAccessor.HttpContext?.User;

    private Guid GetClaimAsGuid(string claimType)
    {
        var claimValue = User?.FindFirstValue(claimType);

        if (string.IsNullOrEmpty(claimValue))
        {
            return Guid.NewGuid();
            // throw new UnauthorizedAccessException($"Claim {claimType} is missing or empty.");
        }

        if (!Guid.TryParse(claimValue, out var guid))
        {
            throw new UnauthorizedAccessException($"Claim {claimType} is not a valid GUID.");
        }

        return guid;
    }
}

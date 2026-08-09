using System.Security.Claims;

namespace SharedKernel.User;

public interface ICurrentUserService
{
    Guid UserId { get; }

    ClaimsPrincipal? User { get; }
}

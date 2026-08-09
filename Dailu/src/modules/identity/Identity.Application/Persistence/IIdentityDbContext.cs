using Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Persistence;

namespace Identity.Application.Persistence;

public interface IIdentityDbContext : IAppDbContextBase
{
    DbSet<User> Users { get; }

    DbSet<Role> Roles { get; }

    DbSet<UserRole> UserRoles { get; }

    DbSet<UserClaim> UserClaims { get; }

    DbSet<UserLogin> UserLogins { get; }

    DbSet<RoleClaim> RoleClaims { get; }

    DbSet<UserToken> UserTokens { get; }

    DbSet<RefreshToken> RefreshTokens { get; }
}

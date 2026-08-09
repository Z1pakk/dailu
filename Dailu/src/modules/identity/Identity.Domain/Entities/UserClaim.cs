using Microsoft.AspNetCore.Identity;
using SharedKernel.Entity;

namespace Identity.Domain.Entities;

public class UserClaim : IdentityUserClaim<Guid>, IEntityVersion
{
    public Guid Version { get; set; }
}

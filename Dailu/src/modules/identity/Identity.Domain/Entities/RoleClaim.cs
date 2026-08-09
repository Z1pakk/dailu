using Microsoft.AspNetCore.Identity;
using SharedKernel.Entity;

namespace Identity.Domain.Entities;

public class RoleClaim : IdentityRoleClaim<Guid>, IEntityVersion
{
    public Guid Version { get; set; }
}

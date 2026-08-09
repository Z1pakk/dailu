using Microsoft.AspNetCore.Identity;
using SharedKernel.Entity;

namespace Identity.Domain.Entities;

public class UserToken : IdentityUserToken<Guid>, IEntityVersion
{
    public Guid Version { get; set; }
}

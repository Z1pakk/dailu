using Microsoft.AspNetCore.Identity;
using SharedKernel.Entity;

namespace Identity.Domain.Entities;

public class UserLogin : IdentityUserLogin<Guid>, IEntityVersion
{
    public Guid Version { get; set; }
}

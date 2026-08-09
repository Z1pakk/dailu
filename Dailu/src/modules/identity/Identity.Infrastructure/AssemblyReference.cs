using System.Reflection;
using Identity.Infrastructure.Database;

namespace Identity.Infrastructure;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(IdentityDbContext).Assembly;
}

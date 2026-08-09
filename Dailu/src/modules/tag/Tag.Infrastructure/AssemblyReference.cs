using System.Reflection;
using Tag.Infrastructure.Database;

namespace Tag.Infrastructure;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(TagDbContext).Assembly;
}

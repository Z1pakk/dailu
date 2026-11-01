using System.Reflection;
using Search.Infrastructure.Database;

namespace Search.Infrastructure;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(SearchDbContext).Assembly;
}

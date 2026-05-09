using System.Reflection;

namespace HabitUser.Infrastructure.Database;

internal static class AssemblyReference
{
    internal static Assembly Assembly => typeof(AssemblyReference).Assembly;
}

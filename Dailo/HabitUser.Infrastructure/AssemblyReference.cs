using System.Reflection;
using HabitUser.Infrastructure.Database;

namespace HabitUser.Infrastructure;

internal static class AssemblyReference
{
    internal static Assembly Assembly => typeof(HabitUserDbContext).Assembly;
}

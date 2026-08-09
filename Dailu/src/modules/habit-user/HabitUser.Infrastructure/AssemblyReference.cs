using System.Reflection;
using HabitUser.Infrastructure.Database;

namespace HabitUser.Infrastructure;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(HabitUserDbContext).Assembly;
}

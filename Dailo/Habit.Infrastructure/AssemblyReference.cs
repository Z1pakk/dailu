using System.Reflection;
using Habit.Infrastructure.Database;

namespace Habit.Infrastructure;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(HabitDbContext).Assembly;
}

using System.Reflection;
using HabitEntry.Infrastructure.Database;

namespace HabitEntry.Infrastructure;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(HabitEntryDbContext).Assembly;
}

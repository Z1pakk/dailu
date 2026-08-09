using System.Reflection;

namespace HabitEntry.Api;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(AssemblyReference).Assembly;
}

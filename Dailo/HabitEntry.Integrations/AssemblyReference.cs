using System.Reflection;

namespace HabitEntry.Integrations;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(AssemblyReference).Assembly;
}

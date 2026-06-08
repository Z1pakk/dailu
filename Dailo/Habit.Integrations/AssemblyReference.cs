using System.Reflection;

namespace Habit.Integrations;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(AssemblyReference).Assembly;
}

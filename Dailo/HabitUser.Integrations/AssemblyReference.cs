using System.Reflection;

namespace HabitUser.Integrations;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(AssemblyReference).Assembly;
}

using System.Reflection;

namespace HabitUser.Api;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(AssemblyReference).Assembly;
}

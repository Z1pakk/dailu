using System.Reflection;

namespace Habit.DataTransfer;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(AssemblyReference).Assembly;
}

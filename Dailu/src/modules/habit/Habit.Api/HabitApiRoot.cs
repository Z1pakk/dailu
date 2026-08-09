using System.Reflection;

namespace Habit.Api;

public static class HabitApiRoot
{
    public static Assembly Assembly => typeof(HabitApiRoot).Assembly;
}

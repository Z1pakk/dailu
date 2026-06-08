using System.Reflection;

namespace Tag.Integrations;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(AssemblyReference).Assembly;
}

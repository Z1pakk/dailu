using System.Reflection;

namespace Tag.DataTransfer;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(AssemblyReference).Assembly;
}

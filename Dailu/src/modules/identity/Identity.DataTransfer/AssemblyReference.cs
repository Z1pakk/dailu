using System.Reflection;

namespace Identity.DataTransfer;

public static class AssemblyReference
{
    public static Assembly Assembly => typeof(AssemblyReference).Assembly;
}

using System.Reflection;

namespace Dailu.Api.Extensions;

public static class ApiDescriptorExtensions
{
    public static bool IsOpenApiExecution(this WebApplicationBuilder? builder)
    {
        return builder != null
            && Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";
    }
}

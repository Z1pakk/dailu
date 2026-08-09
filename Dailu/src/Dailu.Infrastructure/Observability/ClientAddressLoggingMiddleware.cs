using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Dailu.Infrastructure.Observability;

public sealed class ClientAddressLoggingMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ILogger<ClientAddressLoggingMiddleware> logger)
    {
        var clientAddress = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        using (
            logger.BeginScope(
                new Dictionary<string, object> { ["client.address"] = clientAddress }
            )
        )
        {
            await next(context);
        }
    }
}

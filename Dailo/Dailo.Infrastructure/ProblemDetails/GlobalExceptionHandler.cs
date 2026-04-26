using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Dailo.Infrastructure.ProblemDetails;

public sealed class GlobalExceptionHandler(
    IProblemDetailsService problemDetailsService,
    IHostEnvironment environment,
    ILogger<GlobalExceptionHandler> logger
) : IExceptionHandler
{
    public ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken
    )
    {
        logger.LogError(exception, "An unhandled exception occurred while processing the request");

        var extensions = new Dictionary<string, object?>
        {
            ["requestId"] = httpContext.TraceIdentifier,
        };

        if (environment.IsDevelopment())
        {
            extensions["stackTrace"] = exception.StackTrace;
            extensions["exceptionType"] = exception.GetType().FullName;
            extensions["exception"] = exception.ToString();
        }

        httpContext.Response.ContentType = "application/problem+json";

        return problemDetailsService.TryWriteAsync(
            new ProblemDetailsContext
            {
                HttpContext = httpContext,
                Exception = exception,
                ProblemDetails = new Microsoft.AspNetCore.Mvc.ProblemDetails()
                {
                    Title = "Internal Server Error",
                    Detail =
                        "An unexpected error occurred while processing your request. Please try again later.",
                    Status = StatusCodes.Status500InternalServerError,
                    Extensions = extensions,
                },
            }
        );
    }
}

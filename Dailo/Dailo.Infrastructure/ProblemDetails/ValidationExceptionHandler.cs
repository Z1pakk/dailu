using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;

namespace Dailo.Infrastructure.ProblemDetails;

public sealed class ValidationExceptionHandler(IProblemDetailsService problemDetailsService)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken
    )
    {
        if (exception is not ValidationException validationException)
        {
            return false;
        }

        var errors = validationException
            .Errors.GroupBy(e => e.PropertyName)
            .ToDictionary(
                g => g.Key.ToLowerInvariant(),
                g => g.Select(e => e.ErrorMessage).ToArray()
            );

        httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
        var context = new ProblemDetailsContext()
        {
            HttpContext = httpContext,
            Exception = validationException,
            ProblemDetails = new Microsoft.AspNetCore.Mvc.ProblemDetails()
            {
                Title = "Validation Error",
                Detail = "One or more validation errors occurred.",
                Status = StatusCodes.Status400BadRequest,
                Extensions = new Dictionary<string, object?> { ["errors"] = errors },
            },
        };

        return await problemDetailsService.TryWriteAsync(context);
    }
}

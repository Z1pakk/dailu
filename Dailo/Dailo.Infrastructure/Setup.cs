using Dailo.Infrastructure.Auth;
using Dailo.Infrastructure.User;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.DependencyInjection;

namespace Dailo.Infrastructure;

public static class Setup
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddAuthServices();
        services.AddProblemDetails(options =>
        {
            options.CustomizeProblemDetails = context =>
            {
                context.ProblemDetails.Instance =
                    $"{context.HttpContext.Request.Method} {context.HttpContext.Request.Path}";

                context.ProblemDetails.Extensions.TryAdd(
                    "requestId",
                    context.HttpContext.TraceIdentifier
                );

                var activity = context.HttpContext.Features.Get<IHttpActivityFeature>()?.Activity;
                context.ProblemDetails.Extensions.TryAdd("traceId", activity?.Id);
            };
        });
        services.AddUserServices();
        return services;
    }
}

using Dailo.Infrastructure.Auth;
using Dailo.Infrastructure.Cookie;
using Dailo.Infrastructure.Cors;
using Dailo.Infrastructure.CQRS;
using Dailo.Infrastructure.ProblemDetails;
using Dailo.Infrastructure.User;
using Microsoft.Extensions.DependencyInjection;

namespace Dailo.Infrastructure;

public static class Setup
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddPipelines();

        services.AddHttpContextAccessor();
        services.AddCorsServices();

        services.AddAuthServices();

        services.AddCustomProblemDetails();

        services.AddUserServices();

        services.AddCookieServices();

        return services;
    }
}

using Microsoft.Extensions.DependencyInjection;
using SharedKernel.Cookie;

namespace Dailu.Infrastructure.Cookie;

public static class Setup
{
    public static IServiceCollection AddCookieServices(this IServiceCollection services)
    {
        services.AddScoped<ICookieService, CookieService>();

        return services;
    }
}

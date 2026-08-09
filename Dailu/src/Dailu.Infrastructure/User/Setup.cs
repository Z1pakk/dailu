using Microsoft.Extensions.DependencyInjection;
using SharedKernel.User;

namespace Dailu.Infrastructure.User;

public static class UserSetup
{
    public static IServiceCollection AddUserServices(this IServiceCollection services)
    {
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        return services;
    }
}

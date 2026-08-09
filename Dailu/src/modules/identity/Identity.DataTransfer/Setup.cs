using Identity.DataTransfer.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Identity.DataTransfer;

public static class Setup
{
    public static IServiceCollection AddIdentityDataTransferServices(
        this IServiceCollection services
    )
    {
        services.AddScoped<IIdentityUserDataTransferService, IdentityUserDataTransferService>();

        return services;
    }
}

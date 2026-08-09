using System.Reflection;
using Dailu.Infrastructure.Auth;
using Dailu.Infrastructure.Cookie;
using Dailu.Infrastructure.Cors;
using Dailu.Infrastructure.CQRS;
using Dailu.Infrastructure.DataProtection;
using Dailu.Infrastructure.Observability;
using Dailu.Infrastructure.ProblemDetails;
using Dailu.Infrastructure.User;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using SharedInfrastructure.Options;

namespace Dailu.Infrastructure;

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

        services.AddValidateOptions<DataEncryptionOptions>();
        services.AddSingleton<
            IValidateOptions<DataEncryptionOptions>,
            DataEncryptionOptionsValidator
        >();

        var dataEncryptionOptions = services.GetOptions<DataEncryptionOptions>();

        services.AddDataProtection().SetApplicationName("Dailo").DisableAutomaticKeyGeneration();

        if (dataEncryptionOptions.Key != null)
        {
            services.Configure<KeyManagementOptions>(options =>
                options.XmlRepository = new SecretKeyXmlRepository(dataEncryptionOptions.Key)
            );
        }

        services.AddObservability(
            "Dailu",
            Assembly
                .GetEntryAssembly()
                ?.GetCustomAttribute<AssemblyInformationalVersionAttribute>()
                ?.InformationalVersion
                ?? "unknown",
            Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development"
        );

        return services;
    }
}

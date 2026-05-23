using Dailo.Infrastructure.Auth;
using Dailo.Infrastructure.Cookie;
using Dailo.Infrastructure.Cors;
using Dailo.Infrastructure.CQRS;
using Dailo.Infrastructure.DataProtection;
using Dailo.Infrastructure.ProblemDetails;
using Dailo.Infrastructure.User;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using SharedInfrastructure.Options;

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
                options.XmlRepository = new SecretKeyXmlRepository(dataEncryptionOptions.Key!)
            );
        }

        return services;
    }
}

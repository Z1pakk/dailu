using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using SharedKernel.Options;

namespace SharedInfrastructure.Options;

public static class ConfigurationExtensions
{
    public static TModel GetOptions<TModel>(this IServiceCollection service)
        where TModel : class, IOptions, new()
    {
        var model = new TModel();
        var configuration = service.BuildServiceProvider().GetService<IConfiguration>();
        configuration?.GetSection(model.SectionName).Bind(model);
        return model;
    }

    public static void AddValidateOptions<TModel>(this IServiceCollection service)
        where TModel : class, IOptions, new()
    {
        service
            .AddOptions<TModel>()
            .BindConfiguration(new TModel().SectionName)
            .ValidateDataAnnotations()
            .ValidateOnStart();

        service.AddSingleton(x => x.GetRequiredService<IOptions<TModel>>().Value);
    }
}

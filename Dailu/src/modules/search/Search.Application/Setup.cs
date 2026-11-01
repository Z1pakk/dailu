using Microsoft.Extensions.DependencyInjection;
using Search.Application.Features.Indexing;

namespace Search.Application;

public static class Setup
{
    public static IServiceCollection AddSearchServices(this IServiceCollection services)
    {
        services.AddScoped<ISearchIndexService, SearchIndexService>();

        return services;
    }
}

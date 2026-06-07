using HabitUser.Github.Options;
using HabitUser.Github.Services;
using HabitUser.Github.Workers;
using Microsoft.Extensions.DependencyInjection;
using SharedInfrastructure.CQRS;
using SharedInfrastructure.Endpoint;
using SharedInfrastructure.Options;

namespace HabitUser.Github;

public static class Setup
{
    public static IServiceCollection AddGithubModule(this IServiceCollection services)
    {
        services.AddHttpClient<IGitHubHttpClient, GitHubHttpClient>(client =>
        {
            client.BaseAddress = new Uri("https://api.github.com/");
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Dailu");
            client.DefaultRequestHeaders.Accept.Add(
                new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue(
                    "application/vnd.github+json"
                )
            );
        });

        services.AddScoped<IGitHubActivityService, GitHubActivityService>();

        services.AddValidateOptions<GithubOptions>();

        services.AddHostedService<GithubActivityWorker>();

        services.AddHandlerAssembly<IHabitUserGithubRoot>();
        services.AddEndpoints(assemblies: typeof(IHabitUserGithubRoot).Assembly);

        return services;
    }
}

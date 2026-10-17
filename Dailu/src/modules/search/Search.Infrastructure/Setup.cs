using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OllamaSharp;
using OpenAI;
using Search.Application.Ai;
using Search.Application.Persistence;
using Search.Infrastructure.Ai;
using Search.Infrastructure.Database;
using Search.Infrastructure.Options;
using SharedInfrastructure.Options;

namespace Search.Infrastructure;

public static class Setup
{
    public const string SearchDbConnectionString = "SearchPostgresConnectionString";

    public static IServiceCollection AddSearchModule(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        services.AddSearchPersistence(configuration);
        services.AddAiClients();

        services.AddSingleton<IEmbeddingTextFormatter, NomicEmbeddingTextFormatter>();

        return services;
    }

    private static void AddSearchPersistence(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        var connectionString = configuration.GetConnectionString(SearchDbConnectionString);

        services.AddDbContext<ISearchDbContext, SearchDbContext>(opt =>
            opt.UseNpgsql(
                    connectionString,
                    b =>
                    {
                        b.MigrationsAssembly(AssemblyReference.Assembly)
                            .MigrationsHistoryTable(
                                HistoryRepository.DefaultTableName,
                                SearchSchema.NAME
                            );
                        b.UseVector(); // ← pgvector type mapping
                        b.EnableRetryOnFailure(3, TimeSpan.FromSeconds(30), null);
                    }
                )
                .UseSnakeCaseNamingConvention()
        );
    }

    private static void AddAiClients(this IServiceCollection services)
    {
        services.AddValidateOptions<AiOptions>();

        services
            .AddEmbeddingGenerator(sp =>
            {
                var o = sp.GetRequiredService<AiOptions>().Embeddings;
                return o.Provider switch
                {
                    AiChatOptions.Ollama => (IEmbeddingGenerator<string, Embedding<float>>)
                        new OllamaApiClient(new Uri(o.Endpoint), o.Model),
                    AiChatOptions.OpenAiCompatible => CreateOpenAi(o)
                        .GetEmbeddingClient(o.Model)
                        .AsIEmbeddingGenerator(),
                    _ => throw new InvalidOperationException(
                        $"Unknown AI provider '{o.Provider}'."
                    ),
                };
            })
            .UseOpenTelemetry();
    }

    private static OpenAIClient CreateOpenAi(AiEmbeddingOptions o) =>
        new(
            new System.ClientModel.ApiKeyCredential(o.ApiKey ?? string.Empty),
            new OpenAIClientOptions { Endpoint = new Uri(o.Endpoint) }
        );
}

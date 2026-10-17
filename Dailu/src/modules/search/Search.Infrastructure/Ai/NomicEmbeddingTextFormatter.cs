using Search.Application.Ai;

namespace Search.Infrastructure.Ai;

/// <summary>
/// Nomic model embedding text formatter
/// </summary>
internal sealed class NomicEmbeddingTextFormatter : IEmbeddingTextFormatter
{
    public string ForDocument(string text) => $"search_document: {text}";

    public string ForQuery(string text) => $"search_query: {text}";
}

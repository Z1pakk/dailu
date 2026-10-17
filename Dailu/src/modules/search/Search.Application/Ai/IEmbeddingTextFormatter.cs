namespace Search.Application.Ai;

/// <summary>
/// Represents a service for formatting text in a way that is optimized for embedding models.
/// Some embedding models are trained with "task prefixes": `nomic-embed-text`
/// expects stored documents as `"search_document: <text>"` and queries as
/// "search_query: <text>".
/// Without the prefixes it still returns vectors, just noticeably worse
/// matches. Other models (OpenAI's `text-embedding-3-*`, for example) use no prefix at all. This
/// service is the one place that knows which, so switching models never means hunting through the
/// indexing and search code.
/// </summary>
public interface IEmbeddingTextFormatter
{
    /// <summary>
    /// Formats the text for embedding as a document.
    /// nomic: "search_document: " + text
    /// </summary>
    /// <param name="text">Input text</param>
    string ForDocument(string text);

    /// <summary>
    /// Formats the text for embedding when you query value from documents.
    /// nomic: "search_query: " + text
    /// </summary>
    /// <param name="text">Input text</param>
    string ForQuery(string text);
}

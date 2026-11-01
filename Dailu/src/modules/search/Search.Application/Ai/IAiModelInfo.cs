namespace Search.Application.Ai;

/// <summary>
/// Read-only view of configured values as we can't read them directly from the configuration
/// </summary>
public interface IAiModelOptions
{
    /// <summary>
    /// What model to use for embedding text
    /// </summary>
    string EmbeddingModel { get; }

    /// <summary>
    /// How many dimensions the embedding will have
    /// </summary>
    int EmbeddingDimensions { get; }
}

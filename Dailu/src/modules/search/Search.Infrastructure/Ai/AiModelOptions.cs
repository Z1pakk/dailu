using Search.Application.Ai;
using Search.Infrastructure.Options;

namespace Search.Infrastructure.Ai;

/// <summary>
/// Implements <see cref="IAiModelOptions"/> and provides read-only access to the configured values for embedding
/// </summary>
/// <param name="options"></param>
public class AiModelOptions(AiOptions options) : IAiModelOptions
{
    public string EmbeddingModel => options.Embeddings.Model;
    public int EmbeddingDimensions => options.Embeddings.Dimensions;
}

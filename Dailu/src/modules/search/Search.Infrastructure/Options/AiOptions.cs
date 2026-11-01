using System.ComponentModel.DataAnnotations;
using SharedKernel.Options;

namespace Search.Infrastructure.Options;

public class AiOptions : IOptions
{
    public string SectionName => "Ai";

    /// <summary>
    /// Settings for the AI chat model.
    /// </summary>
    [Required]
    public AiChatOptions Chat { get; init; } = new();

    /// <summary>
    /// Settings for the AI embedding model.
    /// </summary>
    [Required]
    public AiEmbeddingOptions Embeddings { get; init; } = new();
}

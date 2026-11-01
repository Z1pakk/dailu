using System.ComponentModel.DataAnnotations;

namespace Search.Infrastructure.Options;

public class AiEmbeddingOptions
{
    public const string Ollama = "ollama";

    /// <summary>
    /// Provider of the embedding model. e.g ollama
    /// </summary>
    [Required]
    public string Provider { get; init; } = Ollama;

    /// <summary>
    /// Endpoint that exposes the embedding model.
    /// </summary>
    [Required]
    public string Endpoint { get; init; } = string.Empty;

    /// <summary>
    /// Model for the embedding. e.g nomic-embed-text
    /// </summary>
    [Required]
    public string Model { get; init; } = string.Empty;

    /// <summary>
    /// Optional API key for the embedding model.
    /// </summary>
    public string? ApiKey { get; init; } = string.Empty;

    /// <summary>
    /// How many dimensions the embedding has.
    /// </summary>
    [Range(1, 4096)]
    public int Dimensions { get; set; } = 768;
}

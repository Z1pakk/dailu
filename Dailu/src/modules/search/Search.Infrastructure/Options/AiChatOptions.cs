using System.ComponentModel.DataAnnotations;

namespace Search.Infrastructure.Options;

public class AiChatOptions
{
    public const string Ollama = "ollama";
    public const string OpenAiCompatible = "openai-compatible";

    /// <summary>
    /// AI provider for the chat. e.g ollama
    /// </summary>
    [Required]
    public string Provider { get; init; } = Ollama;

    /// <summary>
    /// Provider that exposes the chat model.
    /// </summary>
    [Required]
    public string Endpoint { get; init; } = string.Empty;

    /// <summary>
    /// AI Model that is used for the chat. e.g qwen3:8b
    /// </summary>
    [Required]
    public string Model { get; init; } = string.Empty;

    /// <summary>
    /// Optional API key for the provider.
    /// </summary>
    public string? ApiKey { get; init; } = string.Empty;
}

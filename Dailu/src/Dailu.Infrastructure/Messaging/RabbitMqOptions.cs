using System.ComponentModel.DataAnnotations;
using SharedKernel.Options;

namespace Dailu.Infrastructure.Messaging;

public class RabbitMqOptions : IOptions
{
    public string SectionName => "RabbitMq";

    /// <summary>
    /// False keeps every integration event in-memory and starts no consumers — for tests and for
    /// running the API without the broker.
    /// </summary>
    public bool IsEnabled { get; init; } = true;

    [Required]
    public string Host { get; init; } = "localhost";

    [Range(1, 65535)]
    public int Port { get; init; } = 5672;

    [Required]
    public string UserName { get; init; } = "";

    [Required]
    public string Password { get; init; } = "";

    public string VirtualHost { get; init; } = "/";
}

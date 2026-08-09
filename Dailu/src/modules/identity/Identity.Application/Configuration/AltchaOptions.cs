using System.ComponentModel.DataAnnotations;
using SharedKernel.Options;

namespace Identity.Application.Configuration;

public class AltchaOptions : IOptions
{
    public string SectionName => "Altcha";

    [Required]
    public string HmacKey { get; init; } = string.Empty;

    public string Algorithm { get; init; } = "PBKDF2/SHA-256";

    public int Cost { get; init; } = 10_000;

    public string KeyPrefix { get; init; } = "00";
}

using System.ComponentModel.DataAnnotations;
using SharedKernel.Options;

namespace SharedKernel.Configuration;

public class JwtAuthOptions : IOptions
{
    public string SectionName => "Jwt";

    [Required]
    public string Issuer { get; set; } = null!;

    [Required]
    public string Audience { get; set; } = null!;

    [Required]
    public string Key { get; set; } = null!;

    [Range(0, 1000)]
    public int ExpirationInMinutes { get; set; }

    [Range(0, 500)]
    public int RefreshTokenExpirationInDays { get; set; }
}

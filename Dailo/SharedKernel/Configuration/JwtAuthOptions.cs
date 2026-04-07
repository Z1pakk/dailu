using System.ComponentModel.DataAnnotations;

namespace SharedKernel.Configuration;

public class JwtAuthOptions : IOptions
{
    public string SectionName => "Jwt";

    [Required]
    public string Issuer { get; set; }

    [Required]
    public string Audience { get; set; }

    [Required]
    public string Key { get; set; }

    [Range(0, 1000)]
    public int ExpirationInMinutes { get; set; }

    [Range(0, 500)]
    public int RefreshTokenExpirationInDays { get; set; }
}

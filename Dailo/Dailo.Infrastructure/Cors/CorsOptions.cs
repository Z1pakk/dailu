using System.ComponentModel.DataAnnotations;
using SharedKernel.Options;

namespace Dailo.Infrastructure.Cors;

public class CorsOptions: IOptions
{
    public string SectionName => "Cors";

    public const string PolicyName = "DailuCorsPolicy";

    [Required] public string[] AllowedOrigins { get; set; } = [];
}

using System.ComponentModel.DataAnnotations;
using SharedKernel.Options;

namespace Dailo.Infrastructure.DataProtection;

internal sealed class DataEncryptionOptions : IOptions
{
    public string SectionName => "DataEncryption";

    [Required]
    [MinLength(16)]
    public string? Key { get; init; }
}

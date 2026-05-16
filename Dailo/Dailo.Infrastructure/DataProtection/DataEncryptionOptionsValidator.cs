using Microsoft.Extensions.Options;

namespace Dailo.Infrastructure.DataProtection;

internal sealed class DataEncryptionOptionsValidator : IValidateOptions<DataEncryptionOptions>
{
    public ValidateOptionsResult Validate(string? name, DataEncryptionOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.Key))
        {
            return ValidateOptionsResult.Fail("DataEncryption:Key is required.");
        }

        if (options.Key.Length < 16)
        {
            return ValidateOptionsResult.Fail("DataEncryption:Key must be at least 16 characters.");
        }

        return ValidateOptionsResult.Success;
    }
}

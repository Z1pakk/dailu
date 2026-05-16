using System.Text.Json;
using HabitUser.Domain.Integrations;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace HabitUser.Infrastructure.Database.ValueConverters;

internal sealed class EncryptedIntegrationConfigConverter : ValueConverter<IntegrationConfig, string>
{
    public EncryptedIntegrationConfigConverter(IDataProtector protector)
        : base(
            config => protector.Protect(JsonSerializer.Serialize(config, JsonSerializerOptions.Web)),
            encrypted => JsonSerializer.Deserialize<IntegrationConfig>(protector.Unprotect(encrypted), JsonSerializerOptions.Web)!
        )
    { }
}

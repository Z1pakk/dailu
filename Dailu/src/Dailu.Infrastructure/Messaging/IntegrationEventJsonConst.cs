using System.Text.Json;

namespace Dailu.Infrastructure.Messaging;

public static class IntegrationEventJsonConst
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
}

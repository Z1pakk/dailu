using System.Text.Json.Serialization;

namespace HabitUser.Domain.Entities;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum IntegrationSyncStatus
{
    [JsonStringEnumMemberName("success")]
    Success = 0,

    [JsonStringEnumMemberName("failed")]
    Failed = 1,
}

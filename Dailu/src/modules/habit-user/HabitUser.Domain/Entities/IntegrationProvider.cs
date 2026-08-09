using System.Text.Json.Serialization;

namespace HabitUser.Domain.Entities;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum IntegrationProvider
{
    [JsonStringEnumMemberName("github")]
    Github = 0,

    [JsonStringEnumMemberName("strava")]
    Strava = 1,

    [JsonStringEnumMemberName("google-health")]
    GoogleHealth = 2,
}

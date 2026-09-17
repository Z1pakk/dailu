using System.Text.Json.Serialization;

namespace HabitUser.GoogleHealth.Models.Internal;

internal sealed record GoogleHealthDailyRollupRequest
{
    [JsonPropertyName("range")]
    public required GoogleHealthCivilTimeIntervalRequest Range { get; init; }

    [JsonPropertyName("windowSizeDays")]
    public int WindowSizeDays { get; init; } = 1;
}

internal sealed record GoogleHealthCivilTimeIntervalRequest
{
    [JsonPropertyName("start")]
    public required GoogleHealthCivilDateTimeRequest Start { get; init; }

    [JsonPropertyName("end")]
    public required GoogleHealthCivilDateTimeRequest End { get; init; }
}

internal sealed record GoogleHealthCivilDateTimeRequest
{
    [JsonPropertyName("date")]
    public required GoogleHealthCivilDateRequest Date { get; init; }
}

internal sealed record GoogleHealthCivilDateRequest
{
    [JsonPropertyName("year")]
    public int Year { get; init; }

    [JsonPropertyName("month")]
    public int Month { get; init; }

    [JsonPropertyName("day")]
    public int Day { get; init; }
}

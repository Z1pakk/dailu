using System.Text.Json.Serialization;

namespace HabitUser.GoogleHealth.Models.Internal;

internal sealed record GoogleHealthDailyRollupResponse
{
    [JsonPropertyName("rollupDataPoints")]
    public IReadOnlyList<GoogleHealthRollupDataPointResponse> RollupDataPoints { get; init; } = [];
}

internal sealed record GoogleHealthRollupDataPointResponse
{
    [JsonPropertyName("civilStartTime")]
    public GoogleHealthCivilDateTimeResponse? CivilStartTime { get; init; }

    [JsonPropertyName("steps")]
    public GoogleHealthStepsRollupResponse? Steps { get; init; }
}

internal sealed record GoogleHealthCivilDateTimeResponse
{
    [JsonPropertyName("date")]
    public GoogleHealthCivilDateResponse? Date { get; init; }
}

internal sealed record GoogleHealthCivilDateResponse
{
    [JsonPropertyName("year")]
    public int Year { get; init; }

    [JsonPropertyName("month")]
    public int Month { get; init; }

    [JsonPropertyName("day")]
    public int Day { get; init; }
}

internal sealed record GoogleHealthStepsRollupResponse
{
    [JsonPropertyName("countSum")]
    public double CountSum { get; init; }
}

using System.Text.Json.Serialization;

namespace HabitUser.GoogleHealth.Models.Internal;

internal sealed record GoogleHealthDataPointsResponse
{
    [JsonPropertyName("dataPoints")]
    public IReadOnlyList<GoogleHealthDataPointResponse> DataPoints { get; init; } = [];
}

internal sealed record GoogleHealthDataPointResponse
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("exercise")]
    public GoogleHealthExerciseResponse? Exercise { get; init; }
}

internal sealed record GoogleHealthExerciseResponse
{
    [JsonPropertyName("interval")]
    public GoogleHealthIntervalResponse? Interval { get; init; }

    [JsonPropertyName("exerciseType")]
    public string ExerciseType { get; init; } = string.Empty;

    [JsonPropertyName("displayName")]
    public string? DisplayName { get; init; }

    // Duration string from the API, e.g. "1800s"
    [JsonPropertyName("activeDuration")]
    public string? ActiveDuration { get; init; }

    [JsonPropertyName("metricsSummary")]
    public GoogleHealthMetricsSummaryResponse? MetricsSummary { get; init; }
}

internal sealed record GoogleHealthIntervalResponse
{
    [JsonPropertyName("startTime")]
    public DateTime StartTime { get; init; }

    [JsonPropertyName("endTime")]
    public DateTime EndTime { get; init; }
}

internal sealed record GoogleHealthMetricsSummaryResponse
{
    [JsonPropertyName("caloriesKcal")]
    public double? CaloriesKcal { get; init; }
}

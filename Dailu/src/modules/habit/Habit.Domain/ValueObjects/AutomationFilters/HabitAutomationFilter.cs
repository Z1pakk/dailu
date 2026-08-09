using System.Text.Json.Serialization;

namespace Habit.Domain.ValueObjects.AutomationFilters;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(GithubAutomationFilter), "github")]
[JsonDerivedType(typeof(StravaAutomationFilter), "strava")]
[JsonDerivedType(typeof(GoogleHealthAutomationFilter), "google-health")]
public abstract record HabitAutomationFilter;

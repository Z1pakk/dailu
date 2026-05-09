using HabitEntry.Domain.Enums;
using StrictId;

namespace HabitEntry.Application.Models;

public class HabitEntryModel
{
    public required Id<HabitEntryModel> Id { get; set; }

    public required Id HabitId { get; set; }

    public required string HabitName { get; set; }

    public required int Value { get; set; }

    public string? Notes { get; set; }

    public required HabitEntrySource Source { get; set; }

    public string? ExternalId { get; set; }

    public required DateTime CompletedAtUtc { get; set; }

    public bool IsArchived { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? LastModifiedAtUtc { get; set; }
}

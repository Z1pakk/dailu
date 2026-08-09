using HabitEntry.Domain.Enums;

namespace HabitEntry.Domain.Entities;

public class HabitEntryEntity : BaseEntity<Id<HabitEntryEntity>>
{
    public required Guid UserId { get; set; }

    public required Id HabitId { get; set; }

    public required int Value { get; set; }

    public string? Notes { get; set; }

    public required HabitEntrySource Source { get; set; }

    public string? ExternalId { get; set; }

    public required DateTime CompletedAtUtc { get; set; }

    public bool IsArchived { get; set; }
}

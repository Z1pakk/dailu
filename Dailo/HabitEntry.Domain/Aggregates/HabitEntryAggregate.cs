using HabitEntry.Domain.Entities;
using HabitEntry.Domain.Enums;
using SharedKernel.ResultPattern;
using StrictId;

namespace HabitEntry.Domain.Aggregates;

public sealed class HabitEntryAggregate : Aggregate
{
    private Id<HabitEntryAggregate> Id { get; set; }

    private Guid UserId { get; set; }

    private Id HabitId { get; set; } = default!;

    private int Value { get; set; }

    private string? Notes { get; set; }

    private HabitEntrySource Source { get; set; }

    private string? ExternalId { get; set; }

    private DateOnly Date { get; set; }

    private bool IsArchived { get; set; }

    private HabitEntryAggregate() { }

    public static Result<HabitEntryAggregate> Create(
        Id<HabitEntryAggregate> id,
        Guid userId,
        Id habitId,
        int value,
        string? notes,
        HabitEntrySource source,
        string? externalId,
        DateOnly date
    )
    {
        if (value < 0)
        {
            return Result<HabitEntryAggregate>.BadRequest("Value must be greater than or equal to zero.");
        }

        if (habitId == default)
        {
            return Result<HabitEntryAggregate>.BadRequest("HabitId is required.");
        }

        if (date > DateOnly.FromDateTime(DateTime.UtcNow))
        {
            return Result<HabitEntryAggregate>.BadRequest("Date cannot be in the future.");
        }

        return Result<HabitEntryAggregate>.Success(
            new HabitEntryAggregate
            {
                Id = id,
                UserId = userId,
                HabitId = habitId,
                Value = value,
                Notes = notes,
                Source = source,
                ExternalId = externalId,
                Date = date,
                IsArchived = false,
            }
        );
    }

    public HabitEntryEntity ToEntity() =>
        new()
        {
            Id = Id.ToId(),
            UserId = UserId,
            HabitId = HabitId,
            Value = Value,
            Notes = Notes,
            Source = Source,
            ExternalId = ExternalId,
            Date = Date,
            IsArchived = IsArchived,
        };
}
using Dailo.Events;
using HabitEntry.Domain.Entities;
using HabitEntry.Domain.Enums;
using SharedKernel.ResultPattern;

namespace HabitEntry.Domain.Aggregates;

public sealed class HabitEntryAggregate : Aggregate
{
    private Id<HabitEntryAggregate> Id { get; set; }

    private Guid UserId { get; set; }

    private Id HabitId { get; set; }

    private int Value { get; set; }

    private string? Notes { get; set; }

    private HabitEntrySource Source { get; set; }

    private string? ExternalId { get; set; }

    private bool IsArchived { get; set; }

    private DateTime CompletedAtUtc { get; set; }

    private HabitEntryAggregate() { }

    public static Result<HabitEntryAggregate> Create(
        Id<HabitEntryAggregate> id,
        Guid userId,
        Id habitId,
        int value,
        string? notes,
        HabitEntrySource source,
        string? externalId,
        DateTime completedAtUtc
    )
    {
        if (value < 0)
        {
            return Result<HabitEntryAggregate>.BadRequest(
                "Value must be greater than or equal to zero."
            );
        }

        if (habitId == default)
        {
            return Result<HabitEntryAggregate>.BadRequest("HabitId is required.");
        }

        if (completedAtUtc > DateTime.UtcNow)
        {
            return Result<HabitEntryAggregate>.BadRequest("Date cannot be in the future.");
        }

        var aggregate = new HabitEntryAggregate
        {
            Id = id,
            UserId = userId,
            HabitId = habitId,
            Value = value,
            Notes = notes,
            Source = source,
            ExternalId = externalId,
            CompletedAtUtc = completedAtUtc,
            IsArchived = false,
        };

        aggregate.RaiseDomainEvent(
            new HabitEntryCompletedIntegrationEvent(habitId, completedAtUtc)
        );

        return Result<HabitEntryAggregate>.Success(aggregate);
    }

    public static HabitEntryAggregate Restore(
        Id<HabitEntryAggregate> id,
        Guid userId,
        Id habitId,
        int value,
        string? notes,
        HabitEntrySource source,
        string? externalId,
        bool isArchived,
        DateTime completedAtUtc,
        Guid version
    )
    {
        return new HabitEntryAggregate
        {
            Id = id,
            UserId = userId,
            HabitId = habitId,
            Value = value,
            Notes = notes,
            Source = source,
            ExternalId = externalId,
            IsArchived = isArchived,
            CompletedAtUtc = completedAtUtc,
            Version = version,
        };
    }

    public Result Update(int value, string? notes, DateTime completedAt)
    {
        if (value < 0)
        {
            return Result.BadRequest("Value must be greater than or equal to zero.");
        }

        if (completedAt > DateTime.UtcNow)
        {
            return Result.BadRequest("Date cannot be in the future.");
        }

        Value = value;
        Notes = notes;
        CompletedAtUtc = completedAt;

        return Result.Success();
    }

    public HabitEntryEntity ToEntity()
    {
        var entity = new HabitEntryEntity
        {
            Id = Id.ToId(),
            UserId = UserId,
            HabitId = HabitId,
            Value = Value,
            Notes = Notes,
            Source = Source,
            ExternalId = ExternalId,
            CompletedAtUtc = CompletedAtUtc,
            IsArchived = IsArchived,
            Version = Version,
        };

        entity.AddDomainEvent(ConsumeDomainEvents());

        return entity;
    }
}

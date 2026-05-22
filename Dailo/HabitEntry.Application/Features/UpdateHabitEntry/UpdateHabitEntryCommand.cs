using HabitEntry.Application.Models;
using HabitEntry.Application.Persistence;
using HabitEntry.Domain.Aggregates;
using HabitEntry.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;
using StrictId;

namespace HabitEntry.Application.Features.UpdateHabitEntry;

public sealed record UpdateHabitEntryCommand(
    Id<HabitEntryModel> EntryId,
    int Value,
    string? Notes,
    DateTime CompletedAt
) : ICommand<Result>;

public sealed class UpdateHabitEntryCommandHandler(
    IHabitEntryDbContext dbContext,
    ICurrentUserService currentUserService
) : ICommandHandler<UpdateHabitEntryCommand, Result>
{
    public async ValueTask<Result> Handle(
        UpdateHabitEntryCommand request,
        CancellationToken cancellationToken
    )
    {
        var entryId = new Id<HabitEntryEntity>(request.EntryId.Value);

        var habitEntry = await dbContext
            .HabitEntries.AsNoTracking()
            .FirstOrDefaultAsync(
                e => e.Id == entryId && e.UserId == currentUserService.UserId,
                cancellationToken
            );

        if (habitEntry is null)
        {
            return Result.NotFound("Habit entry not found.");
        }

        var aggregate = HabitEntryAggregate.Restore(
            new Id<HabitEntryAggregate>(habitEntry.Id.Value),
            habitEntry.UserId,
            habitEntry.HabitId,
            habitEntry.Value,
            habitEntry.Notes,
            habitEntry.Source,
            habitEntry.ExternalId,
            habitEntry.IsArchived,
            habitEntry.CompletedAtUtc,
            habitEntry.Version
        );

        var updateResult = aggregate.Update(request.Value, request.Notes, request.CompletedAt);

        if (updateResult.IsFailure)
        {
            return updateResult;
        }

        var updatedHabitEntry = aggregate.ToEntity();

        dbContext.HabitEntries.Update(updatedHabitEntry);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

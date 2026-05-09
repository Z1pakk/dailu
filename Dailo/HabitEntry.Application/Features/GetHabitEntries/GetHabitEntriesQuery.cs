using HabitEntry.Application.IntegratedServices;
using HabitEntry.Application.Models;
using HabitEntry.Application.Persistence;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;
using StrictId;

namespace HabitEntry.Application.Features.GetHabitEntries;

public sealed class GetHabitEntriesQuery : IQuery<Result<GetHabitEntriesQueryResponse>> { }

public sealed record GetHabitEntriesQueryResponse(IEnumerable<HabitEntryModel> HabitEntries);

public sealed class GetHabitEntriesQueryHandler(
    IHabitEntryDbContext habitEntryDbContext,
    ICurrentUserService currentUserService,
    IHabitService habitService
) : IQueryHandler<GetHabitEntriesQuery, Result<GetHabitEntriesQueryResponse>>
{
    public async ValueTask<Result<GetHabitEntriesQueryResponse>> Handle(
        GetHabitEntriesQuery request,
        CancellationToken cancellationToken
    )
    {
        var entries = await habitEntryDbContext
            .HabitEntries.AsNoTracking()
            .Where(h => h.UserId == currentUserService.UserId)
            .OrderByDescending(h => h.CompletedAtUtc)
            .ThenByDescending(h => h.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var habitIds = entries.Select(e => e.HabitId).ToHashSet();

        var habits = await habitService.GetByIdsAsync(habitIds, cancellationToken);

        var habitEntryModels = entries
            .Select(e => new HabitEntryModel
            {
                Id = new Id<HabitEntryModel>(e.Id.Value),
                HabitId = e.HabitId,
                HabitName = habits.GetValueOrDefault(e.HabitId)?.Name ?? "Unknown",
                Value = e.Value,
                Notes = e.Notes,
                Source = e.Source,
                ExternalId = e.ExternalId,
                CompletedAtUtc = e.CompletedAtUtc,
                IsArchived = e.IsArchived,
                CreatedAtUtc = e.CreatedAtUtc,
                LastModifiedAtUtc = e.LastModifiedAtUtc,
            })
            .ToList();

        return Result<GetHabitEntriesQueryResponse>.Success(
            new GetHabitEntriesQueryResponse(habitEntryModels)
        );
    }
}

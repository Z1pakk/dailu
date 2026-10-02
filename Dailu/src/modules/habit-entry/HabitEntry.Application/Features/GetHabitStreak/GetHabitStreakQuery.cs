using HabitEntry.Application.IntegratedServices;
using HabitEntry.Application.Persistence;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using StrictId;

namespace HabitEntry.Application.Features.GetHabitStreak;

public sealed record GetHabitStreakQuery(Id HabitId, int Days)
    : IQuery<Result<GetHabitStreakQueryResponse>>;

public sealed record GetHabitStreakQueryResponse(
    Id HabitId,
    string HabitName,
    int CurrentStreak,
    int LongestStreak,
    int CompletedDays
);

public sealed class GetHabitStreakQueryHandler(
    IHabitEntryDbContext habitEntryDbContext,
    IHabitService habitService
) : IQueryHandler<GetHabitStreakQuery, Result<GetHabitStreakQueryResponse>>
{
    public async ValueTask<Result<GetHabitStreakQueryResponse>> Handle(
        GetHabitStreakQuery request,
        CancellationToken cancellationToken
    )
    {
        var habits = habitService.GetByIdsAsync([request.HabitId], cancellationToken).Result;
        var habitName = habits.GetValueOrDefault(request.HabitId)?.Name ?? "Unknown";

        var today = DateTime.UtcNow.Date;
        var currentStreak = 0;
        var longestStreak = 0;
        var runningStreak = 0;
        var completedDays = 0;
        var currentStreakBroken = false;

        for (var i = 0; i <= request.Days; i++)
        {
            var day = today.AddDays(-i);
            var nextDay = day.AddDays(1);

            var hasEntry = await habitEntryDbContext.HabitEntries.AnyAsync(
                e =>
                    e.HabitId == request.HabitId
                    && !e.IsArchived
                    && e.CompletedAtUtc > day
                    && e.CompletedAtUtc < nextDay,
                cancellationToken
            );

            if (hasEntry)
            {
                completedDays++;
                runningStreak++;
                longestStreak = Math.Max(longestStreak, runningStreak);

                if (!currentStreakBroken)
                {
                    currentStreak++;
                }
            }
            else
            {
                runningStreak = 0;
                currentStreakBroken = true;
            }
        }

        return Result<GetHabitStreakQueryResponse>.Success(
            new GetHabitStreakQueryResponse(
                request.HabitId,
                habitName,
                currentStreak,
                longestStreak,
                completedDays
            )
        );
    }
}

using Habit.Application.Persistence;
using Habit.DataTransfer.Models;
using Habit.Domain.Entities;
using Habit.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using SharedKernel.User;
using StrictId;

namespace Habit.DataTransfer.Services;

public interface IHabitDataTransferService
{
    Task<Dictionary<Id<HabitModel>, HabitModel>> GetByIdsAsync(
        IEnumerable<Id<HabitModel>> ids,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<HabitModel>> GetByAutomationSourceAsync(
        Guid userId,
        AutomationSource source,
        CancellationToken cancellationToken = default
    );
}

public class HabitDataTransferService(IHabitDbContext dbContext, ICurrentUserService currentUserService)
    : IHabitDataTransferService
{
    public async Task<Dictionary<Id<HabitModel>, HabitModel>> GetByIdsAsync(
        IEnumerable<Id<HabitModel>> ids,
        CancellationToken cancellationToken = default
    )
    {
        var uniqueHabitIds = ids.Select(id => new Id<HabitEntity>(id.Value)).ToHashSet();

        var habits = await dbContext
            .Habits.AsNoTracking()
            .Where(h => uniqueHabitIds.Contains(h.Id) && h.UserId == currentUserService.UserId)
            .Select(h => new HabitModel
            {
                Id = new Id<HabitModel>(h.Id.Value),
                Name = h.Name,
                Type = h.Type,
            })
            .ToDictionaryAsync(h => h.Id, cancellationToken);

        return habits;
    }

    public async Task<IReadOnlyList<HabitModel>> GetByAutomationSourceAsync(
        Guid userId,
        AutomationSource source,
        CancellationToken cancellationToken = default
    )
    {
        return await dbContext
            .Habits.AsNoTracking()
            .Where(h => h.UserId == userId && h.AutomationSource == source && !h.IsArchived)
            .Select(h => new HabitModel
            {
                Id = new Id<HabitModel>(h.Id.Value),
                Name = h.Name,
                Type = h.Type,
            })
            .ToListAsync(cancellationToken);
    }
}

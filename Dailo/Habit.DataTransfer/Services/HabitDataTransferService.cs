using Microsoft.EntityFrameworkCore;
using SharedKernel.User;
using StrictId;
using Habit.Application.Persistence;
using Habit.DataTransfer.Models;
using Habit.Domain.Entities;

namespace Habit.DataTransfer.Services;

public interface IHabitDataTransferService
{
    Task<Dictionary<Id<HabitModel>, HabitModel>> GetByIdsAsync(
        IEnumerable<Id<HabitModel>> ids,
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
            })
            .ToDictionaryAsync(h => h.Id, cancellationToken);

        return habits;
    }

    }
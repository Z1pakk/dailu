using Habit.DataTransfer.Services;
using HabitEntry.Application.IntegratedServices;
using HabitEntry.Application.Models;
using StrictId;

namespace HabitEntry.Integrations.Habits.Services;

public class HabitService(IHabitDataTransferService habitDataTransferService) : IHabitService
{
    public async Task<Dictionary<Id, HabitInfoModel>> GetByIdsAsync(
        IEnumerable<Id> ids,
        CancellationToken cancellationToken = default
    )
    {
        var targetIds = ids.Select(id => new Id<Habit.DataTransfer.Models.HabitModel>(id.Value));

        var responseHabits = await habitDataTransferService.GetByIdsAsync(
            targetIds,
            cancellationToken
        );

        var result = responseHabits.ToDictionary(
            kvp => new Id(kvp.Key.Value),
            kvp => new HabitInfoModel(new Id(kvp.Key.Value), kvp.Value.Name)
        );

        return result;
    }
}

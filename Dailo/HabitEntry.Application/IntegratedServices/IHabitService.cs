using HabitEntry.Application.Models;
using StrictId;

namespace HabitEntry.Application.IntegratedServices;

public interface IHabitService
{
    Task<Dictionary<Id, HabitInfoModel>> GetByIdsAsync(
        IEnumerable<Id> ids,
        CancellationToken cancellationToken = default
    );
}

using Dailo.Events;
using HabitEntry.Application.Models;
using StrictId;

namespace HabitEntry.Application.IntegratedServices;

public interface IHabitService
{
    Task<Dictionary<Id, HabitInfoModel>> GetByIdsAsync(
        IEnumerable<Id> ids,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<HabitInfoModel>> GetByAutomationSourceAsync(
        Guid userId,
        IntegrationActivitySource source,
        CancellationToken cancellationToken = default
    );
}

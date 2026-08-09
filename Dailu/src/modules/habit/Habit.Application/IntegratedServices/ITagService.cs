using Habit.Application.Models;
using StrictId;

namespace Habit.Application.IntegratedServices;

public interface ITagService
{
    Task<Dictionary<Id<TagModel>, TagModel>> GetByIdsAsync(
        IEnumerable<Id<TagModel>> ids,
        CancellationToken cancellationToken = default
    );
}

using Microsoft.EntityFrameworkCore;
using SharedKernel.Persistence;

namespace HabitEntry.Application.Persistence;

public interface IHabitEntryDbContext : IAppDbContextBase
{
    DbSet<HabitEntry.Domain.Entities.HabitEntryEntity> HabitEntries { get; }
}

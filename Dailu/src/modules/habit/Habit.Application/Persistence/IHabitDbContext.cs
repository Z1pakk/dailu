using Habit.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Persistence;

namespace Habit.Application.Persistence;

public interface IHabitDbContext : IAppDbContextBase
{
    DbSet<HabitEntity> Habits { get; }

    DbSet<HabitTagEntity> HabitTags { get; }
}

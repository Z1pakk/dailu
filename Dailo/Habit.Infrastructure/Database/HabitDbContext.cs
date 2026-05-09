using Habit.Application.Persistence;
using Habit.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using SharedInfrastructure.Persistence;
using SharedKernel.User;

namespace Habit.Infrastructure.Database;

public sealed class HabitDbContext(
    DbContextOptions<HabitDbContext> options,
    ICurrentUserService? currentUserService = null,
    TimeProvider? timeProvider = null
) : AppDbContextBase(options, currentUserService, timeProvider), IHabitDbContext
{
    public string Schema => HabitSchema.NAME;

    public DbSet<HabitEntity> Habits => Set<HabitEntity>();

    public DbSet<HabitTagEntity> HabitTags => Set<HabitTagEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.ApplyConfigurationsFromAssembly(AssemblyReference.Assembly);

        base.OnModelCreating(modelBuilder);
    }
}

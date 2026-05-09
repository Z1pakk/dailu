using HabitEntry.Application.Persistence;
using HabitEntry.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using SharedInfrastructure.Persistence;
using SharedKernel.User;

namespace HabitEntry.Infrastructure.Database;

public sealed class HabitEntryDbContext(
    DbContextOptions<HabitEntryDbContext> options,
    ICurrentUserService? currentUserService = null,
    TimeProvider? timeProvider = null
) : AppDbContextBase(options, currentUserService, timeProvider), IHabitEntryDbContext
{
    public string Schema => HabitEntrySchema.NAME;

    public DbSet<HabitEntryEntity> HabitEntries => Set<HabitEntryEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.ApplyConfigurationsFromAssembly(AssemblyReference.Assembly);

        base.OnModelCreating(modelBuilder);
    }
}

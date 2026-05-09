using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using SharedInfrastructure.Persistence;
using SharedKernel.User;

namespace HabitUser.Infrastructure.Database;

public sealed class HabitUserDbContext(
    DbContextOptions<HabitUserDbContext> options,
    ICurrentUserService? currentUserService = null,
    TimeProvider? timeProvider = null
) : AppDbContextBase(options, currentUserService, timeProvider), IHabitUserDbContext
{
    public string Schema => HabitUserSchema.NAME;

    public DbSet<HabitUserEntity> HabitUsers => Set<HabitUserEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.ApplyConfigurationsFromAssembly(AssemblyReference.Assembly);

        base.OnModelCreating(modelBuilder);
    }
}

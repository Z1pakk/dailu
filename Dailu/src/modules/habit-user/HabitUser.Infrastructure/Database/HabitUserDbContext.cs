using HabitUser.Application.Persistence;
using HabitUser.Domain.Entities;
using HabitUser.Infrastructure.Database.ValueConverters;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using SharedInfrastructure.Persistence;
using SharedKernel.User;

namespace HabitUser.Infrastructure.Database;

public sealed class HabitUserDbContext(
    DbContextOptions<HabitUserDbContext> options,
    IDataProtectionProvider dataProtectionProvider,
    ICurrentUserService? currentUserService = null,
    TimeProvider? timeProvider = null
) : AppDbContextBase(options, currentUserService, timeProvider), IHabitUserDbContext
{
    private readonly EncryptedIntegrationConfigConverter _integrationConfigConverter =
        new(dataProtectionProvider.CreateProtector("HabitUser.IntegrationConfigs"));

    public string Schema => HabitUserSchema.NAME;

    public DbSet<HabitUserEntity> HabitUsers => Set<HabitUserEntity>();
    public DbSet<IntegrationConfigEntity> IntegrationConfigs => Set<IntegrationConfigEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.ApplyConfigurationsFromAssembly(AssemblyReference.Assembly);

        modelBuilder.Entity<IntegrationConfigEntity>()
            .Property(x => x.Config)
            .HasConversion(_integrationConfigConverter);

        base.OnModelCreating(modelBuilder);
    }
}

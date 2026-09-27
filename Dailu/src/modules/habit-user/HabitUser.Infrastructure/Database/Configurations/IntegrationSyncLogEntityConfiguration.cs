using HabitUser.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SharedInfrastructure.Persistence;
using StrictId.EFCore.ValueConverters;

namespace HabitUser.Infrastructure.Database.Configurations;

internal sealed class IntegrationSyncLogEntityConfiguration
    : BaseEntityTypedConfiguration<IntegrationSyncLogEntity>
{
    protected override void ConfigureEntity(EntityTypeBuilder<IntegrationSyncLogEntity> builder)
    {
        builder.ToTable("integration_sync_logs");

        builder
            .Property(x => x.IntegrationConfigId)
            .HasConversion(new IdTypedToGuidConverter<IntegrationConfigEntity>());

        builder
            .HasOne(x => x.IntegrationConfig)
            .WithMany()
            .HasForeignKey(x => x.IntegrationConfigId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasConversion<string>();

        builder
            .Property(x => x.ErrorMessage)
            .HasMaxLength(IntegrationSyncLogEntity.ErrorMessageMaxLength);

        builder
            .HasIndex(x => new { x.IntegrationConfigId, x.StartedAtUtc })
            .IsDescending(false, true);

        builder.HasIndex(x => x.StartedAtUtc);
    }
}

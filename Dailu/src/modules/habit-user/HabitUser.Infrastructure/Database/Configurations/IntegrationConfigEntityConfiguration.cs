using HabitUser.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SharedInfrastructure.Persistence;
using StrictId.EFCore.ValueConverters;

namespace HabitUser.Infrastructure.Database.Configurations;

internal sealed class IntegrationConfigEntityConfiguration
    : BaseEntityTypedConfiguration<IntegrationConfigEntity>
{
    protected override void ConfigureEntity(EntityTypeBuilder<IntegrationConfigEntity> builder)
    {
        builder.ToTable("integration_configs");

        builder
            .Property(b => b.HabitUserId)
            .HasConversion(new IdTypedToGuidConverter<HabitUserEntity>());

        builder.Property(x => x.Provider).IsRequired().HasMaxLength(50).HasConversion<string>();

        builder.Property(x => x.Config).IsRequired().HasColumnType("text");

        builder
            .HasIndex(x => new { x.HabitUserId, x.Provider })
            .IsUnique()
            .HasFilter("is_deleted = false");
    }
}

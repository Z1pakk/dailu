using HabitEntry.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SharedInfrastructure.Persistence;
using StrictId.EFCore.ValueConverters;

namespace HabitEntry.Infrastructure.Database.Configurations;

internal sealed class HabitEntryEntityConfiguration : BaseEntityTypedConfiguration<HabitEntryEntity>
{
    protected override void ConfigureEntity(EntityTypeBuilder<HabitEntryEntity> builder)
    {
        builder.ToTable("habit_entries");

        builder.Property(h => h.HabitId).HasConversion(new IdToGuidConverter());
        builder.Property(h => h.UserId).IsRequired();
        builder.Property(h => h.Value).IsRequired();
        builder.Property(h => h.Notes).HasMaxLength(2000);

        builder.Property(h => h.Source).IsRequired();
        builder.Property(h => h.ExternalId).HasMaxLength(200);

        builder.Property(h => h.CompletedAtUtc).IsRequired();
        builder.Property(h => h.IsArchived).HasDefaultValue(false);

        builder.HasIndex(h => h.UserId);
    }
}

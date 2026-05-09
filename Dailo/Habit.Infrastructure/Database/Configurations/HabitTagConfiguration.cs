using Habit.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SharedInfrastructure.Persistence;
using StrictId.EFCore.ValueConverters;

namespace Habit.Infrastructure.Database.Configurations;

internal sealed class HabitTagEntityConfiguration : BaseEntityTypedConfiguration<HabitTagEntity>
{
    protected override void ConfigureEntity(EntityTypeBuilder<HabitTagEntity> builder)
    {
        builder.ToTable("habit_tags");

        builder.Property(b => b.HabitId).HasConversion(new IdTypedToGuidConverter<HabitEntity>());

        builder.Property(b => b.TagId).HasConversion(new IdToGuidConverter());

        builder
            .HasIndex(b => new
            {
                b.HabitId,
                b.TagId,
                b.UserId,
            })
            .IsUnique();
    }
}

using System.Text.Json;
using Habit.Domain.Entities;
using Habit.Domain.ValueObjects.AutomationFilters;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SharedInfrastructure.Persistence;

namespace Habit.Infrastructure.Database.Configurations;

internal sealed class HabitEntityConfiguration : BaseEntityTypedConfiguration<HabitEntity>
{
    protected override void ConfigureEntity(EntityTypeBuilder<HabitEntity> builder)
    {
        builder.ToTable("habits");

        builder.Property(h => h.Name).HasMaxLength(100);
        builder.Property(h => h.Description).HasMaxLength(500);
        builder.Property(h => h.IsArchived).HasDefaultValue(false);

        builder.OwnsOne(h => h.Frequency);

        builder.OwnsOne(
            h => h.Target,
            targetBuilder =>
            {
                targetBuilder.Property(t => t.Unit).HasMaxLength(100);
            }
        );
        builder.OwnsOne(h => h.Milestone);

        builder
            .HasMany(t => t.Tags)
            .WithOne(t => t.Habit)
            .HasForeignKey(b => b.HabitId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .Property(x => x.AutomationFilter)
            .HasConversion(
                v => JsonSerializer.Serialize(v, JsonSerializerOptions.Web), // To DB
                v =>
                    JsonSerializer.Deserialize<HabitAutomationFilter?>(v, JsonSerializerOptions.Web) // From DB
            );

        builder.HasIndex(h => new { h.UserId }).HasSoftDeleteFilter();

        builder.HasIndex(h => new { h.UserId, h.Name }).HasSoftDeleteFilter();
    }
}

using DevHabit.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevHabit.Api.Database.Configurations;

public class TagConfiguration : IEntityTypeConfiguration<Tag>
{
    public void Configure(EntityTypeBuilder<Tag> builder)
    {
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id).HasMaxLength(500);
        builder.Property(t => t.Name).HasMaxLength(500);
        builder.Property(t => t.Description).HasMaxLength(500);
        builder.Property(h => h.UserId).HasMaxLength(300);

        builder.HasIndex(t => new { t.UserId, t.Name }).IsUnique();

        builder.HasOne<User>().WithMany().HasForeignKey(h => h.UserId);
    }
}

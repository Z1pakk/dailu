using Humanizer;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SharedInfrastructure.Persistence;
using Tag.Domain.Entities;

namespace Tag.Infrastructure.Database.Configurations;

internal sealed class TagConfiguration : BaseEntityTypedConfiguration<TagEntity>
{
    protected override void ConfigureEntity(EntityTypeBuilder<TagEntity> builder)
    {
        builder.ToTable("tags");

        builder.Property(t => t.Name).HasMaxLength(100);
        builder.Property(t => t.Description).HasMaxLength(2000);

        builder.HasIndex(t => new { t.UserId }).HasSoftDeleteFilter();

        builder.HasIndex(t => new { t.UserId, t.Name }).HasSoftDeleteFilter();
    }
}

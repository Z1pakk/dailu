using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pgvector;
using Search.Domain.Entities;
using SharedInfrastructure.Persistence;

namespace Search.Infrastructure.Database.Configurations;

internal sealed class SearchIndexEntryEntityConfiguration
    : BaseEntityTypedConfiguration<SearchIndexEntryEntity>
{
    protected override void ConfigureEntity(EntityTypeBuilder<SearchIndexEntryEntity> builder)
    {
        builder.ToTable("search_index");

        builder.HasIndex(x => new { x.EntityType, x.EntityId }).IsUnique();
        builder.HasIndex(x => new { x.UserId, x.EntityId });

        builder.Property(x => x.UserId).IsRequired();
        builder.Property(x => x.EntityType).IsRequired();
        builder.Property(x => x.EntityId).IsRequired();
        builder.Property(x => x.Text).IsRequired().HasMaxLength(4000);
        builder.Property(x => x.ContentHash).IsRequired().HasMaxLength(64);

        builder
            .Property(x => x.Embedding)
            .HasColumnType("vector(768)")
            .HasConversion(
                v => new Vector(v),
                v => v.ToArray(),
                new ValueComparer<float[]>(
                    (a, b) => a!.SequenceEqual(b!),
                    v => v.Aggregate(0, (h, f) => HashCode.Combine(h, f)),
                    v => v.ToArray()
                )
            );
        builder.Property(x => x.EmbeddingModel).HasMaxLength(100);

        // partial + fuzzy text matching
        builder.HasIndex(x => x.Text).HasMethod("gin").HasOperators("gin_trgm_ops");
    }
}

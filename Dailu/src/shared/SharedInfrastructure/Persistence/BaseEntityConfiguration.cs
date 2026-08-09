using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SharedKernel.Domain;
using SharedKernel.Entity;
using StrictId;
using StrictId.EFCore;
using StrictId.EFCore.ValueConverters;

namespace SharedInfrastructure.Persistence;

public abstract class BaseEntityConfiguration<TEntity> : IEntityTypeConfiguration<TEntity>
    where TEntity : class, IEntity, IAuditableEntity, ISoftDeletableEntity, IEntityVersion, IHasDomainEvents
{
    public virtual void Configure(EntityTypeBuilder<TEntity> builder)
    {
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).ValueGeneratedOnAdd();
        builder.Property(b => b.IsDeleted).HasDefaultValue(false);
        builder.Property(b => b.Version).IsConcurrencyToken();
        builder.HasIndex(b => b.CreatedAtUtc);
        builder.HasIndex(b => b.IsDeleted).HasSoftDeleteFilter();
        builder.Ignore(b => b.DomainEvents);
        ConfigureEntity(builder);
    }

    protected abstract void ConfigureEntity(EntityTypeBuilder<TEntity> builder);
}

public abstract class BaseEntityTypedConfiguration<TEntity> : IEntityTypeConfiguration<TEntity>
    where TEntity : class,
        IEntity<Id<TEntity>>,
        IAuditableEntity,
        ISoftDeletableEntity,
        IEntityVersion,
        IHasDomainEvents
{
    public virtual void Configure(EntityTypeBuilder<TEntity> builder)
    {
        builder.HasKey(b => b.Id);
        builder
            .Property(b => b.Id)
            .ValueGeneratedOnAdd()
            .HasStrictIdValueGenerator()
            .HasConversion(new IdTypedToGuidConverter<TEntity>());
        builder.Property(b => b.IsDeleted).HasDefaultValue(false);
        builder.Property(b => b.Version).IsConcurrencyToken();
        builder.HasIndex(b => b.CreatedAtUtc);
        builder.HasIndex(b => b.IsDeleted).HasSoftDeleteFilter();
        builder.Ignore(b => b.DomainEvents);
        ConfigureEntity(builder);
    }

    protected abstract void ConfigureEntity(EntityTypeBuilder<TEntity> builder);
}

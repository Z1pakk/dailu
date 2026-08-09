using Humanizer;
using Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Identity.Infrastructure.Database.Configurations;

internal sealed class RoleClaimConfiguration : IEntityTypeConfiguration<RoleClaim>
{
    public void Configure(EntityTypeBuilder<RoleClaim> builder)
    {
        builder.ToTable(nameof(RoleClaim).Pluralize(false));

        builder.Property(b => b.Version).IsConcurrencyToken().ValueGeneratedOnAddOrUpdate();
    }
}

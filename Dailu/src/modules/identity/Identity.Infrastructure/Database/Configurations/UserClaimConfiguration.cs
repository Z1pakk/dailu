using Humanizer;
using Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Identity.Infrastructure.Database.Configurations;

internal sealed class UserClaimConfiguration : IEntityTypeConfiguration<UserClaim>
{
    public void Configure(EntityTypeBuilder<UserClaim> builder)
    {
        builder.ToTable(nameof(UserClaim).Pluralize(false));

        builder.Property(b => b.Version).IsConcurrencyToken().ValueGeneratedOnAddOrUpdate();
    }
}

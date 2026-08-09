using Humanizer;
using Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Identity.Infrastructure.Database.Configurations;

internal sealed class UserLoginConfiguration : IEntityTypeConfiguration<UserLogin>
{
    public void Configure(EntityTypeBuilder<UserLogin> builder)
    {
        builder.ToTable(nameof(UserLogin).Pluralize(false));

        builder.Property(b => b.Version).IsConcurrencyToken().ValueGeneratedOnAddOrUpdate();
    }
}

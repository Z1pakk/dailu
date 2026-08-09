using Humanizer;
using Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SharedInfrastructure.Persistence;

namespace Identity.Infrastructure.Database.Configurations;

internal sealed class UserRoleConfiguration : BaseEntityConfiguration<UserRole>
{
    protected override void ConfigureEntity(EntityTypeBuilder<UserRole> builder)
    {
        builder.ToTable(nameof(UserRole).Pluralize(false));

        // ASP.NET Identity's UserManager uses FindAsync(userId, roleId) internally,
        // so the composite key must remain the primary key.
        builder.HasKey(ur => new { ur.UserId, ur.RoleId });

        // Id becomes a surrogate auto-generated alternate key.
        builder.Property(ur => ur.Id).ValueGeneratedOnAdd();
        builder.HasAlternateKey(ur => ur.Id);
        builder.HasIndex(ur => ur.Id).IsUnique();
    }
}

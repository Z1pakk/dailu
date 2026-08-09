using Humanizer;
using Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SharedInfrastructure.Persistence;

namespace Identity.Infrastructure.Database.Configurations;

public class RefreshTokenConfiguration : BaseEntityTypedConfiguration<RefreshToken>
{
    protected override void ConfigureEntity(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.Property(t => t.Token).IsRequired().HasMaxLength(512);

        builder
            .HasOne<User>(t => t.User)
            .WithMany(u => u.RefreshTokens)
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

using DevHabit.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevHabit.Api.Database.Configurations;

public class GitHubAccessTokenConfiguration : IEntityTypeConfiguration<GitHubAccessToken>
{
    public void Configure(EntityTypeBuilder<GitHubAccessToken> builder)
    {
        builder.HasKey(gt => gt.Id);

        builder.Property(gt => gt.Id).HasMaxLength(500);
        builder.Property(gt => gt.UserId).HasMaxLength(500);
        builder.Property(gt => gt.Token).HasMaxLength(1000);

        builder.HasIndex(gt => gt.UserId).IsUnique();

        builder.HasOne<User>().WithMany().HasForeignKey(gt => gt.UserId);
    }
}

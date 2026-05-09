using HabitUser.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SharedInfrastructure.Persistence;

namespace HabitUser.Infrastructure.Database.Configurations;

internal sealed class HabitUserEntityConfiguration : BaseEntityTypedConfiguration<HabitUserEntity>
{
    protected override void ConfigureEntity(EntityTypeBuilder<HabitUserEntity> builder)
    {
        builder.ToTable("habit_users");

        builder.Property(h => h.IdentityUserId).IsRequired();
    }
}

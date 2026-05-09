using Microsoft.EntityFrameworkCore;
using SharedInfrastructure.Persistence;
using SharedKernel.User;
using Tag.Application.Persistence;
using Tag.Domain.Entities;

namespace Tag.Infrastructure.Database;

public sealed class TagDbContext(
    DbContextOptions<TagDbContext> options,
    ICurrentUserService? currentUserService = null,
    TimeProvider? timeProvider = null
) : AppDbContextBase(options, currentUserService, timeProvider), ITagDbContext
{
    public string Schema => TagSchema.NAME;

    public DbSet<TagEntity> Tags => Set<TagEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.ApplyConfigurationsFromAssembly(AssemblyReference.Assembly);

        base.OnModelCreating(modelBuilder);
    }
}

using Microsoft.EntityFrameworkCore;
using Search.Application.Persistence;
using SharedInfrastructure.Persistence;
using SharedKernel.User;

namespace Search.Infrastructure.Database;

public sealed class SearchDbContext(
    DbContextOptions<SearchDbContext> options,
    ICurrentUserService? currentUserService = null,
    TimeProvider? timeProvider = null
) : AppDbContextBase(options, currentUserService, timeProvider), ISearchDbContext
{
    public string Schema => SearchSchema.NAME;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.HasPostgresExtension("vector");

        modelBuilder.ApplyConfigurationsFromAssembly(AssemblyReference.Assembly);

        base.OnModelCreating(modelBuilder);
    }
}

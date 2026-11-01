using Microsoft.EntityFrameworkCore;
using Search.Application.Persistence;
using Search.Domain.Entities;
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

    public DbSet<SearchIndexEntryEntity> SearchIndexEntries { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        // migration runs CREATE EXTENSION IF NOT EXISTS vector
        modelBuilder.HasPostgresExtension("vector");
        // CREATE EXTENSION IF NOT EXISTS pg_trgm
        modelBuilder.HasPostgresExtension("pg_trgm");

        modelBuilder.ApplyConfigurationsFromAssembly(AssemblyReference.Assembly);

        base.OnModelCreating(modelBuilder);
    }
}

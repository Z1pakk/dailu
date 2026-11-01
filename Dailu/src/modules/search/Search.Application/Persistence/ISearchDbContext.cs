using Microsoft.EntityFrameworkCore;
using Search.Domain.Entities;
using SharedKernel.Persistence;

namespace Search.Application.Persistence;

public interface ISearchDbContext : IAppDbContextBase
{
    DbSet<SearchIndexEntryEntity> SearchIndexEntries { get; set; }
}

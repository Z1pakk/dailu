using Microsoft.EntityFrameworkCore;
using SharedKernel.Persistence;
using Tag.Domain.Entities;

namespace Tag.Application.Persistence;

public interface ITagDbContext : IAppDbContextBase
{
    DbSet<TagEntity> Tags { get; }
}

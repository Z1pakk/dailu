using HabitUser.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Persistence;

namespace HabitUser.Application.Persistence;

public interface IHabitUserDbContext : IAppDbContextBase
{
    DbSet<HabitUserEntity> HabitUsers { get; }
    DbSet<IntegrationConfigEntity> IntegrationConfigs { get; }
}

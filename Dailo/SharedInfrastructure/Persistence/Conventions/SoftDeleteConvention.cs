using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Metadata.Conventions;
using SharedKernel.Entity;

namespace SharedInfrastructure.Persistence.Conventions;

public sealed class SoftDeleteConvention : IModelFinalizingConvention
{
    public void ProcessModelFinalizing(
        IConventionModelBuilder modelBuilder,
        IConventionContext<IConventionModelBuilder> context
    )
    {
        foreach (var entity in modelBuilder.Metadata.GetEntityTypes())
        {
            if (!typeof(ISoftDeletableEntity).IsAssignableFrom(entity.ClrType))
            {
                continue;
            }

            var parameter = Expression.Parameter(entity.ClrType, "entity");
            var property = Expression.Property(parameter, nameof(ISoftDeletableEntity.IsDeleted));
            var filter = Expression.Lambda(
                Expression.Equal(property, Expression.Constant(false)),
                parameter
            );

            entity.SetQueryFilter(filter);
        }
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Metadata.Conventions;

namespace SharedInfrastructure.Persistence.Conventions;

public sealed class DefaultStringLengthConvention(int defaultStringLength = 256)
    : IModelFinalizingConvention
{
    public void ProcessModelFinalizing(
        IConventionModelBuilder modelBuilder,
        IConventionContext<IConventionModelBuilder> context
    )
    {
        foreach (var entity in modelBuilder.Metadata.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                if (property.ClrType != typeof(string))
                {
                    continue;
                }

                if (property.GetMaxLength() != null)
                {
                    continue;
                }

                if (property.GetColumnType() != null)
                {
                    continue;
                }

                property.SetMaxLength(defaultStringLength);
            }
        }
    }
}

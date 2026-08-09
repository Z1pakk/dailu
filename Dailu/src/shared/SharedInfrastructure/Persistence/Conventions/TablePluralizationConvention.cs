using Humanizer;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Metadata.Conventions;

namespace SharedInfrastructure.Persistence.Conventions;

public sealed class TablePluralizationConvention : IModelFinalizingConvention
{
    public void ProcessModelFinalizing(
        IConventionModelBuilder modelBuilder,
        IConventionContext<IConventionModelBuilder> context
    )
    {
        foreach (var entityType in modelBuilder.Metadata.GetEntityTypes())
        {
            if (
                entityType.GetTableName() != null
                || entityType.GetTableNameConfigurationSource() == ConfigurationSource.Explicit
                || entityType.GetTableNameConfigurationSource() == ConfigurationSource.DataAnnotation
            )
            {
                continue;
            }

            var entityName = entityType.ClrType.Name;
            var pluralizedName = entityName.Pluralize(inputIsKnownToBeSingular: false);
            entityType.SetTableName(pluralizedName);
        }
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace SharedInfrastructure.Persistence;

public static class IndexExtensions
{
    private const string PostgreSqlProvider = "Npgsql.EntityFrameworkCore.PostgreSQL";
    private const string SqlServerProvider = "Microsoft.EntityFrameworkCore.SqlServer";

    public static IndexBuilder<TEntity> HasSoftDeleteFilter<TEntity>(
        this IndexBuilder<TEntity> indexBuilder
    )
    {
        var providerName = GetDatabaseProvider(indexBuilder);

        var filter = providerName switch
        {
            PostgreSqlProvider => "\"is_deleted\" = false",
            SqlServerProvider => "[IsDeleted] = 0",
            _ => "\"is_deleted\" = false",
        };

        return indexBuilder.HasFilter(filter);
    }

    private static string? GetDatabaseProvider<TEntity>(IndexBuilder<TEntity> indexBuilder)
    {
        var model = indexBuilder.Metadata.DeclaringEntityType.Model;

        var providerAnnotation = model
            .GetAnnotations()
            .FirstOrDefault(a => a.Name.Contains("Npgsql") || a.Name.Contains("SqlServer"));

        if (providerAnnotation != null && providerAnnotation.Name.Contains("Npgsql"))
        {
            return PostgreSqlProvider;
        }

        if (providerAnnotation != null && providerAnnotation.Name.Contains("SqlServer"))
        {
            return SqlServerProvider;
        }

        var tableName = indexBuilder.Metadata.DeclaringEntityType.GetTableName();
        if (!string.IsNullOrEmpty(tableName) && tableName.Contains('_'))
        {
            return PostgreSqlProvider;
        }

        return null;
    }
}

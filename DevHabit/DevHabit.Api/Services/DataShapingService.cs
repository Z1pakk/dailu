using System.Collections.Concurrent;
using System.Dynamic;
using System.Reflection;

namespace DevHabit.Api.Services;

public sealed class DataShapingService
{
    private static readonly ConcurrentDictionary<Type, PropertyInfo[]> PropertyCache = new();

    public ExpandoObject ShapeData<T>(T entity, string? fields)
    {
        HashSet<string> fieldSet =
            fields
                ?.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(f => f.Trim())
                .ToHashSet(StringComparer.OrdinalIgnoreCase) ?? [];

        IEnumerable<PropertyInfo> propertyInfos = PropertyCache.GetOrAdd(
            typeof(T),
            t => t.GetProperties(BindingFlags.Public | BindingFlags.Instance)
        );

        if (fieldSet.Any())
        {
            propertyInfos = propertyInfos.Where(p => fieldSet.Contains(p.Name)).ToArray();
        }

        return GetShapedObject(entity, propertyInfos);
    }

    public List<ExpandoObject> ShapeCollectionData<T>(IEnumerable<T> entities, string? fields)
    {
        HashSet<string> fieldSet =
            fields
                ?.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(f => f.Trim())
                .ToHashSet(StringComparer.OrdinalIgnoreCase) ?? [];

        IEnumerable<PropertyInfo> propertyInfos = PropertyCache.GetOrAdd(
            typeof(T),
            t => t.GetProperties(BindingFlags.Public | BindingFlags.Instance)
        );

        if (fieldSet.Any())
        {
            propertyInfos = propertyInfos.Where(p => fieldSet.Contains(p.Name)).ToArray();
        }

        return entities.Select(entity => GetShapedObject(entity, propertyInfos)).ToList();
    }

    private ExpandoObject GetShapedObject<T>(T entity, IEnumerable<PropertyInfo> properties)
    {
        IDictionary<string, object?> shapedObject = new ExpandoObject();

        foreach (PropertyInfo propertyInfo in properties)
        {
            shapedObject[propertyInfo.Name] = propertyInfo.GetValue(entity);
        }

        return (ExpandoObject)shapedObject;
    }

    public bool Validate<T>(string? fields)
    {
        if (string.IsNullOrEmpty(fields))
        {
            return true; // No fields specified, so no validation needed
        }

        var fieldSet = fields
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(f => f.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        IEnumerable<PropertyInfo> propertyInfos = PropertyCache.GetOrAdd(
            typeof(T),
            t => t.GetProperties(BindingFlags.Public | BindingFlags.Instance)
        );

        return fieldSet.All(field =>
            propertyInfos.Any(propertyInfo =>
                string.Equals(propertyInfo.Name, field, StringComparison.OrdinalIgnoreCase)
            )
        );
    }
}

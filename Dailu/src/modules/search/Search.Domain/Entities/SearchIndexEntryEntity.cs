using Search.Domain.Enums;
using StrictId;

namespace Search.Domain.Entities;

public class SearchIndexEntryEntity : BaseEntity<Id<SearchIndexEntryEntity>>
{
    /// <summary>
    /// Id that search index is associated with
    /// </summary>
    public required Guid UserId { get; set; }

    /// <summary>
    /// Type of entity for which search index is applied to
    /// </summary>
    public required SearchEntityType EntityType { get; set; }

    /// <summary>
    /// Specific entity id which search index is applied to
    /// habit id, tag id, or habit entry id
    /// </summary>
    public required Id EntityId { get; set; }

    /// <summary>
    /// Text that exactly what was embedded (before the prefix); also the trigram-matched column
    /// </summary>
    public required string Text { get; set; }

    /// <summary>
    /// Hash of the text to skip re-embedding unchanged text
    /// </summary>
    public required string ContentHash { get; set; }

    /// <summary>
    /// Associated habit id for habit, habit entry types
    /// </summary>
    public Id? HabitId { get; set; }

    /// <summary>
    /// The entry's date, for date filters
    /// </summary>
    public DateTime? OccurredAtUtc { get; set; }

    /// <summary>
    /// The vector value of dense vector (semantic search)
    /// Stores floats with dimensions long
    /// </summary>
    public required float[] Embedding { get; set; }

    /// <summary>
    /// The embedding model used to generate the embedding
    /// e.g. "nomic-embed-text"
    /// </summary>
    public required string EmbeddingModel { get; set; }
}

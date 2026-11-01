using Search.Domain.Enums;
using StrictId;

namespace Search.Application.Features.Indexing;

public sealed record SearchIndexModel(
    Guid UserId,
    SearchEntityType EntityType,
    Id EntityId,
    Id? HabitId,
    string? Text,
    DateTime? OccurredAtUtc,
    bool IsArchived = false
);

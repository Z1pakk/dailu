using HabitUser.Domain.Entities;

namespace HabitUser.Application.Features.Integration.Models;

public sealed record IntegrationSyncLogModel(
    DateTime StartedAtUtc,
    DateTime FinishedAtUtc,
    IntegrationSyncStatus Status,
    int ActivitiesCount,
    string? ErrorMessage
);

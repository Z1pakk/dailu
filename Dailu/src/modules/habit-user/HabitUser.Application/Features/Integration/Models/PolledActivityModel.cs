using Dailu.Events;
using Dailu.Events.IntegrationEvents;

namespace HabitUser.Application.Features.Integration.Models;

public record PolledActivityModel
{
    public required string Id { get; set; }

    public required Guid UserId { get; set; }

    public required IntegrationActivitySource ActivitySource { get; set; }

    public DateTime CreatedAtUtc { get; set; }
}

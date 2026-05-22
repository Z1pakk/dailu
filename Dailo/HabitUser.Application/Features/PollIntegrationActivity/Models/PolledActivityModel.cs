using Dailo.Events;

namespace HabitUser.Application.Features.PollIntegrationActivity.Models;

public record PolledActivityModel
{
    public required string Id { get; set; }

    public required Guid UserId { get; set; }

    public required IntegrationActivitySource ActivitySource { get; set; }

    public DateTime CreatedAtUtc { get; set; }
}

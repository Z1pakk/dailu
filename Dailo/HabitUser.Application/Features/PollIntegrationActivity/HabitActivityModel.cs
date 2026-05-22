namespace HabitUser.Application.Features.PollIntegrationActivity;

public record HabitActivityModel
{
    public string Id { get; set; }

    public required DateTime CreatedAt { get; init; }
}

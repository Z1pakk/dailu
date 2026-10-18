using Dailu.Events;
using HabitUser.Application.Persistence;
using HabitUser.Domain.Aggregates;
using SharedKernel.Event;

namespace HabitUser.Application.EventHandlers.IdentityUserCreated;

public sealed class IdentityUserCreatedIntegrationEventHandler(IHabitUserDbContext dbContext)
    : IEventHandler<IdentityUserCreatedIntegrationEvent>
{
    public async ValueTask Handle(
        IdentityUserCreatedIntegrationEvent notification,
        CancellationToken cancellationToken
    )
    {
        var habitUser = HabitUserAggregate.Create(notification.IdentityUserId);

        dbContext.HabitUsers.Add(habitUser.ToEntity());

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}

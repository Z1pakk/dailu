using Habit.Api.Endpoints.CreateHabit;
using Habit.Api.Endpoints.GetHabits;
using Habit.Api.Endpoints.UpdateHabit;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Endpoint;

namespace Habit.Api;

public sealed class HabitGroup : IEndpointGroup
{
    public void MapGroupEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/habits").WithTags("Habits");

        group.MapCreateHabitEndpoint();
        group.MapGetHabitsEndpoint();
        group.MapUpdateHabitEndpoint();
    }
}

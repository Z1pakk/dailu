using Habit.Api.Endpoints.CreateHabit;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Endpoint;

namespace Habit.Api;

public sealed class HabitGroup : IEndpointGroup
{
    public void MapGroupEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/habits");

        group.MapCreateHabitEndpoint();
    }
}

using Habit.Api.Endpoints.GetHabitEntries;
using HabitEntry.Api.Endpoints.CreateHabitEntry;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Endpoint;

namespace HabitEntry.Api;

public sealed class HabitEntryGroup : IEndpointGroup
{
    public void MapGroupEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/habit-entries").WithTags("HabitEntries");

        group.MapCreateHabitEntryEndpoint();
        group.MapGetHabitEntriesEndpoint();
    }
}

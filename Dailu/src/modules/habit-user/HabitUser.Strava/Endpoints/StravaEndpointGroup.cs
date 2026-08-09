using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Endpoint;

namespace HabitUser.Strava.Endpoints;

public sealed class StravaEndpointGroup : IEndpointGroup
{
    public void MapGroupEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/habit-user").WithTags("HabitUser");
        group.MapStravaConnectEndpoint();
        group.MapStravaCallbackEndpoint();
    }
}

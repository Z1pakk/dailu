using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Endpoint;

namespace HabitUser.GoogleHealth.Endpoints;

public sealed class GoogleHealthEndpointGroup : IEndpointGroup
{
    public void MapGroupEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/habit-user").WithTags("HabitUser");
        group.MapGoogleHealthConnectEndpoint();
        group.MapGoogleHealthCallbackEndpoint();
        group.MapGetGoogleHealthProfileEndpoint();
    }
}

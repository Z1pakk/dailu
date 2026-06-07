using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Endpoint;

namespace HabitUser.Github.Endpoints;

public sealed class GithubEndpointGroup : IEndpointGroup
{
    public void MapGroupEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/habit-user").WithTags("HabitUser");
        group.MapGithubConnectEndpoint();
        group.MapGithubCallbackEndpoint();
        group.MapGetGithubProfileEndpoint();
    }
}

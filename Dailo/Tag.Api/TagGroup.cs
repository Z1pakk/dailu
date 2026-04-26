using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Endpoint;
using Tag.Api.Endpoints;

namespace Tag.Api;

public class TagGroup : IEndpointGroup
{
    public void MapGroupEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/tags");

        group.MapCreateTagEndpoint();
        group.MapGetTagsEndpoint();
    }
}

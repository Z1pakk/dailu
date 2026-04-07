using Identity.Api.Endpoints.LoginUser;
using Identity.Api.Endpoints.RegisterUser;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Endpoint;

namespace Identity.Api.Endpoints;

public sealed class AuthGroup : IEndpointGroup
{
    public void MapGroupEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/auth");

        group.MapLoginEndpoint();
        group.MapRegisterEndpoint();
    }
}

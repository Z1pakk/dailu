using Identity.Api.Endpoints.Altcha;
using Identity.Api.Endpoints.LoginUser;
using Identity.Api.Endpoints.Logout;
using Identity.Api.Endpoints.Refresh;
using Identity.Api.Endpoints.RegisterUser;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Endpoint;

namespace Identity.Api.Endpoints;

public sealed class AuthGroup : IEndpointGroup
{
    public void MapGroupEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/auth").WithTags("Identity");

        group.MapLoginEndpoint();
        group.MapRegisterEndpoint();
        group.MapRefreshEndpoint();
        group.MapLogoutEndpoint();
        group.MapAltchaChallengeEndpoint();
    }
}

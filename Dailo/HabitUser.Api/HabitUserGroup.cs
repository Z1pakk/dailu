using HabitUser.Api.Endpoints.DeleteIntegrationConfig;
using HabitUser.Api.Endpoints.GetIntegrationConfigs;
using HabitUser.Api.Endpoints.GetUserProfile;
using HabitUser.Api.Endpoints.SaveIntegrationConfig;
using HabitUser.Api.Endpoints.UpdateUserProfile;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Endpoint;

namespace HabitUser.Api;

public sealed class HabitUserGroup : IEndpointGroup
{
    public void MapGroupEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/habit-user").WithTags("HabitUser");

        group.MapGetUserProfileEndpoint();
        group.MapUpdateUserProfileEndpoint();
        group.MapGetIntegrationConfigsEndpoint();
        group.MapSaveIntegrationConfigEndpoint();
        group.MapDeleteIntegrationConfigEndpoint();
    }
}

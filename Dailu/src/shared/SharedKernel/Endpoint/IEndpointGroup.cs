using Microsoft.AspNetCore.Routing;

namespace SharedKernel.Endpoint;

public interface IEndpointGroup
{
    void MapGroupEndpoint(IEndpointRouteBuilder app);
}

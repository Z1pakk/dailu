namespace SharedKernel.Endpoint;

public interface IEndpointWithoutRequest<TResponse>
{
    Task<TResponse> HandleAsync(CancellationToken cancellationToken = default);
}

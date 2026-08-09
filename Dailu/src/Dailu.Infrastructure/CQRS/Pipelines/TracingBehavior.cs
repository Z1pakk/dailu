using System.Diagnostics;
using Mediator;
using SharedKernel.User;

namespace Dailu.Infrastructure.CQRS.Pipelines;

internal static class CqrsDiagnostics
{
    internal const string SourceName = "Dailu.Cqrs";

    internal static readonly ActivitySource Source = new(SourceName);
}

public sealed class TracingBehavior<TMessage, TResponse>(ICurrentUserService currentUserService)
    : IPipelineBehavior<TMessage, TResponse>
    where TMessage : notnull, IMessage
    where TResponse : notnull
{
    public async ValueTask<TResponse> Handle(
        TMessage message,
        MessageHandlerDelegate<TMessage, TResponse> next,
        CancellationToken cancellationToken
    )
    {
        using var activity = CqrsDiagnostics.Source.StartActivity(
            typeof(TMessage).Name,
            ActivityKind.Internal
        );

        activity?.SetTag("cqrs.message_type", typeof(TMessage).FullName);
        activity?.SetTag("cqrs.user_id", currentUserService.UserId);

        try
        {
            return await next(message, cancellationToken);
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }
    }
}

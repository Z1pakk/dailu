using System.Diagnostics;
using Mediator;
using Microsoft.Extensions.Logging;

namespace Dailo.Infrastructure.CQRS.Pipelines;

public partial class LoggingBehavior<TMessage, TResponse>(
    ILogger<LoggingBehavior<TMessage, TResponse>> logger
) : IPipelineBehavior<TMessage, TResponse>
    where TMessage : notnull, IMessage
    where TResponse : notnull
{
    public async ValueTask<TResponse> Handle(
        TMessage message,
        MessageHandlerDelegate<TMessage, TResponse> next,
        CancellationToken cancellationToken
    )
    {
        const string prefix = nameof(LoggingBehavior<,>);

        LogHandling(logger, prefix, typeof(TMessage).Name, typeof(TResponse).Name);

        var timer = new Stopwatch();
        timer.Start();

        var response = await next(message, cancellationToken);

        timer.Stop();
        var timeTaken = timer.Elapsed;
        if (timeTaken.Seconds > 3)
        {
            LogSlowRequest(logger, prefix, typeof(TMessage).Name, timeTaken.Seconds);
        }

        LogHandled(logger, prefix, typeof(TMessage).Name);
        return response;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "[{Prefix}] Handle request={Request} and response={Response}")]
    private static partial void LogHandling(ILogger logger, string prefix, string request, string response);

    [LoggerMessage(Level = LogLevel.Warning, Message = "[{Prefix}] The request {Request} took {TimeTaken} seconds.")]
    private static partial void LogSlowRequest(ILogger logger, string prefix, string request, int timeTaken);

    [LoggerMessage(Level = LogLevel.Information, Message = "[{Prefix}] Handled {Request}")]
    private static partial void LogHandled(ILogger logger, string prefix, string request);
}

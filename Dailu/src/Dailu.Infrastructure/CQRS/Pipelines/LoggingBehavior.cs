using System.Diagnostics;
using Mediator;
using Microsoft.Extensions.Logging;
using SharedKernel.ResultPattern;

namespace Dailu.Infrastructure.CQRS.Pipelines;

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

        if (response is IResultBase { IsFailure: true } failure)
        {
            // Client errors (not found, bad request, ...) are expected; only unexpected failures are errors.
            if (failure.Type == ResultType.Failure)
            {
                LogFailedResult(logger, prefix, typeof(TMessage).Name, failure.Type, failure.Error);
            }
            else
            {
                LogUnsuccessfulResult(logger, prefix, typeof(TMessage).Name, failure.Type, failure.Error);
            }
        }

        LogHandled(logger, prefix, typeof(TMessage).Name);
        return response;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "[{Prefix}] Handle request={Request} and response={Response}")]
    private static partial void LogHandling(ILogger logger, string prefix, string request, string response);

    [LoggerMessage(Level = LogLevel.Warning, Message = "[{Prefix}] The request {Request} took {TimeTaken} seconds.")]
    private static partial void LogSlowRequest(ILogger logger, string prefix, string request, int timeTaken);

    [LoggerMessage(Level = LogLevel.Error, Message = "[{Prefix}] The request {Request} failed with {ResultType}: {Error}")]
    private static partial void LogFailedResult(ILogger logger, string prefix, string request, ResultType resultType, string error);

    [LoggerMessage(Level = LogLevel.Warning, Message = "[{Prefix}] The request {Request} returned {ResultType}: {Error}")]
    private static partial void LogUnsuccessfulResult(ILogger logger, string prefix, string request, ResultType resultType, string error);

    [LoggerMessage(Level = LogLevel.Information, Message = "[{Prefix}] Handled {Request}")]
    private static partial void LogHandled(ILogger logger, string prefix, string request);
}

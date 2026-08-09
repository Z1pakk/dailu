using System.Diagnostics.CodeAnalysis;
using Microsoft.AspNetCore.Http;

namespace SharedKernel.ResultPattern;

public class Result<T>
{
    [MemberNotNullWhen(true, nameof(Value))]
    public bool IsSuccess { get; }

    [MemberNotNullWhen(false, nameof(Value))]
    public bool IsFailure => !IsSuccess;
    public T? Value { get; }

    [AllowNull]
    public string Error
    {
        get => field ?? "An error occurred.";
    } = null;

    public ResultType Type { get; }

    protected Result(bool isSuccess, T? value, string? error, ResultType type)
    {
        IsSuccess = isSuccess;
        Value = value;
        Error = error;
        Type = type;
    }

    public static Result<T> Success(T value) => new(true, value, null, ResultType.Success);

    public static Result<T> NoContent() => new(true, default, null, ResultType.NoContent);

    public static Result<T> NotFound(string? error = null) =>
        new(false, default, error, ResultType.NotFound);

    public static Result<T> BadRequest(string error) =>
        new(false, default, error, ResultType.BadRequest);

    public static Result<T> Unauthorized(string? error = null) =>
        new(false, default, error, ResultType.Unauthorized);

    public static Result<T> Forbidden(string? error = null) =>
        new(false, default, error, ResultType.Forbidden);

    public static Result<T> Failure(string error) => new(false, default, error, ResultType.Failure);

    public Result<TTarget> ToTargetResult<TTarget>() =>
        Type switch
        {
            ResultType.NotFound => Result<TTarget>.NotFound(Error),
            ResultType.BadRequest => Result<TTarget>.BadRequest(Error),
            ResultType.Unauthorized => Result<TTarget>.Unauthorized(Error),
            ResultType.Forbidden => Result<TTarget>.Forbidden(Error),
            _ => Result<TTarget>.Failure(Error),
        };

    public Result ToPlainResult() =>
        Type switch
        {
            ResultType.NotFound => Result.NotFound(Error),
            ResultType.BadRequest => Result.BadRequest(Error),
            ResultType.Unauthorized => Result.Unauthorized(Error),
            ResultType.Forbidden => Result.Forbidden(Error),
            _ => Result.Failure(Error),
        };

    public IResult ToTypedHttpResult()
    {
        return Type switch
        {
            ResultType.Success => Value is null
            || EqualityComparer<T>.Default.Equals(Value, default!)
                ? TypedResults.NoContent()
                : TypedResults.Ok(Value),
            ResultType.NoContent => TypedResults.NoContent(),
            ResultType.NotFound => TypedResults.NotFound(Error),
            ResultType.BadRequest => TypedResults.BadRequest(Error),
            ResultType.Unauthorized => TypedResults.Unauthorized(),
            ResultType.Forbidden => TypedResults.Forbid(),
            _ => TypedResults.Problem(Error),
        };
    }
}

using System.Diagnostics.CodeAnalysis;
using Microsoft.AspNetCore.Http;

namespace SharedKernel.ResultPattern;

public class Result
{
    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;

    [AllowNull]
    public string Error
    {
        get => field ?? "An error occurred.";
    } = null;

    public ResultType Type { get; }

    protected Result(bool isSuccess, string? error, ResultType type)
    {
        IsSuccess = isSuccess;
        Error = error;
        Type = type;
    }

    public static Result Success() => new(true, null, ResultType.Success);

    public static Result NotFound(string? error = null) => new(false, error, ResultType.NotFound);

    public static Result BadRequest(string error) => new(false, error, ResultType.BadRequest);

    public static Result Unauthorized(string? error = null) =>
        new(false, error, ResultType.Unauthorized);

    public static Result Forbidden(string? error = null) => new(false, error, ResultType.Forbidden);

    public static Result Failure(string error) => new(false, error, ResultType.Failure);

    public IResult ToTypedHttpResult()
    {
        return Type switch
        {
            ResultType.Success => TypedResults.NoContent(),
            ResultType.NoContent => TypedResults.NoContent(),
            ResultType.NotFound => TypedResults.NotFound(Error),
            ResultType.BadRequest => TypedResults.BadRequest(Error),
            ResultType.Unauthorized => TypedResults.Unauthorized(),
            ResultType.Forbidden => TypedResults.Forbid(),
            _ => TypedResults.Problem(Error),
        };
    }
}

namespace SharedKernel.ResultPattern;

/// <summary>Outcome shared by <see cref="Result"/> and <see cref="Result{T}"/>, for code that inspects either.</summary>
public interface IResultBase
{
    bool IsSuccess { get; }
    bool IsFailure { get; }
    string Error { get; }
    ResultType Type { get; }
}

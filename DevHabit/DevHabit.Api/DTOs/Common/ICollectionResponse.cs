namespace DevHabit.Api.DTOs.Common;

public interface ICollectionResponse<T>
{
    IEnumerable<T> Items { get; init; }
}

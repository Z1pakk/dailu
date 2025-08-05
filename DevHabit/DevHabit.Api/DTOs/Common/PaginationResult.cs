using Microsoft.EntityFrameworkCore;

namespace DevHabit.Api.DTOs.Common;

public sealed record PaginationResult<T> : ICollectionResponse<T>
{
    public required IEnumerable<T> Items { get; init; }

    public int Page { get; init; }

    public int PageSize { get; init; }

    public int TotalCount { get; init; }

    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);

    public bool HasPreviousPage => Page > 1;

    public bool HasNextPage => Page < TotalPages;

    public static async Task<PaginationResult<T>> CreateAsync(
        IQueryable<T> source,
        int page = 1,
        int pageSize = 10,
        CancellationToken cancellationToken = default
    )
    {
        int totalCount = await source.CountAsync(cancellationToken);
        List<T> items = await source
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PaginationResult<T>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
        };
    }
}

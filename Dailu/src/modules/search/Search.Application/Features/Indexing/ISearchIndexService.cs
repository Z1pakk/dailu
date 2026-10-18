using SharedKernel.ResultPattern;

namespace Search.Application.Features.Indexing;

public interface ISearchIndexService
{
    Task<Result> AddAsync(SearchIndexModel model, CancellationToken ct);
}

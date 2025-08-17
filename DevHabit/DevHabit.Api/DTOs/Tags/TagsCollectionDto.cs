using DevHabit.Api.DTOs.Common;

namespace DevHabit.Api.DTOs.Tags;

public class TagsCollectionDto : ICollectionResponse<TagDto>, ILinksResponse
{
    public IEnumerable<TagDto> Items { get; init; }

    public IEnumerable<LinkDto> Links { get; set; }
}

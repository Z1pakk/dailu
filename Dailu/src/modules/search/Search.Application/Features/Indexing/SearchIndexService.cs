using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Search.Application.Ai;
using Search.Application.Persistence;
using Search.Domain.Entities;
using SharedKernel.ResultPattern;
using StrictId;

namespace Search.Application.Features.Indexing;

public class SearchIndexService(
    ISearchDbContext dbContext,
    IEmbeddingGenerator<string, Embedding<float>> embeddingGenerator,
    IEmbeddingTextFormatter textFormatter,
    IAiModelOptions aiModelOptions
) : ISearchIndexService
{
    public async Task<Result> AddAsync(SearchIndexModel model, CancellationToken ct)
    {
        var existingIndex = await dbContext.SearchIndexEntries.FirstOrDefaultAsync(
            x => x.EntityType == model.EntityType && x.EntityId == model.EntityId,
            ct
        );

        // trim, collapse whitespace, cap length
        var normalizedText = SearchTextHelper.Normalize(model.Text, SearchTextHelper.MaxLength);

        if (normalizedText is null || model.IsArchived)
        {
            // remove existing index if it exists and input conditions are empty
            if (existingIndex is not null)
            {
                dbContext.SearchIndexEntries.Remove(existingIndex);
                await dbContext.SaveChangesAsync(ct);
            }

            // nothing to index is a normal outcome, not a failure
            return Result.Success();
        }

        var hashedText = SearchTextHelper.Hash(normalizedText);

        if (
            existingIndex is not null
            && existingIndex.ContentHash == hashedText
            && existingIndex.EmbeddingModel == aiModelOptions.EmbeddingModel
        )
        {
            // same text, same model — the stored vector is still right; only refresh metadata
            existingIndex.HabitId = model.HabitId;
            existingIndex.OccurredAtUtc = model.OccurredAtUtc;
            await dbContext.SaveChangesAsync(ct);

            return Result.Success();
        }

        var embedding = await embeddingGenerator.GenerateAsync(
            textFormatter.ForDocument(normalizedText),
            cancellationToken: ct
        );
        if (embedding.Dimensions != aiModelOptions.EmbeddingDimensions)
        {
            return Result.Failure(
                $"Embedding model returned {embedding.Dimensions} dimensions, expected {aiModelOptions.EmbeddingDimensions}."
            );
        }

        if (existingIndex is null)
        {
            existingIndex = new SearchIndexEntryEntity
            {
                Id = Id<SearchIndexEntryEntity>.NewId(),
                UserId = model.UserId,
                EntityType = model.EntityType,
                EntityId = model.EntityId,
                HabitId = model.HabitId,
                OccurredAtUtc = model.OccurredAtUtc,
                Text = normalizedText,
                ContentHash = hashedText,
                Embedding = embedding.Vector.ToArray(),
                EmbeddingModel = aiModelOptions.EmbeddingModel,
            };

            dbContext.SearchIndexEntries.Add(existingIndex);
        }
        else
        {
            existingIndex.HabitId = model.HabitId;
            existingIndex.OccurredAtUtc = model.OccurredAtUtc;
            existingIndex.Text = normalizedText;
            existingIndex.ContentHash = hashedText;
            existingIndex.Embedding = embedding.Vector.ToArray();
            existingIndex.EmbeddingModel = aiModelOptions.EmbeddingModel;
        }

        await dbContext.SaveChangesAsync(ct);

        return Result.Success();
    }
}

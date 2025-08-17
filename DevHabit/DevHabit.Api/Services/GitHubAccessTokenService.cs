using DevHabit.Api.Database;
using DevHabit.Api.DTOs.GitHub;
using DevHabit.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevHabit.Api.Services;

public sealed class GitHubAccessTokenService(ApplicationDbContext dbContext)
{
    public async Task StoreAsync(
        string userId,
        StoreGitHubAccessTokenDto accessTokenDto,
        CancellationToken cancellationToken = default
    )
    {
        GitHubAccessToken? existingToken = await GetAccessTokenAsync(userId, cancellationToken);

        if (existingToken is not null)
        {
            existingToken.Token = accessTokenDto.Token;
            existingToken.ExpiresAtUtc = DateTime.UtcNow.AddDays(accessTokenDto.ExpiresInDays);
            dbContext.Update(existingToken);
        }
        else
        {
            GitHubAccessToken newToken = new()
            {
                Id = $"gh_{Guid.NewGuid().ToString()}",
                UserId = userId,
                Token = accessTokenDto.Token,
                ExpiresAtUtc = DateTime.UtcNow.AddDays(accessTokenDto.ExpiresInDays),
                CreatedAtUtc = DateTime.UtcNow,
            };
            dbContext.GitHubAccessTokens.Add(newToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<string?> GetAsync(
        string userId,
        CancellationToken cancellationToken = default
    )
    {
        GitHubAccessToken? accessToken = await GetAccessTokenAsync(userId, cancellationToken);

        return accessToken?.Token;
    }

    public async Task RevokeAsync(string userId, CancellationToken cancellationToken = default)
    {
        GitHubAccessToken? accessToken = await GetAccessTokenAsync(userId, cancellationToken);
        if (accessToken is null)
        {
            return;
        }

        dbContext.GitHubAccessTokens.Remove(accessToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<GitHubAccessToken?> GetAccessTokenAsync(
        string userId,
        CancellationToken cancellationToken = default
    )
    {
        return await dbContext
            .GitHubAccessTokens.AsNoTracking()
            .SingleOrDefaultAsync(gt => gt.UserId == userId, cancellationToken);
    }
}

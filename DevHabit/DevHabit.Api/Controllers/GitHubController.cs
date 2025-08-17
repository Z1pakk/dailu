using DevHabit.Api.DTOs.Common;
using DevHabit.Api.DTOs.GitHub;
using DevHabit.Api.Entities;
using DevHabit.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevHabit.Api.Controllers;

[Authorize(Roles = Roles.Member)]
[ApiController]
[Route("github")]
public sealed class GitHubController(
    GitHubAccessTokenService gitHubAccessTokenService,
    GitHubService gitHubService,
    UserContext userContext,
    LinkService linkService
) : ControllerBase
{
    [HttpPut("access-token")]
    public async Task<IActionResult> StoreAccessToken(
        [FromBody] StoreGitHubAccessTokenDto accessTokenDto
    )
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        await gitHubAccessTokenService.StoreAsync(userId, accessTokenDto);
        return NoContent();
    }

    [HttpDelete("revoke-token")]
    public async Task<IActionResult> RevokeAccessToken()
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        await gitHubAccessTokenService.RevokeAsync(userId);
        return NoContent();
    }

    [HttpGet("profile")]
    public async Task<ActionResult<GitHubUserProfileDto>> GetUserProfile(
        [FromHeader] AcceptHeaderDto acceptHeaderDto
    )
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        string? accessToken = await gitHubAccessTokenService.GetAsync(userId);
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Unauthorized();
        }

        GitHubUserProfileDto? profile = await gitHubService.GetUserProfileAsync(accessToken);
        if (profile is null)
        {
            return NotFound("GitHub profile not found.");
        }

        if (acceptHeaderDto.IsLinksIncluded)
        {
            profile.Links =
            [
                linkService.Create(nameof(GetUserProfile), "self", "GET"),
                linkService.Create(nameof(StoreAccessToken), "store-token", "PUT"),
                linkService.Create(nameof(RevokeAccessToken), "revoke-token", "DELETE"),
            ];
        }

        return Ok(profile);
    }
}

using Identity.Application.Models;
using Identity.Application.Persistence;
using Identity.Application.Services;
using Identity.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;

namespace Identity.Application.Features.Refresh;

public sealed record RefreshCommand(string RefreshToken)
    : ICommand<Result<RefreshCommandResponse>> { }

public sealed record RefreshCommandResponse(AccessTokenModel AccessTokens);

public class RefreshCommandHandler(
    IIdentityDbContext identityDbContext,
    UserManager<User> userManager,
    TimeProvider timeProvider,
    ITokenProvider tokenProvider
) : ICommandHandler<RefreshCommand, Result<RefreshCommandResponse>>
{
    public async ValueTask<Result<RefreshCommandResponse>> Handle(
        RefreshCommand request,
        CancellationToken cancellationToken
    )
    {
        var refreshToken = await identityDbContext
            .RefreshTokens.AsNoTracking()
            .FirstOrDefaultAsync(rt => rt.Token == request.RefreshToken, cancellationToken);

        if (refreshToken is null || refreshToken.ExpiresAtUtc < timeProvider.GetUtcNow())
        {
            return Result<RefreshCommandResponse>.Unauthorized("Invalid or expired refresh token");
        }

        var identityUser = await identityDbContext.Users.FirstOrDefaultAsync(
            u => u.Id == refreshToken.UserId,
            cancellationToken
        );
        if (identityUser is null)
        {
            return Result<RefreshCommandResponse>.Failure("User not found");
        }

        IEnumerable<string> roles = await userManager.GetRolesAsync(identityUser);

        var accessTokens = tokenProvider.Create(
            new TokenRequest(identityUser.Id, identityUser.Email!, roles)
        );

        // Update the existing refresh token
        refreshToken.Token = accessTokens.RefreshToken;
        refreshToken.ExpiresAtUtc = accessTokens.RefreshTokenExpiration.UtcDateTime;

        identityDbContext.RefreshTokens.Update(refreshToken);
        await identityDbContext.SaveChangesAsync(cancellationToken);

        return Result<RefreshCommandResponse>.Success(new RefreshCommandResponse(accessTokens));
    }
}

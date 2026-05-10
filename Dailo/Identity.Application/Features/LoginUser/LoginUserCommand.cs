using Identity.Application.Models;
using Identity.Application.Persistence;
using Identity.Application.Services;
using Identity.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using StrictId;

namespace Identity.Application.Features.LoginUser;

public sealed record LoginUserCommand(string Email, string Password, string CaptchaPayload)
    : ICommand<Result<LoginUserCommandResponse>>;

public sealed record LoginUserCommandResponse(AccessTokenModel AccessTokens);

public sealed class LoginUserCommandHandler(
    IIdentityDbContext identityDbContext,
    UserManager<User> userManager,
    SignInManager<User> signInManager,
    ITokenProvider tokenProvider,
    IAltchaService altchaService
) : ICommandHandler<LoginUserCommand, Result<LoginUserCommandResponse>>
{
    public async ValueTask<Result<LoginUserCommandResponse>> Handle(
        LoginUserCommand request,
        CancellationToken cancellationToken
    )
    {
        if (!await altchaService.VerifyPayloadAsync(request.CaptchaPayload, cancellationToken))
        {
            return Result<LoginUserCommandResponse>.Unauthorized("Captcha verification failed.");
        }

        var identityUser = await userManager.FindByEmailAsync(request.Email);
        if (identityUser is null)
        {
            return Result<LoginUserCommandResponse>.Unauthorized("Invalid email or password");
        }

        var authResult = await signInManager.CheckPasswordSignInAsync(
            identityUser,
            request.Password,
            false
        );
        if (!authResult.Succeeded)
        {
            return Result<LoginUserCommandResponse>.Unauthorized("Invalid email or password");
        }

        IEnumerable<string> roles = await userManager.GetRolesAsync(identityUser);

        var accessTokens = tokenProvider.Create(
            new TokenRequest(identityUser.Id, identityUser.Email!, roles)
        );

        var refreshToken = new RefreshToken
        {
            Id = Id.NewId(),
            UserId = identityUser.Id,
            Token = accessTokens.RefreshToken,
            ExpiresAtUtc = accessTokens.RefreshTokenExpiration.UtcDateTime,
        };

        identityDbContext.RefreshTokens.Add(refreshToken);

        await identityDbContext.SaveChangesAsync(cancellationToken);

        var response = new LoginUserCommandResponse(accessTokens);
        return Result<LoginUserCommandResponse>.Success(response);
    }
}

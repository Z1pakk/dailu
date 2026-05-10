using Dailo.Events;
using Identity.Application.Models;
using Identity.Application.Persistence;
using Identity.Application.Services;
using Identity.Domain.Consts;
using Identity.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using StrictId;

namespace Identity.Application.Features.RegisterUser;

public sealed record RegisterUserCommand(
    string Email,
    string Password,
    string FirstName,
    string LastName,
    string CaptchaPayload
) : ICommand<Result<RegisterUserCommandResponse>>;

public sealed record RegisterUserCommandResponse(AccessTokenModel AccessTokens);

public sealed class RegisterUserCommandHandler(
    IIdentityDbContext identityDbContext,
    ITokenProvider tokenProvider,
    UserManager<User> userManager,
    IAltchaService altchaService
) : ICommandHandler<RegisterUserCommand, Result<RegisterUserCommandResponse>>
{
    public async ValueTask<Result<RegisterUserCommandResponse>> Handle(
        RegisterUserCommand request,
        CancellationToken cancellationToken
    )
    {
        if (!await altchaService.VerifyPayloadAsync(request.CaptchaPayload, cancellationToken))
        {
            return Result<RegisterUserCommandResponse>.Failure("Captcha verification failed.");
        }

        User user = request.ToEntity();

        var result = await identityDbContext.ExecuteTransactionalAsync(
            async () =>
            {
                var createUserResult = await userManager.CreateAsync(user, request.Password);
                if (!createUserResult.Succeeded)
                {
                    return Result<RegisterUserCommandResponse>.Failure("Unable to register user");
                }

                var addToRoleResult = await userManager.AddToRoleAsync(user, Roles.Member);
                if (!addToRoleResult.Succeeded)
                {
                    return Result<RegisterUserCommandResponse>.Failure("Unable to register user");
                }

                var accessTokens = tokenProvider.Create(
                    new TokenRequest(user.Id, request.Email, [Roles.Member])
                );

                var refreshToken = new RefreshToken
                {
                    Id = Id.NewId(),
                    UserId = user.Id,
                    Token = accessTokens.RefreshToken,
                    ExpiresAtUtc = accessTokens.RefreshTokenExpiration.UtcDateTime,
                };

                identityDbContext.RefreshTokens.Add(refreshToken);

                user.AddDomainEvent(new IdentityUserCreatedIntegrationEvent(user.Id));

                var response = new RegisterUserCommandResponse(accessTokens);
                return Result<RegisterUserCommandResponse>.Success(response);
            },
            cancellationToken
        );

        return result;
    }
}

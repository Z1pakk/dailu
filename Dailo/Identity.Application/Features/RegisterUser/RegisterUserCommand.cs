using Identity.Application.Models;
using Identity.Application.Persistence;
using Identity.Application.Services;
using Identity.Domain.Consts;
using Identity.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;

namespace Identity.Application.Features.RegisterUser;

public sealed record RegisterUserCommand(
    string Email,
    string Password,
    string FirstName,
    string LastName
) : ICommand<Result<RegisterUserCommandResponse>>;

public sealed record RegisterUserCommandResponse(AccessTokenModel AccessTokens);

public sealed class RegisterUserCommandHandler(
    IIdentityDbContext identityDbContext,
    ITokenProvider tokenProvider,
    UserManager<User> userManager
) : ICommandHandler<RegisterUserCommand, Result<RegisterUserCommandResponse>>
{
    public async ValueTask<Result<RegisterUserCommandResponse>> Handle(
        RegisterUserCommand request,
        CancellationToken cancellationToken
    )
    {
        User user = request.ToEntity();

        var result = await identityDbContext.ExecuteTransactionalAsync(
            async () =>
            {
                var createUserResult = await userManager.CreateAsync(user, request.Password);
                if (!createUserResult.Succeeded)
                {
                    // var extensions = new Dictionary<string, object?>()
                    // {
                    //     ["errors"] = createUserResult.Errors.ToDictionary(e => e.Code, e => e.Description),
                    // };

                    return Result<RegisterUserCommandResponse>.Failure("Unable to register user");
                }

                var addToRoleResult = await userManager.AddToRoleAsync(user, Roles.Member);
                if (!addToRoleResult.Succeeded)
                {
                    // var extensions = new Dictionary<string, object?>()
                    // {
                    //     ["errors"] = addToRoleResult.Errors.ToDictionary(e => e.Code, e => e.Description),
                    // };

                    return Result<RegisterUserCommandResponse>.Failure("Unable to register user");
                }

                var accessTokens = tokenProvider.Create(
                    new TokenRequest(user.Id, request.Email, [Roles.Member])
                );

                // var refreshToken = new RefreshToken
                // {
                //     Id = Guid.CreateVersion7(),
                //     UserId = identityUser.Id,
                //     Token = accessTokens.RefreshToken,
                //     ExpiresAtUtc = accessTokens.RefreshTokenExpiration,
                // };
                //
                // identityDbContext.RefreshTokens.Add(refreshToken);

                var response = new RegisterUserCommandResponse(accessTokens);
                return Result<RegisterUserCommandResponse>.Success(response);
            },
            cancellationToken
        );

        return result;
    }
}

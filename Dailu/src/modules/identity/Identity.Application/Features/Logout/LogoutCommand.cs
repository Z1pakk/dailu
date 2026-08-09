using Identity.Application.Persistence;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;

namespace Identity.Application.Features.Logout;

public sealed record LogoutCommand(string RefreshToken) : ICommand<Result> { }

public sealed class LogoutCommandHandler(IIdentityDbContext identityDbContext)
    : ICommandHandler<LogoutCommand, Result>
{
    public async ValueTask<Result> Handle(
        LogoutCommand request,
        CancellationToken cancellationToken
    )
    {
        var refreshToken = await identityDbContext
            .RefreshTokens.FirstOrDefaultAsync(
                rt => rt.Token == request.RefreshToken,
                cancellationToken
            );

        if (refreshToken is null)
        {
            return Result.Unauthorized("Invalid refresh token");
        }

        identityDbContext.RefreshTokens.Remove(refreshToken);
        await identityDbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

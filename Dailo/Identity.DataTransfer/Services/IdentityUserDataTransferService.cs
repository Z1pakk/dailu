using Identity.Application.Persistence;
using Identity.DataTransfer.Models;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ResultPattern;

namespace Identity.DataTransfer.Services;

public interface IIdentityUserDataTransferService
{
    Task<Result<UserModel>> GetUserDataTransferAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<Result> UpdateUserProfileAsync(
        Guid userId,
        string firstName,
        string lastName,
        CancellationToken cancellationToken = default
    );
}

public class IdentityUserDataTransferService(IIdentityDbContext identityDbContext)
    : IIdentityUserDataTransferService
{
    public async Task<Result<UserModel>> GetUserDataTransferAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    )
    {
        var user = await identityDbContext
            .Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new UserModel
            {
                Id = u.Id,
                Email = u.Email,
                FirstName = u.FirstName,
                LastName = u.LastName,
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (user is null)
        {
            return Result<UserModel>.NotFound("User not found.");
        }

        return Result<UserModel>.Success(user);
    }

    public async Task<Result> UpdateUserProfileAsync(
        Guid userId,
        string firstName,
        string lastName,
        CancellationToken cancellationToken = default
    )
    {
        if (string.IsNullOrWhiteSpace(firstName))
        {
            return Result.Failure("First name cannot be empty.");
        }

        if (string.IsNullOrWhiteSpace(lastName))
        {
            return Result.Failure("Last name cannot be empty.");
        }

        var user = await identityDbContext
            .Users.Where(u => u.Id == userId)
            .FirstOrDefaultAsync(cancellationToken);

        if (user is null)
        {
            return Result.NotFound("User not found.");
        }

        user.FirstName = firstName;
        user.LastName = lastName;

        await identityDbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

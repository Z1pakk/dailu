using Identity.Domain.Entities;

namespace Identity.Application.Features.RegisterUser;

public static class RegisterUserCommandMapper
{
    public static User ToEntity(this RegisterUserCommand command)
    {
        return new User
        {
            Email = command.Email,
            UserName = command.Email,
            FirstName = command.FirstName,
            LastName = command.LastName,
        };
    }
}

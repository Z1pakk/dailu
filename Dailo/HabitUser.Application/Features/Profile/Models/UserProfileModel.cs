namespace HabitUser.Application.Features.Profile.Models;

public sealed record UserProfileModel(Guid Id, string Email, string FirstName, string LastName);

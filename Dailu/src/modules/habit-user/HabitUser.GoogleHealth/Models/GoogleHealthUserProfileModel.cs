namespace HabitUser.GoogleHealth.Models;

public sealed record GoogleHealthUserProfileModel(
    string Id,
    string? Name,
    string? GivenName,
    string? FamilyName,
    string? Email,
    string? PictureUrl
);

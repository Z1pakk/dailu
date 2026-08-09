namespace Identity.Application.Models;

public sealed record AccessTokenModel(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiration
) { }

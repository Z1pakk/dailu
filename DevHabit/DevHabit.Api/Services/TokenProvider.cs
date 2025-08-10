using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DevHabit.Api.DTOs.Auth;
using DevHabit.Api.Settings;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace DevHabit.Api.Services;

public sealed class TokenProvider(IOptions<JwtAuthOptions> options)
{
    private readonly JwtAuthOptions _options = options.Value;

    public AccessTokenDto Create(TokenRequest request)
    {
        string accessToken = GenerateAccessToken(request);
        string refreshToken = GenerateRefreshToken();
        DateTime refreshTokenExpiry = DateTime.UtcNow.AddDays(
            _options.RefreshTokenExpirationInDays
        );

        return new AccessTokenDto(accessToken, refreshToken, refreshTokenExpiry);
    }

    private string GenerateAccessToken(TokenRequest request)
    {
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        List<Claim> claims =
        [
            new Claim(JwtRegisteredClaimNames.Sub, request.UserId),
            new Claim(JwtRegisteredClaimNames.Email, request.Email),
            new Claim(ClaimTypes.NameIdentifier, request.UserId),
            .. request.Roles.Select(role => new Claim(ClaimTypes.Role, role)),
        ];

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(_options.ExpirationInMinutes),
            SigningCredentials = credentials,
            Issuer = _options.Issuer,
            Audience = _options.Audience,
        };

        var handler = new JsonWebTokenHandler();
        return handler.CreateToken(tokenDescriptor)!;
    }

    private string GenerateRefreshToken()
    {
        byte[] randomBytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(randomBytes);
    }
}

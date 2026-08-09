using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Identity.Application.Models;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using SharedKernel.Configuration;

namespace Identity.Application.Services;

public interface ITokenProvider
{
    AccessTokenModel Create(TokenRequest request);
}

public sealed record TokenRequest(Guid UserId, string Email, IEnumerable<string> Roles);

public sealed class TokenProvider(IOptions<JwtAuthOptions> options, TimeProvider timeProvider)
    : ITokenProvider
{
    private readonly JwtAuthOptions _options = options.Value;

    public AccessTokenModel Create(TokenRequest request)
    {
        var accessToken = GenerateAccessToken(request);
        var refreshToken = GenerateRefreshToken();
        var refreshTokenExpiry = timeProvider
            .GetUtcNow()
            .AddDays(_options.RefreshTokenExpirationInDays);

        return new AccessTokenModel(accessToken, refreshToken, refreshTokenExpiry);
    }

    private string GenerateAccessToken(TokenRequest request)
    {
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        List<Claim> claims =
        [
            new(JwtRegisteredClaimNames.Sub, request.UserId.ToString("N")),
            new(JwtRegisteredClaimNames.Email, request.Email),
            new(ClaimTypes.NameIdentifier, request.UserId.ToString("N")),
            .. request.Roles.Select(role => new Claim(ClaimTypes.Role, role)),
        ];

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = timeProvider.GetLocalNow().DateTime.AddMinutes(_options.ExpirationInMinutes),
            SigningCredentials = credentials,
            Issuer = _options.Issuer,
            Audience = _options.Audience,
        };

        var handler = new JsonWebTokenHandler();
        return handler.CreateToken(tokenDescriptor);
    }

    private string GenerateRefreshToken()
    {
        var randomBytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(randomBytes);
    }
}

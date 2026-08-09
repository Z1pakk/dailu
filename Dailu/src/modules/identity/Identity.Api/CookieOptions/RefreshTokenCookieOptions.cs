using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;

namespace Identity.Api.CookieOptions;

internal static class RefreshTokenCookieOptions
{
    internal const string CookieName = "refreshToken";

    internal static Microsoft.AspNetCore.Http.CookieOptions Create(
        IWebHostEnvironment env,
        DateTimeOffset expires
    ) =>
        new()
        {
            HttpOnly = true,
            Secure = true,
            SameSite = env.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.Strict,
            Expires = expires.UtcDateTime,
        };
}

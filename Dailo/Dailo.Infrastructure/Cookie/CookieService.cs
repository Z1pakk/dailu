using Microsoft.AspNetCore.Http;
using SharedKernel.Cookie;

namespace Dailo.Infrastructure.Cookie;

public class CookieService(IHttpContextAccessor httpContextAccessor) : ICookieService
{
    public string? GetCookie(string key)
    {
        return httpContextAccessor.HttpContext?.Request.Cookies[key];
    }

    public void SetCookie(string key, string value, CookieOptions options)
    {
        httpContextAccessor.HttpContext?.Response.Cookies.Append(key, value, options);
    }

    public void DeleteCookie(string key)
    {
        httpContextAccessor.HttpContext?.Response.Cookies.Delete(key);
    }
}

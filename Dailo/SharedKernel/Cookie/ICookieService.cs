using Microsoft.AspNetCore.Http;

namespace SharedKernel.Cookie;

public interface ICookieService
{
    string? GetCookie(string key);

    void SetCookie(string key, string value, CookieOptions options);

    void DeleteCookie(string key);
}

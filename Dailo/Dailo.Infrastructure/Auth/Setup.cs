using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using SharedKernel.Configuration;

namespace Dailo.Infrastructure.Auth;

public static class Setup
{
    public static IServiceCollection AddAuthServices(this IServiceCollection services)
    {
        services.AddValidateOptions<JwtAuthOptions>();
        var jwtOptions = services.GetOptions<JwtAuthOptions>();

        services
            .AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters()
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwtOptions.Issuer,

                    ValidateAudience = true,
                    ValidAudience = jwtOptions.Audience,

                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(jwtOptions.Key)
                    ),

                    // Validate token expiration
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero, // Remove default 5-minute tolerance
                };

                // Handle authentication events
                options.Events = new JwtBearerEvents
                {
                    OnAuthenticationFailed = context =>
                    {
                        if (context.Exception is SecurityTokenExpiredException)
                        {
                            context.Response.Headers["Token-Expired"] = "true";
                        }

                        return Task.CompletedTask;
                    },

                    OnMessageReceived = context =>
                    {
                        // Allow token from cookie as fallback
                        if (string.IsNullOrEmpty(context.Token))
                        {
                            context.Token = context.Request.Cookies["access_token"];
                        }
                        return Task.CompletedTask;
                    },
                };
            });

        services.AddAuthorization();

        return services;
    }
}

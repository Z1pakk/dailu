# 003_authentication

## Status
Accepted

## Context
The application requires a secure authentication mechanism to protect user data and control access to resources. As a habit tracking application with user accounts, integrations (GitHub, Strava), and sensitive personal data, the authentication strategy must balance security, usability, and implementation simplicity.

Key requirements:
- Secure user registration and login
- Stateless API authentication suitable for a SPA frontend and mobile clients
- Ability to stay logged in across browser sessions and app restarts
- Protection against common attacks (CSRF, token theft, brute force)
- Bot/spam protection on registration
- Support mobile clients that cannot use HttpOnly cookies or set custom headers

## Considered Options

1. **JWT Access Token + HttpOnly Cookie Refresh Token**
   - Pros:
     - Stateless access tokens — no server-side session storage needed
     - Refresh token stored in HttpOnly cookie prevents JavaScript access (XSS protection)
     - Short-lived access tokens limit exposure window on token theft
     - Refresh token rotation provides long-lived sessions securely
   - Cons:
     - More complex token management than simple session cookies
     - Access token cannot be invalidated before expiry (mitigated by short TTL)
   - Use Case: SPAs that need stateless APIs with secure long-lived sessions
   - Decision: **Accepted**

2. **Session-based Authentication**
   - Pros:
     - Simple to implement and reason about
     - Easy to invalidate sessions server-side
   - Cons:
     - Requires server-side session storage (Redis or DB), adding infrastructure
     - Doesn't scale horizontally without sticky sessions or shared session store
     - Less suitable for stateless REST APIs consumed by SPAs
   - Use Case: Traditional server-rendered applications
   - Decision: **Rejected** — requires additional infrastructure and doesn't fit stateless API design

3. **OAuth2 / External Identity Provider Only**
   - Pros:
     - Offloads auth complexity to a trusted provider
     - No need to handle passwords
   - Cons:
     - Users cannot sign up without a third-party account
     - External dependency for core functionality
     - More complex integration for a self-hosted app
   - Use Case: Apps where third-party login is acceptable as the only option
   - Decision: **Rejected** — users must be able to register with email/password; third-party OAuth used for integrations only (GitHub, Strava), not for authentication

## Decision
We use **ASP.NET Core Identity** for user management (registration, password hashing, roles) combined with **JWT access tokens** returned in the response body and **refresh tokens stored in HttpOnly cookies**.

Authentication flow — **Web (SPA):**
- User logs in → receives a short-lived JWT access token in the response body + refresh token set in HttpOnly cookie
- SPA attaches JWT in `Authorization: Bearer` header for all API calls
- On expiry, SPA calls `/refresh` — the HttpOnly cookie is sent automatically by the browser, a new token pair is issued
- Logout clears the HttpOnly cookie server-side

Authentication flow — **Mobile (native apps):**
- User logs in → receives a short-lived JWT access token + refresh token, both in the response body
- Mobile app stores the refresh token in platform secure storage (iOS Keychain / Android Keystore)
- Access token is attached via `Authorization: Bearer` header for all API calls (same as web)
- On expiry, mobile app calls `/refresh` passing the refresh token explicitly as a request parameter
- Logout invalidates the refresh token server-side; client discards it from secure storage

Bot protection on registration is handled via **Altcha** (proof-of-work challenge), avoiding third-party CAPTCHA services.

## Consequences

**Positive:**
- No server-side session store required — horizontally scalable
- Refresh token in HttpOnly cookie is inaccessible to JavaScript, reducing XSS risk
- ASP.NET Core Identity handles password hashing, lockout, and role management
- Short-lived access tokens limit damage from token leakage
- Altcha keeps registration spam-free without user friction of image CAPTCHAs

**Negative:**
- Access tokens cannot be revoked before expiry (acceptable with short TTL)
- Refresh token rotation requires careful handling of concurrent requests
- Cookie-based refresh tokens introduce CSRF considerations for web (mitigated by SameSite policy)
- The `/refresh` endpoint must handle two flows — cookie-based (web) and parameter-based (mobile)

**Impact:**
- All protected endpoints accept JWT via `Authorization: Bearer` header on both web and mobile
- Web SPA stores access token in memory (not localStorage) to reduce XSS surface
- Mobile clients store the refresh token in platform secure storage and pass it explicitly on `/refresh`
- Token refresh logic must be implemented in the Angular HTTP interceptor (web) and equivalent mobile layer
- The `/refresh` endpoint checks for the refresh token first in the HttpOnly cookie, then falls back to the request parameter

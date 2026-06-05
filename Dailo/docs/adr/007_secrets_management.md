# 007_secrets_management

## Status
Accepted

## Context
The project requires secrets management for runtime environment variables (database credentials, JWT keys, encryption keys, third-party API keys) used by Docker containers deployed on Hetzner via Dokploy, and for CI/CD secrets used in GitHub Actions.

Without a dedicated solution, secrets are duplicated across two separate stores — GitHub Secrets for the CI/CD pipeline and Dokploy's env vars for running containers. This means rotating a secret requires manual updates in both places, and there is no audit log, versioning, or single source of truth.

## Considered Options
1. **GitHub Secrets + Dokploy env vars (status quo)**
   - Pros: No extra service, zero setup cost, already in place
   - Cons: Secrets duplicated across two places, no audit log, manual rotation in multiple locations
   - Use Case: Solo projects with infrequently rotated secrets and minimal operational needs
   - Decision: Rejected — does not scale and creates operational risk on secret rotation

2. **HashiCorp Vault (self-hosted)**
   - Pros: Industry standard, highly configurable, powerful secret engines
   - Cons: Heavy operational overhead — requires dedicated server resources, TLS setup, storage backend, and manual unsealing after restarts; massive overkill for a single-developer project
   - Use Case: Enterprise teams with dedicated DevOps engineers
   - Decision: Rejected — operational burden far exceeds the benefit at this scale

3. **Doppler**
   - Pros: Excellent DX, native Docker Compose integration, free tier covers solo projects
   - Cons: Closed source, cannot self-host
   - Use Case: Teams wanting a polished managed service without infrastructure overhead
   - Decision: Rejected — closed source is a risk for long-term vendor dependency

4. **Infisical**
   - Pros: Open source (can self-host if needed), free cloud tier, single source of truth for both CI/CD and runtime secrets, Docker integration, audit logs, secret versioning, environment separation (dev/prod)
   - Cons: Additional third-party dependency, requires initial setup
   - Use Case: Small-to-medium projects wanting a proper vault without self-hosting complexity
   - Decision: Accepted

## Decision
Infisical is chosen as the secrets management solution. It acts as a single source of truth — both GitHub Actions and Dokploy pull secrets from Infisical, eliminating duplication. Its free cloud tier covers the project's needs, and being open source means self-hosting is an option if vendor dependency becomes a concern.

## Consequences
- Secrets are managed in one place; rotating a value propagates to all consumers automatically
- GitHub Actions integrates via the official Infisical action to inject secrets into the workflow
- Dokploy injects secrets at container startup via the Infisical CLI or Docker integration
- Introduces a dependency on Infisical's cloud availability (mitigated by the self-hosting option)
- Initial migration effort required to move existing secrets from GitHub and Dokploy into Infisical

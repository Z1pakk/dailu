# 008_production_migrations

## Status
Accepted

## Context
Each bounded context (Habit, HabitEntry, HabitUser, Identity, Tag) owns its own
EF Core migrations, applied via a shared `AddDatabaseInitialization()` hosted
service (see [005_orm](005_orm.md)). In development, `Dailo.Api` runs this
service itself at startup (`Dailo.Api/Program.cs`), gated by
`builder.Environment.IsDevelopment()`.

That approach doesn't hold up in production:
- Migrations would run on every API instance/restart rather than once per
  deploy, with no single point that can block a bad migration from ever
  reaching a live database.
- There is no independent, auditable signal that "migrations for this
  deploy succeeded" separate from "the app container started" - Dokploy's own
  deploy-lifecycle status reflects the latter, not the former.
- Reaching the production host (Hetzner, behind Dokploy) at all requires some
  form of remote access from CI, which needs its own credential and network
  design distinct from how the app itself is deployed.

This ADR covers two related decisions: how migrations are structured and
gated as a build/deploy artifact, and how CI is granted the access needed to
run them against the production database.

## Considered Options

1. **Auto-migrate on API startup in every environment (status quo, extended to prod)**
   - Pros: No extra project, image, or pipeline step; identical behavior in
     dev and prod.
   - Cons: Re-applies/re-checks migrations on every instance start and
     restart, not once per deploy; no way to block a deploy on migration
     failure independent of the app booting; runs with the API's own runtime
     identity rather than a narrowly scoped one.
   - Use Case: Local development and single-instance dev/test environments.
   - Decision: Kept for `Development` only (`Dailo.Api/Program.cs:29`);
     rejected for Production.

2. **Second build target inside `Dailo.Api`'s own Dockerfile**
   - Pros: One Dockerfile to maintain instead of two.
   - Cons: Had a real bug - the migrations-runner target was the *last*
     stage in the file, and the API's build step never passed `target: final`
     explicitly, so a plain `docker build` (which defaults to the last stage)
     silently built and pushed the migrations-runner's content under the
     `dailo-api` image tags.
   - Use Case: N/A - the "last stage wins by default" footgun makes this
     unsafe regardless of scale.
   - Decision: Rejected, replaced by option 3.

3. **Dedicated `Dailo.MigrationsRunner` project and Dockerfile, run as a gated CI job before deploy**
   - Pros: Isolated image and build (`Dailo.MigrationsRunner/Dockerfile`),
     no shared last-stage ambiguity; the runner is a one-shot console host
     that reuses the same `AddDatabaseInitialization()` service and prints an
     explicit `MIGRATIONS_RUNNER_RESULT=SUCCESS`/`FAILURE` sentinel that CI
     greps for, independent of Dokploy's own status; `deploy` only fires if
     `migrate` succeeded (`needs: [build-and-push, migrate]`).
   - Cons: Duplicates the shared project-reference `COPY` lines between the
     two Dockerfiles (kept intentionally, to exactly match what's already
     proven to restore correctly, rather than trimmed to a minimal shared
     subset).
   - Use Case: Any environment where migrations must run exactly once per
     deploy and are allowed to block that deploy.
   - Decision: Accepted.

4. **CI access to the production host: long-lived static SSH key in GitHub Secrets**
   - Pros: Simplest possible setup.
   - Cons: A long-lived credential has a long exposure window if it ever
     leaks, with no way to narrow what it's good for beyond "SSH into this
     box."
   - Decision: Rejected.

5. **CI access via GitHub OIDC federated into step-ca**
   - Pros: No standing secret in GitHub at all.
   - Cons: step-ca's OIDC provisioner authenticates by *email domain* (built
     for human SSO) with no native way to check which GitHub repository
     issued the token; closing that gap would require a custom authorization
     webhook whose exact request payload isn't clearly documented publicly.
   - Decision: Rejected.

6. **CI access via a self-hosted step-ca JWK provisioner issuing short-lived SSH certificates**
   - Pros: The only standing secret is a provisioner password
     (`DOKPLOY_CA_PROVISIONER_PASSWORD`); every actual login uses a
     certificate valid ~10 minutes (capped server-side at 15 minutes
     regardless of what's requested); the certificate's `force-command`
     restricts the session to `/opt/ci-scripts/run-migrations.sh`, which
     validates the requested image against an anchored regex before handing
     off to a root-owned script scoped by a fixed `sudoers` rule (no
     wildcards); `TrustedUserCAKeys` is scoped to a `Match User ci-migrate`
     block, not set globally.
   - Cons: step-ca is now infrastructure that must be kept patched and
     available - if it's down, deploys can't migrate; more moving parts than
     a static key.
   - Use Case: Any CI-to-production access pattern where the caller shouldn't
     hold a durable, broadly-scoped credential.
   - Decision: Accepted.

7. **Network exposure of step-ca and sshd while CI reaches them**
   - Whether these stay open to the public internet or sit behind a private
     VPN is a separate decision from the certificate/provisioner model
     itself, and is broken out into its own ADR since it also covers the
     `deploy` job's connection to the Dokploy webhook, not just migrations.
   - Decision: See [009_production_vpn](009_production_vpn.md) - Tailscale-only,
     as a defense-in-depth layer on top of (not a replacement for) the
     certificate/force-command model in this ADR.

## Decision
Production migrations are packaged and run separately from the API:
`Dailo.MigrationsRunner` is a standalone console project and Docker image
that applies all five bounded contexts' migrations and exits with an explicit
success/failure sentinel. `Dailo.Api` only auto-migrates when
`ASPNETCORE_ENVIRONMENT=Development`; in every other environment,
`Dailo.MigrationsRunner` is the only thing that ever applies migrations.

`.github/workflows/deploy.yml` runs three jobs on push to `main`:
`build-and-push` builds and pushes `dailo-api`, `dailo-frontend`, and
`dailo-migrations-runner` images tagged `:latest` and `:${{ github.sha }}`;
`migrate` joins the tailnet, exchanges a provisioner password for a
short-lived (~10 min) SSH certificate from a self-hosted `step-ca`, and SSHes
into a locked-down `ci-migrate` account whose forced command validates the
image reference and runs it directly on `dokploy-network`; `deploy`
(`needs: [build-and-push, migrate]`) triggers the real Dokploy deployment via
webhook only if migrations succeeded. A migration failure fails the `migrate`
job's exit code directly (it's the container's own exit code, not a separate
status poll), which blocks `deploy` from ever running.

## Consequences
- Migrations run exactly once per deploy, as an explicit, independently
  auditable step that can block deployment - not as a side effect of an API
  instance starting or restarting.
- The only standing secret this design adds to GitHub is
  `DOKPLOY_CA_PROVISIONER_PASSWORD`; every actual server login uses a
  certificate that expires in minutes and is restricted server-side to one
  validated command, so a leaked provisioner password does not by itself grant
  general server access.
- step-ca is now infrastructure the deploy path depends on - if it's down,
  `migrate` fails and `deploy` never runs, even if the app images built fine.
  Whether/how network reachability to it is further restricted (Tailscale) is
  covered separately in [009_production_vpn](009_production_vpn.md), which
  adds its own dependency on top of this one.
- Operational setup and rationale are documented in detail in
  `docs/ci-migrations-setup.md`; that guide, not this ADR, is the source of
  truth for the exact commands to provision or rotate any part of this.
- Known gaps, tracked in `docs/ci-cd-improvements.md` and not yet applied:
  `migrate`/`deploy` have no `permissions:` block; `deploy.yml` has no
  `concurrency` group, so two quick pushes to `main` could trigger overlapping
  `migrate` runs against the same database; there is no `environment:
  production` gate requiring manual approval before migrations run; no
  `timeout-minutes` is set on either job.
- If the deployed API's `ASPNETCORE_ENVIRONMENT` is ever misconfigured to
  `Development`, the isolation this design relies on (API never migrates in
  prod) silently stops being true - this is a config invariant to verify
  after any change to deployment env vars, not something enforced in code.

## Notes (Optional)
- Full step-by-step provisioning guide (step-ca install, JWK provisioner,
  sshd `Match` block, `ci-migrate` user/scripts, Tailscale ACLs): `docs/ci-migrations-setup.md`.
- Outstanding CI/CD hardening items for this pipeline: `docs/ci-cd-improvements.md`.
- Related: [005_orm](005_orm.md) (migration ownership per bounded context),
  [007_secrets_management](007_secrets_management.md) (how
  `DOKPLOY_CA_PROVISIONER_PASSWORD` and friends are stored/rotated),
  [009_production_vpn](009_production_vpn.md) (network exposure of step-ca/sshd).

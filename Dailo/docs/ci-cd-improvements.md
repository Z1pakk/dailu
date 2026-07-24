# CI/CD improvements (punch list)

Gaps found reviewing `build.yml`, `deploy.yml`, `renovate.yml`, and
`renovate-global.json` against general CI/CD best practices - not yet applied,
tracked here so they don't get lost. What's already solid: PR-build concurrency
cancellation, dependency caching, Renovate with `osvVulnerabilityAlerts`, and
`timeout-minutes` on the renovate job (just not carried over to the others).

## High value, low effort

- [ ] **Renovate only watches NuGet.** `.github/renovate-global.json:5` -
  `"enabledManagers": ["nuget"]`. Frontend npm dependencies
  (`Dailo.ClientApp/package.json`) and Dockerfile base images
  (`mcr.microsoft.com/dotnet/...`) get zero automated update or vulnerability
  coverage. Add `"npm"` and `"dockerfile"` to the array.
- [ ] **`migrate` and `deploy` jobs have no `permissions:` block**
  (`.github/workflows/deploy.yml`) - unlike `build-and-push`, which correctly
  scopes to `contents: read, packages: write`. Neither job actually uses
  `GITHUB_TOKEN` for anything. Pin both to `permissions: {}`.
- [ ] **No `concurrency` group on `deploy.yml`**, unlike `build.yml`. Two quick
  pushes to `main` could trigger two overlapping `migrate` runs against the
  same database. Add a concurrency group scoped to the workflow - without
  `cancel-in-progress`, since cancelling mid-migration is worse than queuing.
- [ ] **No `timeout-minutes` anywhere in `build.yml` or `deploy.yml`** -
  `renovate.yml:9` already shows the pattern is known, just not carried over.

## Medium value

- [ ] **Actions pinned to mutable tags** (`actions/checkout@v6`,
  `docker/build-push-action@v6`, etc.) rather than commit SHAs - same class of
  supply-chain gap as the `curl | bash` step CLI install fixed in
  `ci-migrations-setup.md`. Renovate can auto-manage this (enable the
  `github-actions` manager + a digest-pinning preset) instead of pinning by
  hand.
- [ ] **No `environment: production` gate on `migrate`/`deploy`.** A push to
  `main` runs real database migrations fully automatically. A GitHub
  Environment with a required reviewer puts a manual approval in front of that
  specific step without slowing down build/test/push.
- [ ] **`build-backend` requests `contents: write`** (`build.yml:23`) - nothing
  in restore/build/test/publish needs to write to the repo; looks broader than
  necessary.

## Lower priority

- [ ] No vulnerability scanning beyond Renovate's own alerts (e.g.
  `dotnet list package --vulnerable`, or a Trivy scan of the built images
  before they're pushed).
- [ ] No secrets-scanning step (gitleaks/trufflehog) in CI.
- [ ] Unconfirmed whether `main` has branch protection requiring the
  `Build & Test` check + review before merge - a repo setting, not a file.

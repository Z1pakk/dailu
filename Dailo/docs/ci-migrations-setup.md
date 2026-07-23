# CI-driven database migrations (setup guide)

How production database migrations run as a distinct, gated step before deployment,
using a dedicated `Dailo.MigrationsRunner` project, a self-hosted `step-ca` instance,
and short-lived SSH certificates issued to CI via a shared provisioner secret.

## Already done in the repo

- `Dailo.MigrationsRunner` - standalone console project that reuses the existing
  `AddDatabaseInitialization()` hosted service to migrate + seed all 5 bounded
  contexts, then prints `MIGRATIONS_RUNNER_RESULT=SUCCESS`/`FAILURE` before exiting.
- `Dailo.Api/Dockerfile` - has a `migrations-runtime` build target producing this
  as its own image.
- `.github/workflows/deploy.yml` - builds/pushes `dailo-api`, `dailo-frontend`, and
  `dailo-migrations-runner` images, then runs a `migrate` job over SSH before the
  `deploy` job triggers the real app deployment (`needs: [build-and-push, migrate]`).

## Why step-ca instead of a static certificate

A certificate you sign once and reuse has to either live a long time (bad - long
exposure window if it leaks) or be re-signed constantly by hand (impractical). A CA
that signs on demand can issue certificates that live minutes instead, without a
human in the loop.

This uses step-ca's **JWK provisioner** - authentication via a shared secret (a
provisioner name + password, conceptually the same as an OAuth client ID + client
secret), rather than federating trust from an external OIDC identity provider. That
tradeoff is deliberate: a GitHub-OIDC-based design was considered first, but step-ca's
OIDC provisioner restricts by *email domain* (built for human SSO) and has no native
way to check "which GitHub repository issued this token" - closing that gap would
have required a custom authorization webhook whose exact request payload isn't
clearly documented publicly. The JWK provisioner avoids that whole problem: the
trust boundary is simply "whoever holds this password can request a cert," which
is easy to reason about and verify.

## 1. Install step-ca and initialize it under a dedicated user

Follow the official install instructions for `step` (CLI) and `step-ca` for your
OS: https://smallstep.com/docs/step-cli/installation/ and
https://smallstep.com/docs/step-ca/installation/ (exact package/binary URLs change
over time, so use those pages rather than a pinned download link).

Run the CA process as its own unprivileged system user rather than root, so a
compromise of step-ca doesn't carry root on the box - it only needs to bind a
port above 1024 and read/write its own files, neither of which needs root:

```
sudo mkdir -p /var/lib/step-ca
sudo useradd --system --home-dir /var/lib/step-ca --shell /usr/sbin/nologin step-ca
sudo chown step-ca:step-ca /var/lib/step-ca
```

Initialize the CA directly as that user, with `STEPPATH` pointed at its real
location from the start - this avoids ever having to move the CA's files or
rewrite absolute paths inside its config later:

```
sudo -u step-ca env STEPPATH=/var/lib/step-ca/.step step ca init --ssh \
  --name "Dailo CI CA" --dns <ca-hostname-or-ip> --address ":8443" --provisioner admin
```

This prompts interactively for a password that encrypts the CA's root/intermediate
private keys - generate a strong one (e.g. `openssl rand -base64 32`) and store it
in a password manager. This password is **not** a GitHub secret and never leaves
the server.

Store it in a root-only-readable file too, so the service can start without a
human typing it in on every restart:

```
echo "the-password-you-just-set" | sudo tee /etc/step-ca/password.txt > /dev/null
sudo chown root:step-ca /etc/step-ca/password.txt
sudo chmod 640 /etc/step-ca/password.txt
```

Create the systemd unit at `/etc/systemd/system/step-ca.service` (confirm the
binary path with `which step-ca` first, in case it isn't at `/usr/bin/step-ca`):

```
sudo tee /etc/systemd/system/step-ca.service > /dev/null <<'EOF'
[Unit]
Description=step-ca Certificate Authority
After=network.target

[Service]
Type=simple
User=step-ca
Group=step-ca
ExecStart=/usr/bin/step-ca /var/lib/step-ca/.step/config/ca.json --password-file /etc/step-ca/password.txt
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
```

```
sudo systemctl daemon-reload
sudo systemctl enable --now step-ca
sudo systemctl status step-ca
sudo ss -tlnp | grep 8443
sudo journalctl -u step-ca -f
```

**Every admin `step` CLI command from here on needs `STEPPATH` set**, since the
CA's files live under the dedicated user's home rather than your own:

```
export STEPPATH=/var/lib/step-ca/.step
```

(Run this once in your own shell session before the commands in steps 2-3 below,
or prefix each command with `STEPPATH=/var/lib/step-ca/.step`.)

## 2. Add a JWK provisioner for CI

```
STEPPATH=/var/lib/step-ca/.step step ca provisioner add ci-migrate-provisioner --create
```

This generates a keypair for the provisioner and prompts for a password to encrypt
its private key. That password is the only secret this whole design needs in
GitHub - save it as `DOKPLOY_CA_PROVISIONER_PASSWORD`.

**Cap the certificate duration server-side.** By default, the duration and
principal of an issued cert are whatever the *client* requests via
`step ca token`/`step ssh certificate` flags - the CA doesn't enforce a ceiling
on its own. That means if `DOKPLOY_CA_PROVISIONER_PASSWORD` ever leaked, someone
could request a much longer-lived certificate than the ~10 minutes our CI script
asks for. Cap it in the provisioner config so the CA refuses to issue anything
longer, no matter what the caller requests:

```
STEPPATH=/var/lib/step-ca/.step step ca provisioner update ci-migrate-provisioner --ssh-user-max-dur 15m --ssh-user-default-dur 10m
```

`--ssh-user-default-dur` sets what a request gets if it doesn't explicitly ask for
a duration; `--ssh-user-max-dur` is the hard ceiling the CA enforces regardless of
what's requested. Setting the default to 10m matches what our CI script already
requests explicitly via `--not-after 10m`, so this is really a safety net for if
that flag is ever dropped from the CI call by mistake.

(Confirmed against `step ca provisioner update --help` output - `--ssh-user-max-dur`
is the correct flag, not `--max-user-sshc-duration` as an earlier draft of this
guide guessed. `--ssh` doesn't need to be passed separately; SSH provisioning is
enabled by default. Related flag if you want finer control: `--ssh-user-min-dur`.)

Principal restriction (locking this provisioner to *only* ever issue certs for
the `ci-migrate` principal, not an arbitrary one) isn't covered by a simple claims
field the way duration is - it appears to require SSH certificate templates,
which weren't verified here. The CA itself will still sign a cert for whatever
principal is requested. That gap is closed one layer down instead: step 3 scopes
`TrustedUserCAKeys` to a `Match User ci-migrate` block, so even a cert issued for
a different principal (e.g. `root`) simply isn't trusted by sshd for logging into
any account on this box - the CA not enforcing this stops being load-bearing.

## 3. Trust step-ca's SSH user CA in sshd

`step ca init --ssh` already wrote the SSH user CA public key straight to disk -
there's no separate export command, just copy it to somewhere `sshd` can read:

```
  sudo cp /var/lib/step-ca/.step/certs/ssh_user_ca_key.pub /etc/ssh/step_ssh_user_ca.pub
sudo chmod 644 /etc/ssh/step_ssh_user_ca.pub
```

**Scope trust to the `ci-migrate` account only - don't set `TrustedUserCAKeys`
globally.** `TrustedUserCAKeys` is honored inside a `Match` block, so use that
instead of a bare top-level directive. Left global, a leaked provisioner
password (see step 2's principal-restriction caveat) would let someone request
a cert for *any* account on this box - `root` included - and sshd would accept
it. Scoped to one `Match User` block, a cert is only ever useful for logging in
as `ci-migrate`, no matter what principal was actually requested from the CA.
This same block also forces every session for that account through
`/opt/ci-scripts/run-migrations.sh` instead of a normal shell - that script is
created in step 4 below; sshd doesn't need it to exist yet to accept this
config, only once a real connection arrives.

Add to `/etc/ssh/sshd_config`:

```
Match User ci-migrate
    TrustedUserCAKeys /etc/ssh/step_ssh_user_ca.pub
    ForceCommand /opt/ci-scripts/run-migrations.sh
```

Always validate before restarting - a broken `sshd_config` can lock out every
session on the box, including the one you're editing from:

```
sudo sshd -t
sudo systemctl restart sshd
```

## 4. Dedicated server-side user + scripts

This is a *separate* dedicated user from step-ca's own service account above -
`ci-migrate` is who the SSH certificate authenticates as, not who runs the CA
process.

```
sudo useradd -m -s /bin/bash ci-migrate
```

Store the DB connection string where only root can read it:

```
sudo mkdir -p /opt/ci-scripts
sudo tee /opt/ci-scripts/migrations.env > /dev/null <<'EOF'
MIGRATIONS_DB_CONNECTION_STRING="Host=<db-host>;Port=5432;Database=<db>;Username=<user>;Password=<password>"
EOF
```

`/opt/ci-scripts/run-migrations.sh` (runs as `ci-migrate`, invoked via the
certificate's `force-command`; reads what the client actually asked for and
validates it). The client passes the full image reference rather than just a
tag, but it's still validated against an anchored regex matching the exact
expected repository - only the tag portion is variable, so this is no looser
than validating the tag alone:

```
sudo tee /opt/ci-scripts/run-migrations.sh > /dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

read -r -a ARGS <<< "${SSH_ORIGINAL_COMMAND:-}"

if [ "${ARGS[0]:-}" != "run-migrations" ]; then
  echo "Rejected: only 'run-migrations <image>' is allowed" >&2
  exit 1
fi

IMAGE="${ARGS[1]:-}"
if ! [[ "$IMAGE" =~ ^ghcr\.io/z1pakk/dailo-migrations-runner:[0-9a-f]{40}$ ]]; then
  echo "Rejected: image must be ghcr.io/z1pakk/dailo-migrations-runner:<40-char-git-sha>" >&2
  exit 1
fi

exec sudo /opt/ci-scripts/run-migrations-as-root.sh "$IMAGE"
EOF
```

`/opt/ci-scripts/run-migrations-as-root.sh` (root-owned; re-validates its
argument defensively rather than trusting the caller - same anchored regex,
never assume the outer script's check was actually enforced):

```
sudo tee /opt/ci-scripts/run-migrations-as-root.sh > /dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

source /opt/ci-scripts/migrations.env

IMAGE="${1:-}"
if ! [[ "$IMAGE" =~ ^ghcr\.io/z1pakk/dailo-migrations-runner:[0-9a-f]{40}$ ]]; then
  echo "Rejected: image must be ghcr.io/z1pakk/dailo-migrations-runner:<40-char-git-sha>" >&2
  exit 1
fi

docker pull "$IMAGE"
exec docker run --rm \
  --network dokploy-network \
  -e ConnectionStrings__HabitPostgresConnectionString="$MIGRATIONS_DB_CONNECTION_STRING" \
  -e ConnectionStrings__HabitEntryPostgresConnectionString="$MIGRATIONS_DB_CONNECTION_STRING" \
  -e ConnectionStrings__HabitUserPostgresConnectionString="$MIGRATIONS_DB_CONNECTION_STRING" \
  -e ConnectionStrings__IdentityPostgresConnectionString="$MIGRATIONS_DB_CONNECTION_STRING" \
  -e ConnectionStrings__TagPostgresConnectionString="$MIGRATIONS_DB_CONNECTION_STRING" \
  "$IMAGE"
EOF
```

Permissions:

```
sudo chown ci-migrate:ci-migrate /opt/ci-scripts/run-migrations.sh
sudo chmod 700 /opt/ci-scripts/run-migrations.sh

sudo chown root:root /opt/ci-scripts/run-migrations-as-root.sh /opt/ci-scripts/migrations.env
sudo chmod 700 /opt/ci-scripts/run-migrations-as-root.sh
sudo chmod 600 /opt/ci-scripts/migrations.env
```

Scoped sudo rule - one fixed path, no wildcards (some `sudo` implementations,
e.g. `sudo-rs`, reject wildcard command arguments outright):

```
sudo visudo -f /etc/sudoers.d/ci-migrate
```
```
ci-migrate ALL=(root) NOPASSWD: /opt/ci-scripts/run-migrations-as-root.sh
```

Do not add `ci-migrate` to the `docker` group - all docker access happens only
through the scoped sudo rule above.

## 5. GitHub Actions: exchange the provisioner secret for a short-lived cert

Get the CA's root certificate fingerprint once from the server (this value isn't
sensitive - it's the same public root cert every client needs to trust the CA,
just a way to confirm CI is actually talking to your CA and not an impostor):

```
STEPPATH=/var/lib/step-ca/.step step certificate fingerprint /var/lib/step-ca/.step/certs/root_ca.crt
```

Add repo secrets: `DOKPLOY_SSH_HOST`, `DOKPLOY_CA_URL` (step-ca's address, e.g.
`https://<ca-hostname-or-ip>:8443`), `DOKPLOY_CA_FINGERPRINT` (from the command
above), and `DOKPLOY_CA_PROVISIONER_PASSWORD` (from step 2).

`migrate` job in `.github/workflows/deploy.yml`:

```yaml
  migrate:
    name: Run DB Migrations
    runs-on: ubuntu-latest
    needs: build-and-push

    steps:
      - name: Install step CLI
        env:
          STEP_CLI_VERSION: "0.30.6"
        run: |
          curl -fsSL -O \
            "https://github.com/smallstep/cli/releases/download/v${STEP_CLI_VERSION}/step_linux_${STEP_CLI_VERSION}_amd64.tar.gz"
          curl -fsSL -o checksums.txt \
            "https://github.com/smallstep/cli/releases/download/v${STEP_CLI_VERSION}/checksums.txt"
          grep " step_linux_${STEP_CLI_VERSION}_amd64.tar.gz$" checksums.txt | sha256sum -c -
          tar -xzf "step_linux_${STEP_CLI_VERSION}_amd64.tar.gz"
          sudo mv "step_${STEP_CLI_VERSION}/bin/step" /usr/local/bin/step
          rm -rf "step_linux_${STEP_CLI_VERSION}_amd64.tar.gz" checksums.txt "step_${STEP_CLI_VERSION}"
          step version

      - name: Bootstrap trust in step-ca
        run: |
          step ca bootstrap --ca-url "${{ secrets.DOKPLOY_CA_URL }}" \
            --fingerprint "${{ secrets.DOKPLOY_CA_FINGERPRINT }}" --force

      - name: Get a short-lived SSH certificate from step-ca
        run: |
          echo "${{ secrets.DOKPLOY_CA_PROVISIONER_PASSWORD }}" > /tmp/provisioner-pass.txt
          TOKEN=$(step ca token ci-migrate --ssh \
            --provisioner ci-migrate-provisioner \
            --provisioner-password-file /tmp/provisioner-pass.txt \
            --ca-url "${{ secrets.DOKPLOY_CA_URL }}")
          step ssh certificate --token "$TOKEN" --sign \
            --not-after 10m \
            ci-migrate /tmp/ci_ephemeral
          rm -f /tmp/provisioner-pass.txt

      - name: Run migrations over certificate-authenticated SSH
        run: |
          set -e
          mkdir -p ~/.ssh
          ssh-keyscan -H "${{ secrets.DOKPLOY_SSH_HOST }}" >> ~/.ssh/known_hosts 2>/dev/null

          IMAGE="${{ env.MIGRATIONS_IMAGE }}:${{ github.sha }}"
          IMAGE="${IMAGE,,}"

          ssh -i /tmp/ci_ephemeral \
            "ci-migrate@${{ secrets.DOKPLOY_SSH_HOST }}" \
            "run-migrations $IMAGE"

          rm -f /tmp/ci_ephemeral /tmp/ci_ephemeral.pub /tmp/ci_ephemeral-cert.pub
```

Verify the exact `step ca token` / `step ssh certificate` invocations (flag
names/order) against `--help` on the CLI version you install before relying on
this in the real pipeline - confirm the token generates non-interactively from
the password file with no prompt, and that the resulting cert has `ci-migrate` as
its principal.

## How a deploy flows end to end

1. Push to `main` triggers `build-and-push`: builds and pushes `dailo-api`,
   `dailo-frontend`, and `dailo-migrations-runner`, all tagged `:latest` and
   `:${{ github.sha }}`.
2. `migrate` uses the provisioner password to generate a one-time token from
   step-ca, exchanges it for an SSH certificate valid ~10 minutes, then SSHes in.
   The certificate's `force-command` restricts the session to `run-migrations.sh`
   regardless of what's requested; that script validates the sha and hands off to
   the root-owned script, which pulls and runs the migrations image directly on
   `dokploy-network`. This step's exit code **is** the container's actual exit
   code - if migrations fail, this job fails and nothing downstream runs.
3. `deploy` (`needs: [build-and-push, migrate]`) only fires if `migrate`
   succeeded, and triggers the real Dokploy deployment via the existing webhook.

## Known caveats

- `DOKPLOY_CA_PROVISIONER_PASSWORD` is the one standing secret this design still
  has in GitHub. With the duration cap from step 2 applied, it grants the ability
  to request certs no longer than 15 minutes; whatever principal is requested is
  still restricted server-side on the SSH session itself (via `force-command` +
  the scoped sudo rule) to running exactly one script with a validated git-sha
  argument - not direct/unrestricted server access. Rotate it via
  `STEPPATH=/var/lib/step-ca/.step step ca provisioner update ci-migrate-provisioner`
  if it's ever suspected leaked.
- Admin `step` CLI commands (provisioner add/update, etc.) need `STEPPATH=/var/lib/step-ca/.step`
  set - the CA's files live under the dedicated `step-ca` system user's home, not
  your own, since there's no `/root/.step` fallback in this setup.
- `step ca token`/`step ssh certificate`'s precise flag combination should still
  be checked against `--help` on your installed version before relying on it in
  the real pipeline - it wasn't confirmed with full certainty against a live
  instance while writing this guide (unlike the SSH CA public key path and the
  `--ssh-user-max-dur` duration flag, which have both been verified).
- `Dailo.Api` still runs its own `DatabaseInitializationService` at startup as a
  safety net (harmless no-op if migrations already applied), kept intentionally
  for local/dev workflows that don't go through this pipeline.
- If `docker pull` on the server ever fails with an auth error, the host isn't
  authenticated to GHCR for this new image the way it is for the existing two -
  add a `docker login` step (credentials sourced the same way as `migrations.env`,
  not from CI) to `run-migrations-as-root.sh`.
- step-ca itself is now infrastructure you're running and must keep patched and
  available - if it's down, deploys can't migrate.
- `STEP_CLI_VERSION` in the `migrate` job is pinned deliberately (was previously
  `curl | bash` against `smallstep/cli`'s mutable `master` branch - unpinned and
  unverified, so a compromise of that script would have been arbitrary code
  execution in a job that handles the provisioner password). Bump it and re-check
  the checksum step still passes when you want a newer `step` release, rather than
  letting it silently track `master`.

# 009_production_vpn

## Status
Accepted

## Context
CI (GitHub-hosted runners) needs to reach three things on the production
Hetzner host as part of a deploy: `sshd` (22) and `step-ca` (8443) for the
certificate-gated migration step, and Dokploy's deployment webhook to trigger
the actual release (see [008_production_migrations](008_production_migrations.md)
for the certificate/provisioner auth model those first two rely on).

GitHub-hosted runners get a different IP on every single run, so there is no
stable range to usefully allowlist at the cloud firewall - the practical
default is leaving the relevant ports open to `0.0.0.0/0` and relying
entirely on application-layer auth (step-ca's provisioner password, cert
`force-command` restrictions) to keep that safe. That auth model holds on its
own, but it still means `step-ca` and `sshd` are visible to internet-wide
scanners and bots, which is exposure with no offsetting benefit once a better
option exists.

## Considered Options

1. **No VPN - keep `step-ca`/`sshd`/the Dokploy webhook open to the public internet**
   - Pros: No extra infrastructure or dependency; sidesteps the problem that
     CI's IP changes every run and can't be meaningfully allowlisted.
   - Cons: Both services are reachable by anyone on the internet, not just
     CI; the cert/password auth model still holds, but unpatched CVEs,
     scan/brute-force noise, and unknown zero-days are all exposure this
     doesn't need to accept once a private-network option is available.
   - Use Case: Acceptable as a stopgap before a VPN layer exists.
   - Decision: Rejected as the end state - superseded by option 2.

2. **Put `step-ca`, `sshd`, and the Dokploy webhook behind a Tailscale-only tailnet**
   - Pros: Removes public exposure as a second, independent layer without
     changing the underlying provisioner/cert auth model at all; CI joins as
     a short-lived, single-use ephemeral node per run rather than holding a
     standing VPN credential.
   - Cons: Tailscale becomes an additional moving part in the deploy path -
     if the `Connect to Tailscale` step fails, or Tailscale's own
     coordination service is down, `migrate` and `deploy` both fail before
     ever reaching the server, independent of whether step-ca/sshd/Dokploy
     are themselves healthy.
   - Decision: Accepted.

3. **CI's tailnet credential: ephemeral OAuth client vs. a standing pre-generated auth key**
   - Pros of an OAuth client: no long-lived key stored in GitHub Secrets - CI
     exchanges the client ID/secret for a fresh, single-use auth key at
     runtime; scoped to **Auth Keys: Write** only (no `Devices: Core`, `DNS`,
     `Routes`, etc.), and to minting only `tag:ci`-tagged nodes.
   - Cons: One more piece of setup (tag ownership + ACL policy) versus
     pasting in a single reusable key.
   - Decision: OAuth client accepted; a static pre-auth key rejected as a
     longer-lived, more broadly usable credential than the job needs.

4. **Tailnet ACL: allow by identity (tag/login) vs. by raw IP address**
   - Pros of identity-based: correct regardless of which address a node
     happens to get - CI's tailnet address is a fresh ephemeral one every
     run, and even a personal device's address isn't guaranteed permanent.
   - Cons: Requires understanding Tailscale's ACL policy file
     (`tagOwners`/`acls`) rather than a flat IP list; the policy ships with a
     permissive default (`{"action":"accept","src":["*"],"dst":["*:*"]}`)
     that must be deleted outright, not left alongside a narrower rule, since
     ACL rules are additive and the wildcard would keep allowing everything
     regardless of what's added after it.
   - Decision: Identity-based accepted - `src: ["tag:ci", "<personal
     login>"]`, `dst` scoped to the server's tailnet IP and specific ports.

5. **Hetzner cloud firewall: the full Tailscale CGNAT range (`100.64.0.0/10`) vs. one exact tailnet IP**
   - Pros of the full range: avoids fragility and self-lockout if a specific
     device's tailnet IP ever changes; the cloud firewall is meant as a
     coarse "is this Tailscale traffic at all" gate, with the ACL (option 4)
     doing the actual identity-based restriction.
   - Cons: Wider than the theoretical minimum at this layer alone.
   - Decision: Full CGNAT range accepted - narrowing further here would
     duplicate, not strengthen, what the ACL already enforces, while adding
     real lockout risk if a device's address changes.

## Decision
Production `sshd`, `step-ca`, and the Dokploy deployment webhook are reachable
only over a private Tailscale tailnet, not the public internet. CI joins the
tailnet per run as an ephemeral `tag:ci` node via an OAuth client scoped to
`Auth Keys: Write` only; access is authorized by tailnet identity (the `tag:ci`
tag plus specific personal logins) rather than by IP, in the tailnet's own ACL
policy; and the Hetzner cloud firewall is scoped to the whole Tailscale CGNAT
range as a coarse secondary gate behind that ACL. This is layered on top of -
not a replacement for - the certificate/provisioner auth model in
[008_production_migrations](008_production_migrations.md).

## Consequences
- Removes `step-ca` and `sshd` from internet-wide scan/attack surface; the
  application-layer auth (provisioner password + short-lived certs) remains
  the actual trust boundary - this closes off exposure that offered no
  corresponding benefit, not a weaker fallback for that auth.
- Tailscale is now a dependency of both the `migrate` and `deploy` jobs -
  its coordination service or the `Connect to Tailscale` action failing
  blocks deploys entirely, even when step-ca and the built images are
  otherwise healthy.
- Admin operations against step-ca (bootstrap, provisioner list/update) must
  now happen from a device on the tailnet, targeting the server's tailnet
  address rather than its old public DuckDNS domain. A stale `ca-url` in a
  personal `~/.step/config/defaults.json` (distinct from `$STEPPATH`'s own
  config) is a known footgun here - it's what caused a `doesn't contain any
  IP SANs` error partway through the original setup.
- step-ca's own HTTPS certificate needed its `dnsNames` SANs re-issued to
  cover the server's tailnet IP before any GitHub secret was pointed at that
  address - skipping that step fails identically to the original public-IP
  SAN problem.
- Granting a new human operator or CI job server access requires an explicit
  ACL entry by tailnet identity - being on the tailnet at all doesn't imply
  reachability to anything.

## Notes (Optional)
- Full walkthrough (tag/ACL JSON, OAuth client scopes, Hetzner firewall
  change, step-ca SAN re-issue) is in `docs/ci-migrations-setup.md`, step 6.
- Related: [008_production_migrations](008_production_migrations.md) - the
  certificate/provisioner auth model this VPN layer sits on top of.

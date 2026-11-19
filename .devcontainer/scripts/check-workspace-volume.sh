#!/bin/bash
# Fails when /workspace is not the dailu-src Docker volume, for example when an editor bind-mounted
# the host checkout over it (Rider "Mount Sources"). The container then has GitHub credentials AND
# write access to the host repo and its .husky hooks, which the host's own git would run.
set -euo pipefail

# /proc/self/mountinfo field 4 is the mount's root: a named volume's is ".../volumes/<name>/_data", or a folder
# inside it (Docker Engine, Docker Desktop on Windows/macOS, rootless Docker, Podman); a bind mount shows the host path.
root="$(awk '$5 == "/workspace" { print $4 }' /proc/self/mountinfo | tail -n 1)"

if [[ "$root" =~ /volumes/[^/]+/_data(/.*)?$ ]]; then
    exit 0
fi

cat >&2 <<MSG

=====================================================================
 STOP: /workspace is not the dailu-src volume (mount root: '${root:-none}').
 The editor mounted your host folder into the container, which removes
 the isolation from your PC. Close the editor, delete this container
 and start it again without mounting your host folder
 (Rider: not 'Mount Sources'; use 'Clone Sources' or SSH).
=====================================================================

MSG
exit 1

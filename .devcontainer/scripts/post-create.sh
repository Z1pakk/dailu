#!/bin/bash
# Runs once after the container is created.
set -euo pipefail

/usr/local/bin/check-workspace-volume.sh

sudo /usr/local/bin/setup-root.sh

# Re-run the setup only for a finished clone; a first clone needs the GitHub sign-in in the editor
if git -C /workspace rev-parse -q --verify HEAD > /dev/null 2>&1; then
    /usr/local/bin/workspace-init.sh
else
    cat <<'MSG'

First run - the repo isn't in the container volume yet (the proxy must be in setup mode):
  workspace-init.sh
It tells you how to sign in to GitHub and fetch from your editor, then finishes the setup.

MSG
fi

#!/bin/bash
# Runs once after the container is created.
set -euo pipefail

/usr/local/bin/check-workspace-volume.sh

sudo /usr/local/bin/setup-root.sh

# Run the setup for a finished clone (an editor's "Clone Sources", or a rebuild); a first clone needs credentials first
if git -C /workspace rev-parse -q --verify HEAD > /dev/null 2>&1; then
    /usr/local/bin/workspace-init.sh
else
    cat <<'MSG'

First run - the repo isn't in the container volume yet (the proxy must be in setup mode):
  workspace-init.sh
It clones the repo (the proxy allows it) and finishes the setup, or tells you how to save your GitHub token first.

MSG
fi

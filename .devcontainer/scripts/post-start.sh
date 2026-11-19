#!/bin/bash
# Runs every time the container starts.
set -euo pipefail

/usr/local/bin/check-workspace-volume.sh

# Re-trust the certificates: the proxy creates a new egress CA if its volume was deleted
sudo /usr/local/bin/setup-root.sh

/usr/local/bin/forward-services.sh

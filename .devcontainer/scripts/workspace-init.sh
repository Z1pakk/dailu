#!/bin/bash
# Clones Dailu from GitHub into the workspace volume (first run only) and applies the setup.
# Needs the proxy in setup mode (NuGet + npm). Safe to run again: it never re-clones or touches your changes.
set -euo pipefail

# The proxy allows only this repository on GitHub
REPO_URL=https://github.com/Z1pakk/devhabit.git
CLIENT_APP=/workspace/Dailu/src/frontend/Dailu.ClientApp

/usr/local/bin/check-workspace-volume.sh

cd /workspace

# /workspace already contains the node_modules mount point, so git clone would refuse; clone in place
if [ ! -d .git ]; then
    git init -b main
fi

# Always HTTPS: the proxy blocks SSH, and an editor may have cloned over SSH (Rider's "Clone Sources")
if git remote get-url origin > /dev/null 2>&1; then
    git remote set-url origin "$REPO_URL"
else
    git remote add origin "$REPO_URL"
fi

# No commit checked out yet: first run, or an earlier run stopped before the checkout.
# Try a fetch with the credentials git has stored, without prompting.
if ! git rev-parse -q --verify HEAD > /dev/null; then
    if GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/bin/false SSH_ASKPASS=/bin/false git fetch origin 2> /dev/null; then
        # Check out GitHub's default branch
        default_branch="$(GIT_TERMINAL_PROMPT=0 git ls-remote --symref origin HEAD | awk '/^ref:/ { sub("refs/heads/", "", $2); print $2 }')"
        git checkout -B "${default_branch:-main}" --track "origin/${default_branch:-main}"
    else
        cat <<'MSG'

The repository isn't checked out yet, and git has no GitHub credentials. Save your token once:

  cd /workspace && git fetch origin
    Username: your GitHub username
    Password: a fine-grained token for Z1pakk/devhabit (Contents: Read and write)

Git saves them in the dailu-git-credentials volume. Then run workspace-init.sh again to finish the setup.

MSG
        exit 0
    fi
fi

# The image's tool versions come from versions.env; warn if the repo now asks for others
/usr/local/bin/check-versions.sh

# .NET local tools, if the repo has a tool manifest
if [ -f .config/dotnet-tools.json ] || [ -f Dailu/.config/dotnet-tools.json ]; then
    (cd Dailu && dotnet tool restore)
fi

# Restore NuGet packages now, while the proxy is in setup mode, so builds work offline later.
# The connection strings in appsettings.Development.json (localhost:5460) work through forward-services.sh.
dotnet restore Dailu/Dailu.slnx

# npm packages from package-lock.json, into the node_modules volume
cd "$CLIENT_APP"
npm ci

echo "Workspace ready. Switch the proxy back to run mode on the host."

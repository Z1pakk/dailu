#!/bin/bash
# Warns when the tool versions baked into the image (versions.env) differ from the ones the repo asks for.
# The image build can't read the repo (an editor may build from a copy of .devcontainer/ only), so they are kept twice.
# Never fails the setup: a mismatch is a warning, with the value to update.
set -uo pipefail

NVMRC=/workspace/Dailu/src/frontend/Dailu.ClientApp/.nvmrc

if [ ! -f "$NVMRC" ]; then
    exit 0
fi

# Same normalisation as the Dockerfile: no line endings, spaces, UTF-8 BOM or leading "v"
wanted="$(tr -d '\r\n \357\273\277' < "$NVMRC")"
wanted="${wanted#v}"
installed="$(node --version 2>/dev/null)"
installed="${installed#v}"

if [ "$wanted" != "$installed" ]; then
    cat >&2 <<MSG

WARNING: Node in the container is ${installed:-missing}, but ${NVMRC#/workspace/} asks for ${wanted}.
Set NODE_VERSION=${wanted} in .devcontainer/versions.env and rebuild the container.

MSG
fi

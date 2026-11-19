# Dailu dev container image. Pin the digest and versions.
FROM mcr.microsoft.com/dotnet/sdk:10.0.404-noble@sha256:bef136a371963aaa46ec97882845ef6f54dec15728bb4b128b1c2a400ffbc9b4

# Tool versions are not set here. They are read from versions.env at build time, through a bind mount that leaves
# nothing in the image. The build reads only .devcontainer/, so it works when an editor builds from a copy of it.

ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 \
    DISABLE_AUTOUPDATER=1 \
    LANG=C.UTF-8 \
    DEVCONTAINER=true \
    PATH="/usr/local/share/dotnet-tools:/home/dev/.dotnet/tools:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl git jq less openssh-server openssl procps socat sudo xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Node.js from the official tarball, checked against the published SHA-256 list
RUN --mount=type=bind,source=versions.env,target=/tmp/versions.env \
    set -eux; \
    # Strip line endings, spaces, a UTF-8 BOM (EF BB BF, which some Windows editors write) and a leading "v"
    NODE_VERSION="$(sed -n 's/^NODE_VERSION=//p' /tmp/versions.env | tr -d '\r\n \357\273\277')"; \
    NODE_VERSION="${NODE_VERSION#v}"; \
    test -n "${NODE_VERSION}"; \
    case "$(dpkg --print-architecture)" in \
        amd64) arch=x64 ;; \
        arm64) arch=arm64 ;; \
        *) echo "Unsupported architecture" >&2; exit 1 ;; \
    esac; \
    file="node-v${NODE_VERSION}-linux-${arch}.tar.xz"; \
    cd /tmp; \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/${file}"; \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"; \
    grep " ${file}\$" SHASUMS256.txt | sha256sum -c -; \
    tar -xJf "${file}" -C /usr/local --strip-components=1 --no-same-owner; \
    rm -f "${file}" SHASUMS256.txt

RUN --mount=type=bind,source=versions.env,target=/tmp/versions.env \
    set -eux; \
    CLAUDE_CODE_VERSION="$(sed -n 's/^CLAUDE_CODE_VERSION=//p' /tmp/versions.env | tr -d '\r ')"; \
    test -n "${CLAUDE_CODE_VERSION}"; \
    npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"

# Git credentials: on the first successful fetch (your token as the password, or the editor's GitHub sign-in),
# git's built-in store keeps them in the dailu-git-credentials volume.
# Set system-wide so it applies to every clone in the container.
RUN git config --system credential.helper "store --file /home/dev/.git-credentials.d/credentials"

# Non-root user that may run only setup-root.sh with sudo
RUN userdel -r ubuntu 2>/dev/null || true; \
    useradd --create-home --shell /bin/bash --uid 1000 dev; \
    echo "dev ALL=(root) NOPASSWD: /usr/local/bin/setup-root.sh" > /etc/sudoers.d/dev; \
    chmod 0440 /etc/sudoers.d/dev; \
    mkdir -p /workspace /home/dev/.nuget/packages /home/dev/.claude /home/dev/.ssh /home/dev/.git-credentials.d; \
    chown -R dev:dev /workspace /home/dev

# sshd settings for Rider's SSH remote development (see sshd-devcontainer.conf)
COPY sshd-devcontainer.conf /etc/ssh/sshd_config.d/00-devcontainer.conf
RUN sed -i 's/\r$//' /etc/ssh/sshd_config.d/00-devcontainer.conf \
    && chmod 0644 /etc/ssh/sshd_config.d/00-devcontainer.conf

# Scripts come from the host checkout (build context), not from the workspace volume
COPY scripts/ /usr/local/bin/
RUN sed -i 's/\r$//' /usr/local/bin/*.sh \
    && chown root:root /usr/local/bin/*.sh \
    && chmod 0755 /usr/local/bin/*.sh

USER dev

WORKDIR /workspace

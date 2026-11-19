#!/bin/bash
# Root-only setup, run by post-create.sh through sudo. Takes no arguments.
set -euo pipefail

# Named volumes and their mount points are created root-owned
for dir in /workspace /workspace/Dailu /workspace/Dailu/src /workspace/Dailu/src/frontend /workspace/Dailu/src/frontend/Dailu.ClientApp /workspace/Dailu/src/frontend/Dailu.ClientApp/node_modules \
    /home/dev/.nuget/packages /home/dev/.claude /home/dev/.ssh /home/dev/.git-credentials.d; do
    if [ -d "$dir" ]; then
        chown dev:dev "$dir"
    fi
done
chmod 0700 /home/dev/.ssh /home/dev/.git-credentials.d

# Rider's backend lives in jb_devcontainers_shared_volume, which every JetBrains dev container on this PC shares, and
# Rider leaves it world-writable. Make it read-only for dev, so code in this container can't change the backend
# that another container runs. Rider writes new backends there as root, so this doesn't stop updates.
JB_DIST=/.jbdevcontainer/JetBrains/RemoteDev/dist
if [ -d "$JB_DIST" ]; then
    chown -R root:root "$JB_DIST"
    chmod -R u+rwX,go+rX,go-w "$JB_DIST"
fi

# sshd for Rider's SSH connection (sshd-devcontainer.conf): host keys once, and the privilege separation directory.
# The host keys change when the container is recreated; ~/.ssh/config on your PC doesn't pin them (see the guide).
ssh-keygen -A
mkdir -p /run/sshd

# SSH sessions start with a clean environment. Copy the container's environment (compose "environment:" and the
# image's ENV, as seen by PID 1) to /etc/environment, which PAM loads for every SSH session.
# PID 1 runs as dev; root may not read another user's environ without CAP_SYS_PTRACE, so read it as dev.
runuser -u dev -- cat /proc/1/environ | tr '\0' '\n' \
    | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' \
    | grep -vE '^(HOME|HOSTNAME|PWD|SHLVL|TERM|_)=' \
    | grep -v "[\"']" \
    | sort > /etc/environment.new
chmod 0644 /etc/environment.new
mv -f /etc/environment.new /etc/environment

# Trust the host-exported ASP.NET Core dev certificate, so Web -> Auth HTTPS calls validate.
# It comes from the read-only /devcert mount, so code in the container can't replace it.
CERT=/devcert/localhost.pem
if [ -f "$CERT" ] && [ "$(grep -c 'BEGIN CERTIFICATE' "$CERT")" = "1" ] \
    && openssl x509 -in "$CERT" -noout -subject | grep -q 'CN *= *localhost'; then
    install -m 0644 "$CERT" /usr/local/share/ca-certificates/aspnetcore-localhost.crt
else
    echo "WARNING: $CERT missing or not a single localhost certificate; it is not trusted in the container" >&2
fi

# Trust the egress proxy's CA, so git accepts the decrypted github.com connection.
# It comes from a read-only volume. Accept it only if it is the proxy's CA and limited to github.com by name constraints.
CA=/egress-ca/ca.crt
if [ -f "$CA" ] && [ "$(grep -c 'BEGIN CERTIFICATE' "$CA")" = "1" ] \
    && openssl x509 -in "$CA" -noout -subject | grep -q 'CN *= *Dailu dev egress proxy CA' \
    && openssl x509 -in "$CA" -noout -ext nameConstraints | grep -qx ' *Permitted: *' \
    && [ "$(openssl x509 -in "$CA" -noout -ext nameConstraints | grep -c 'DNS:')" = "1" ] \
    && openssl x509 -in "$CA" -noout -ext nameConstraints | grep -q 'DNS:github.com$'; then
    install -m 0644 "$CA" /usr/local/share/ca-certificates/dailu-egress-ca.crt
else
    echo "WARNING: $CA missing or not the github.com-only egress CA; git can't reach GitHub" >&2
fi

update-ca-certificates
#!/bin/bash
# Forwards localhost:<port> inside the container to the docker-compose services, so the
# committed appsettings.Development.json values (localhost:5460, localhost:5672, ...) work unchanged.
set -euo pipefail

FORWARDS=(
    # Postgres is published on 5460 on the host; inside the compose network it listens on 5432
    "5460 dailo.postgres:5432"
    "5672 dailo.rabbitmq:5672"
    "15672 dailo.rabbitmq:15672"
)

LOG_DIR=/tmp/forward-services
mkdir -p "$LOG_DIR"

pkill -u "$(id -u)" -f "socat TCP-LISTEN" 2>/dev/null || true

for forward in "${FORWARDS[@]}"; do
    read -r port target <<< "$forward"
    nohup setsid socat "TCP-LISTEN:${port},bind=127.0.0.1,fork,reuseaddr" "TCP:${target}" \
        > "$LOG_DIR/${port}.log" 2>&1 < /dev/null &
    echo "localhost:${port} -> ${target}"
done

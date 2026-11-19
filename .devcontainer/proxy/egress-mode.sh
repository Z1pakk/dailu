#!/bin/sh
# Switches the egress proxy between "run" (allowlist.txt) and "setup" (allowlist.txt + allowlist-setup.txt).
# Run it from the HOST:  docker exec dailu.egress-proxy egress-mode setup
# The dev container can't run it: it has no Docker access.
set -eu

MODE="${1:-}"
LISTS="/etc/squid/allowlist.txt"

case "$MODE" in
    run) ;;
    setup) LISTS="$LISTS /etc/squid/allowlist-setup.txt" ;;
    *)
        echo "Usage: egress-mode run|setup" >&2
        exit 1
        ;;
esac

# shellcheck disable=SC2086
cat $LISTS | tr -d '\r' | grep -vE '^[[:space:]]*(#|$)' | sort -u > /etc/squid/active-allowlist.txt.new
mv /etc/squid/active-allowlist.txt.new /etc/squid/active-allowlist.txt
echo "$MODE" > /etc/squid/mode

if [ "${2:-}" != "--no-reload" ]; then
    if err="$(squid -k reconfigure 2>&1)"; then
        echo "egress-proxy: switched to $MODE mode"
    else
        echo "egress-proxy: reload failed: $err" >&2
        echo "egress-proxy: mode saved as $MODE; run 'docker restart dailu.egress-proxy' to apply it" >&2
    fi
fi
#!/bin/sh
# Switches the egress proxy between "run" (allowlist.txt) and "setup" (allowlist.txt + allowlist-setup.txt).
# Setup mode always ends by itself: after 30 minutes by default, or after the minutes you give.
# Run it from the HOST:
#   docker exec dailu.egress-proxy egress-mode setup        (30 minutes)
#   docker exec dailu.egress-proxy egress-mode setup 10     (10 minutes)
#   docker exec dailu.egress-proxy egress-mode run          (back to run mode now)
#   docker exec dailu.egress-proxy egress-mode status
# The dev container can't run it: it has no Docker access.
set -eu

MODE="${1:-}"
LISTS="/etc/squid/allowlist.txt"
STATE=/etc/squid
DEFAULT_MINUTES=30
MAX_MINUTES=480

usage() {
    echo "Usage: egress-mode run | setup [minutes, 1-$MAX_MINUTES, default $DEFAULT_MINUTES] | status" >&2
    exit 1
}

apply_lists() {
    # shellcheck disable=SC2086
    cat $1 | tr -d '\r' | grep -vE '^[[:space:]]*(#|$)' | sort -u > "$STATE/active-allowlist.txt.new"
    mv "$STATE/active-allowlist.txt.new" "$STATE/active-allowlist.txt"
}

reload() {
    if err="$(squid -k reconfigure 2>&1)"; then
        return 0
    fi
    echo "egress-proxy: reload failed: $err" >&2
    echo "egress-proxy: run 'docker restart dailu.egress-proxy' to apply the mode (it restarts in run mode)" >&2
    return 1
}

case "$MODE" in
    status)
        mode="$(cat "$STATE/mode" 2>/dev/null || echo run)"
        if [ "$mode" = "setup" ] && [ -f "$STATE/setup-until" ]; then
            left=$(( $(cat "$STATE/setup-until") - $(date +%s) ))
            if [ "$left" -lt 0 ]; then
                left=0
            fi
            echo "setup mode, back to run mode in $(( (left + 59) / 60 )) min"
        else
            echo "$mode mode"
        fi
        ;;

    run)
        # Cancels a pending setup timer: it only acts while its token is still current
        rm -f "$STATE/setup-token" "$STATE/setup-until"
        apply_lists "$LISTS"
        echo run > "$STATE/mode"
        if [ "${2:-}" = "--no-reload" ]; then
            exit 0
        fi
        if reload; then
            if [ "${2:-}" = "--expired" ]; then
                echo "egress-proxy: setup mode ended (time is up), back to run mode"
            else
                echo "egress-proxy: switched to run mode"
            fi
        fi
        ;;

    setup)
        minutes="${2:-$DEFAULT_MINUTES}"
        case "$minutes" in
            ''|*[!0-9]*) usage ;;
        esac
        if [ "$minutes" -lt 1 ] || [ "$minutes" -gt "$MAX_MINUTES" ]; then
            usage
        fi

        apply_lists "$LISTS /etc/squid/allowlist-setup.txt"
        echo setup > "$STATE/mode"
        token="$(date +%s%N)"
        echo "$token" > "$STATE/setup-token"
        echo $(( $(date +%s) + minutes * 60 )) > "$STATE/setup-until"

        # Timer: switches back to run mode unless a newer "setup" or a "run" came first.
        # Its messages go to PID 1's output, so they show in "docker logs".
        setsid sh -c '
            sleep "$1"
            if [ "$(cat /etc/squid/setup-token 2>/dev/null)" = "$2" ]; then
                /usr/local/bin/egress-mode run --expired
            fi
        ' egress-timer "$(( minutes * 60 ))" "$token" < /dev/null > /proc/1/fd/1 2>&1 &

        if reload; then
            echo "egress-proxy: switched to setup mode for $minutes min (then back to run mode by itself)"
        fi
        ;;

    *)
        usage
        ;;
esac

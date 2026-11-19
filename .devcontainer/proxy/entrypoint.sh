#!/bin/sh
# Starts Squid in the last used mode (run by default) and streams its logs to `docker logs`.
set -eu

CA_DIR=/var/lib/egress-ca
CA_PUBLIC_DIR=/var/lib/egress-ca-public

# Local CA for decrypting github.com traffic, created once per machine in the dailu-proxy-ca volume.
# The name constraints make it useless for any other site, even if its key leaked.
if [ ! -f "$CA_DIR/ca.key" ] || [ ! -f "$CA_DIR/ca.crt" ]; then
    echo "egress-proxy: creating the local egress CA"
    openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -sha256 \
        -subj "/CN=Dailu dev egress proxy CA" \
        -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
        -addext "keyUsage=critical,keyCertSign,cRLSign" \
        -addext "nameConstraints=critical,permitted;DNS:github.com" \
        -keyout "$CA_DIR/ca.key" -out "$CA_DIR/ca.crt"
fi
chown root:proxy "$CA_DIR/ca.key" "$CA_DIR/ca.crt"
chmod 0640 "$CA_DIR/ca.key"
chmod 0644 "$CA_DIR/ca.crt"

# The dev container trusts only this public copy (read-only mount); it never sees the key
cp "$CA_DIR/ca.crt" "$CA_PUBLIC_DIR/ca.crt"
chmod 0644 "$CA_PUBLIC_DIR/ca.crt"

# Cache for the github.com certificates Squid issues with the CA
if [ ! -d /var/spool/squid/ssl_db ]; then
    /usr/lib/squid/security_file_certgen -c -s /var/spool/squid/ssl_db -M 4MB
fi
chown -R proxy:proxy /var/spool/squid/ssl_db

MODE="$(cat /etc/squid/mode 2>/dev/null || echo run)"
egress-mode "$MODE" --no-reload
echo "egress-proxy: starting in $MODE mode"

touch /var/log/squid/access.log /var/log/squid/cache.log
chown proxy:proxy /var/log/squid/access.log /var/log/squid/cache.log
# cache.log already reaches docker logs through "-d 1" (stderr); only the access log needs streaming
tail -F /var/log/squid/access.log &

# The PID file survives "docker restart"; a stale one makes Squid think it is already running
rm -f /run/squid.pid

exec squid -N -d 1 -f /etc/squid/squid.conf

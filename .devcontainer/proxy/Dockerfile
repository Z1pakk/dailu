# Egress proxy for the Dailu dev container. Pin the digest.
FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc

RUN apt-get update \
    && apt-get install -y --no-install-recommends squid-openssl openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# The egress CA is not baked into the image: entrypoint.sh creates it once in the dailu-proxy-ca volume
RUN mkdir -p /var/lib/egress-ca /var/lib/egress-ca-public

COPY squid.conf allowlist.txt allowlist-setup.txt /etc/squid/
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY egress-mode.sh /usr/local/bin/egress-mode

# Strip Windows line endings in case the files were saved with CRLF
RUN sed -i 's/\r$//' /etc/squid/squid.conf /usr/local/bin/entrypoint.sh /usr/local/bin/egress-mode \
    && chmod 0755 /usr/local/bin/entrypoint.sh /usr/local/bin/egress-mode

EXPOSE 3128
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
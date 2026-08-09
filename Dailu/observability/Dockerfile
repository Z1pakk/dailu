FROM alpine:3.20

COPY otel-collector/otel-collector-config.yaml /config/otel-collector-config.yaml
COPY tempo/tempo.yaml /config/tempo.yaml
COPY prometheus/prometheus.yml /config/prometheus.yml
COPY loki/loki-config.yaml /config/loki-config.yaml
COPY grafana/provisioning /config/grafana/provisioning
COPY grafana/dashboards /config/grafana/dashboards

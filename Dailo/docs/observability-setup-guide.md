# Observability setup guide: OpenTelemetry + Prometheus + Tempo + Loki + Grafana

A step-by-step walkthrough for adding real, hand-wired observability to Dailo — first locally,
then in production behind Dokploy. Companion documents: the design rationale is in
[`docs/superpowers/specs/2026-08-05-observability-design.md`](superpowers/specs/2026-08-05-observability-design.md),
and this guide follows the same phases.

Each phase below is self-contained: do it, verify it with the given command/UI check, then
commit before moving to the next one. Don't skip ahead — later phases assume the earlier ones
are working.

---

## Phase 1: Wire OpenTelemetry traces into `Dailo.Api` (viewed via the Aspire dashboard)

No new infrastructure yet — this just gets the SDK emitting traces somewhere you can see them.

1. Replace the full contents of `Dailo.Api/DependencyInjection.cs` with:

   ```csharp
   using System.Reflection;
   using OpenTelemetry;
   using OpenTelemetry.Resources;
   using OpenTelemetry.Trace;

   namespace Dailo.Api;

   public static class DependencyInjection
   {
       public static WebApplicationBuilder AddObservability(this WebApplicationBuilder builder)
       {
           builder
               .Services.AddOpenTelemetry()
               .ConfigureResource(resource =>
               {
                   resource
                       .AddService(
                           serviceName: builder.Environment.ApplicationName,
                           serviceVersion: Assembly.GetEntryAssembly()?.GetName().Version?.ToString()
                               ?? "unknown"
                       )
                       .AddAttributes(
                           [
                               new KeyValuePair<string, object>(
                                   "deployment.environment",
                                   builder.Environment.EnvironmentName
                               ),
                           ]
                       );
               })
               .WithTracing(tracing =>
               {
                   tracing.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddNpgsql();
               })
               .UseOtlpExporter();

           return builder;
       }
   }
   ```

   `serviceVersion` and `deployment.environment` aren't required for a trace to work, but without
   them every signal from every environment carries the same identity — there's no way to filter
   Grafana down to "prod only" or tell which deploy a trace came from. Both are resource
   attributes, so they show up on every span/metric/log the SDK emits, not just this one.

   `Assembly.GetEntryAssembly()` (not `typeof(Program).Assembly`) is deliberate: it's a runtime
   lookup for whatever assembly actually started the process, so the same line works unchanged if
   this code ever moves into a shared library that doesn't have its own `Program` type — which is
   exactly what happened here, since the real implementation lives in
   `Dailo.Infrastructure.Observability.Setup`, not `Dailo.Api`.

2. In `Dailo.Api/Program.cs`, call it right after the builder is created:

   ```csharp
   var builder = WebApplication.CreateBuilder(args);

   builder.AddObservability();

   builder.Services.AddInfrastructure();
   ```

3. Run it: `dotnet run --project Dailo.AppHost`. Wait for the console to print the Aspire
   dashboard URL (`https://localhost:17XXX/login?t=...`) and open it.

4. From another terminal, hit the API (port 5055, per `AppHost.cs`):

   ```bash
   curl -k https://localhost:5055/auth/altcha-challenge
   ```

5. **Verify:** in the Aspire dashboard's **Traces** tab for the `api` resource, you should see a
   new trace for that request with an `AspNetCore` span. (No `Npgsql` span yet — this endpoint
   doesn't touch the database — that's expected.)

6. Commit.

---

## Phase 2: Add metrics and logs to the same pipeline

Still no new infrastructure — same Aspire dashboard, now receiving all three signal types.

1. Replace `Dailo.Api/DependencyInjection.cs` with:

   ```csharp
   using System.Reflection;
   using OpenTelemetry;
   using OpenTelemetry.Metrics;
   using OpenTelemetry.Resources;
   using OpenTelemetry.Trace;

   namespace Dailo.Api;

   public static class DependencyInjection
   {
       public static WebApplicationBuilder AddObservability(this WebApplicationBuilder builder)
       {
           builder
               .Services.AddOpenTelemetry()
               .ConfigureResource(resource =>
               {
                   resource
                       .AddService(
                           serviceName: builder.Environment.ApplicationName,
                           serviceVersion: Assembly.GetEntryAssembly()?.GetName().Version?.ToString()
                               ?? "unknown"
                       )
                       .AddAttributes(
                           [
                               new KeyValuePair<string, object>(
                                   "deployment.environment",
                                   builder.Environment.EnvironmentName
                               ),
                           ]
                       );
               })
               .WithTracing(tracing =>
               {
                   tracing.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddNpgsql();
               })
               .WithMetrics(metrics =>
               {
                   metrics
                       .AddAspNetCoreInstrumentation()
                       .AddHttpClientInstrumentation()
                       .AddRuntimeInstrumentation();
               })
               .UseOtlpExporter();

           builder.Logging.AddOpenTelemetry(options =>
           {
               options.IncludeFormattedMessage = true;
               options.IncludeScopes = true;
           });

           return builder;
       }
   }
   ```

2. Run `dotnet run --project Dailo.AppHost` and hit the endpoint a few times:

   ```bash
   curl -k https://localhost:5055/auth/altcha-challenge
   curl -k https://localhost:5055/auth/altcha-challenge
   curl -k https://localhost:5055/auth/altcha-challenge
   ```

3. **Verify:**
   - Aspire dashboard **Metrics** tab: request-duration and runtime (GC, thread pool) metrics.
   - Aspire dashboard **Structured logs** tab: log lines, each correlated to a trace ID matching
     a trace you can find in the Traces tab.

4. Commit.

---

## Phase 3: Stand up Collector + Tempo + Grafana locally, hand-wired

First piece of real infrastructure. All config below is yours to read and understand, not a
black box.

1. Create `observability/otel-collector/config.yaml`:

   ```yaml
   receivers:
     otlp:
       protocols:
         grpc:
           endpoint: 0.0.0.0:4317
         http:
           endpoint: 0.0.0.0:4318

   processors:
     memory_limiter:
       check_interval: 1s
       limit_mib: 400
       spike_limit_mib: 100
     batch: {}

   exporters:
     otlp/tempo:
       endpoint: tempo:4317
       tls:
         insecure: true

   service:
     pipelines:
       traces:
         receivers: [otlp]
         processors: [memory_limiter, batch]
         exporters: [otlp/tempo]
   ```

   `memory_limiter` caps how much data the Collector holds in memory before it starts refusing new
   data — without it, a traffic spike (or just this stack sharing a small VPS with everything else
   in Phase 7) can OOM-kill the container instead of degrading gracefully. It must be listed
   **first** in `processors:` so it can shed load before `batch` buffers more of it; `limit_mib`
   here is a starting point, not a measured value — Phase 7's "a week later" disk/memory check
   covers revisiting it once real usage is visible.

2. Create `observability/tempo/tempo.yaml`:

   ```yaml
   server:
     http_listen_port: 3200

   distributor:
     receivers:
       otlp:
         protocols:
           grpc:
           http:

   storage:
     trace:
       backend: local
       local:
         path: /var/tempo/traces
       wal:
         path: /var/tempo/wal

   compactor:
     compaction:
       block_retention: 72h
   ```

3. Create `observability/grafana/provisioning/datasources/datasources.yaml`:

   ```yaml
   apiVersion: 1

   datasources:
     - name: Tempo
       uid: tempo
       type: tempo
       access: proxy
       url: http://tempo:3200
       editable: false
   ```

4. Create `observability/docker-compose.yml`:

   ```yaml
   services:
     otel-collector:
       image: otel/opentelemetry-collector-contrib:0.114.0
       command: ["--config=/etc/otel-collector-config.yaml"]
       volumes:
         - ./otel-collector/config.yaml:/etc/otel-collector-config.yaml:ro
       ports:
         - "4317:4317"
         - "4318:4318"
       depends_on:
         - tempo

     tempo:
       image: grafana/tempo:2.6.1
       command: ["-config.file=/etc/tempo.yaml"]
       volumes:
         - ./tempo/tempo.yaml:/etc/tempo.yaml:ro
         - tempo-data:/var/tempo
       ports:
         - "3102:3200"

     grafana:
       image: grafana/grafana:11.3.1
       volumes:
         - ./grafana/provisioning:/etc/grafana/provisioning:ro
         - grafana-data:/var/lib/grafana
       ports:
         - "3100:3000"
       depends_on:
         - tempo

   volumes:
     tempo-data:
     grafana-data:
   ```

   Every container still listens on its own default port *inside* the Docker network — Grafana on
   `3000`, Tempo on `3200` — only the host side of each mapping changes here. Host port `3000` is
   commonly already taken by Dokploy itself, so this guide uses a `3100`/`3101`/`3102` block for
   Grafana/Loki/Tempo's host-side ports instead: easy to remember, and none of them collide with
   Dokploy or each other. Loki's host port moves to `3101` when it's added in Phase 5 — see that
   phase's note.

5. Redirect the API's OTLP export from Aspire's dashboard to your own Collector. Aspire still
   orchestrates Postgres locally, so keep running through `Dailo.AppHost` — just override the
   `api` resource's environment variable in `Dailo.AppHost/AppHost.cs`:

   ```csharp
   IDistributedApplicationBuilder builder = DistributedApplication.CreateBuilder(args);

   IResourceBuilder<PostgresServerResource> db = builder
       .AddPostgres("dailo-db")
       .WithLifetime(ContainerLifetime.Persistent);

   builder
       .AddProject<Projects.Dailo_Api>("api")
       .WithHttpsEndpoint(port: 5055)
       .WithReference(db)
       .WaitFor(db)
       .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317");

   await builder.Build().RunAsync();
   ```

6. Run everything:

   ```bash
   docker compose -f observability/docker-compose.yml up -d
   dotnet run --project Dailo.AppHost
   ```

   ```bash
   curl -k https://localhost:5055/auth/altcha-challenge
   ```

7. **Verify:** open `http://localhost:3100` (Grafana — default login `admin`/`admin`, it'll ask
   you to change it). Go to **Explore** → select the **Tempo** datasource → search recent
   traces. You should see the same trace structure you saw in Aspire's dashboard, now flowing
   through your own Collector config.

8. Commit.

---

## Phase 4: Add Prometheus (metrics)

1. Replace `observability/otel-collector/config.yaml` with:

   ```yaml
   receivers:
     otlp:
       protocols:
         grpc:
           endpoint: 0.0.0.0:4317
         http:
           endpoint: 0.0.0.0:4318

   processors:
     memory_limiter:
       check_interval: 1s
       limit_mib: 400
       spike_limit_mib: 100
     batch: {}

   exporters:
     otlp/tempo:
       endpoint: tempo:4317
       tls:
         insecure: true
     prometheus:
       endpoint: 0.0.0.0:8889

   service:
     pipelines:
       traces:
         receivers: [otlp]
         processors: [memory_limiter, batch]
         exporters: [otlp/tempo]
       metrics:
         receivers: [otlp]
         processors: [memory_limiter, batch]
         exporters: [prometheus]
   ```

2. Create `observability/prometheus/prometheus.yml`:

   ```yaml
   global:
     scrape_interval: 15s

   scrape_configs:
     - job_name: otel-collector
       static_configs:
         - targets: ["otel-collector:8889"]
   ```

3. In `observability/docker-compose.yml`, add a `prometheus` service:

   ```yaml
     prometheus:
       image: prom/prometheus:v3.0.1
       command:
         - "--config.file=/etc/prometheus/prometheus.yml"
         - "--storage.tsdb.retention.time=7d"
         - "--storage.tsdb.retention.size=2GB"
       volumes:
         - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
         - prometheus-data:/prometheus
       ports:
         - "9090:9090"
       depends_on:
         - otel-collector
   ```

   And add `prometheus-data:` to the top-level `volumes:` key.

4. Add Prometheus as a second Grafana datasource — `observability/grafana/provisioning/datasources/datasources.yaml`:

   ```yaml
   apiVersion: 1

   datasources:
     - name: Tempo
       uid: tempo
       type: tempo
       access: proxy
       url: http://tempo:3200
       editable: false

     - name: Prometheus
       uid: prometheus
       type: prometheus
       access: proxy
       url: http://prometheus:9090
       editable: false
   ```

5. Run:

   ```bash
   docker compose -f observability/docker-compose.yml up -d
   curl http://localhost:9090/api/v1/query?query=up
   ```

   **Verify:** the response includes a result for `job="otel-collector"` with value `1`.

6. Generate some traffic and check a real query. With the app still running:

   ```bash
   curl -k https://localhost:5055/auth/altcha-challenge
   ```

   Wait ~30 seconds, then in Grafana → Explore → Prometheus, run:

   ```
   histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le))
   ```

   **Verify:** a non-empty series. If the metric name doesn't match (instrumentation metric
   names occasionally change between package versions), browse `{__name__=~"http_server.*"}` in
   Explore first and adjust the query to whatever's actually there.

7. Commit.

---

## Phase 5: Add Loki (logs) and trace correlation

This is the phase where the three signals actually connect to each other.

1. Create `observability/loki/loki-config.yaml`:

   ```yaml
   auth_enabled: false

   server:
     http_listen_port: 3100

   common:
     path_prefix: /loki
     storage:
       filesystem:
         chunks_directory: /loki/chunks
         rules_directory: /loki/rules
     replication_factor: 1
     ring:
       kvstore:
         store: inmemory

   schema_config:
     configs:
       - from: 2024-01-01
         store: tsdb
         object_store: filesystem
         schema: v13
         index:
           prefix: index_
           period: 24h

   limits_config:
     retention_period: 168h

   compactor:
     working_directory: /loki/compactor
     retention_enabled: true
   ```

2. Replace `observability/otel-collector/config.yaml` with (adds a logs exporter + pipeline):

   ```yaml
   receivers:
     otlp:
       protocols:
         grpc:
           endpoint: 0.0.0.0:4317
         http:
           endpoint: 0.0.0.0:4318

   processors:
     memory_limiter:
       check_interval: 1s
       limit_mib: 400
       spike_limit_mib: 100
     batch: {}

   exporters:
     otlp/tempo:
       endpoint: tempo:4317
       tls:
         insecure: true
     prometheus:
       endpoint: 0.0.0.0:8889
     otlphttp/loki:
       endpoint: http://loki:3100/otlp
       tls:
         insecure: true

   service:
     pipelines:
       traces:
         receivers: [otlp]
         processors: [memory_limiter, batch]
         exporters: [otlp/tempo]
       metrics:
         receivers: [otlp]
         processors: [memory_limiter, batch]
         exporters: [prometheus]
       logs:
         receivers: [otlp]
         processors: [memory_limiter, batch]
         exporters: [otlphttp/loki]
   ```

3. In `observability/docker-compose.yml`, add a `loki` service:

   ```yaml
     loki:
       image: grafana/loki:3.3.2
       command: ["-config.file=/etc/loki/loki-config.yaml"]
       volumes:
         - ./loki/loki-config.yaml:/etc/loki/loki-config.yaml:ro
         - loki-data:/loki
       ports:
         - "3101:3100"
   ```

   Loki still listens on `3100` inside its own container (`loki-config.yaml`'s
   `http_listen_port` is unchanged, and Grafana's Loki datasource keeps talking to
   `http://loki:3100` over the Docker network either way) — only the host-side port moves, to
   `3101`, since `3100` now belongs to Grafana per the Phase 3 note.

   And add `loki-data:` to the top-level `volumes:` key.

4. Add Loki as a Grafana datasource with a trace-ID link — replace
   `observability/grafana/provisioning/datasources/datasources.yaml` with:

   ```yaml
   apiVersion: 1

   datasources:
     - name: Tempo
       uid: tempo
       type: tempo
       access: proxy
       url: http://tempo:3200
       editable: false

     - name: Prometheus
       uid: prometheus
       type: prometheus
       access: proxy
       url: http://prometheus:9090
       editable: false

     - name: Loki
       uid: loki
       type: loki
       access: proxy
       url: http://loki:3100
       editable: false
       jsonData:
         derivedFields:
           - datasourceUid: tempo
             matcherRegex: 'trace_id=(\w+)'
             name: TraceID
             url: '$${__value.raw}'
   ```

5. Run and generate a request:

   ```bash
   docker compose -f observability/docker-compose.yml up -d
   curl -k https://localhost:5055/auth/altcha-challenge
   ```

6. **Verify:** in Grafana → Explore → Loki, query:

   ```
   {service_name="Dailo.Api"}
   ```

   You should see log lines from the request. Click one to expand it and look at its fields —
   there should be a trace ID field (Loki's OTLP ingestion exposes it as structured metadata,
   usually `trace_id`). If a "Tempo" link button doesn't show up automatically, note the exact
   field name Loki assigned and adjust `matcherRegex`/`name` in the datasource config above to
   match it — the config here is the right starting point, but the exact field name can vary
   slightly by Loki version.

7. Commit.

---

## Phase 6: Build one dashboard by hand

1. Create `observability/grafana/provisioning/dashboards/dashboards.yaml`:

   ```yaml
   apiVersion: 1

   providers:
     - name: Dailo
       orgId: 1
       folder: ""
       type: file
       disableDeletion: false
       updateIntervalSeconds: 30
       options:
         path: /etc/grafana/provisioning/dashboards/json
   ```

2. Create `observability/grafana/dashboards/dailo-overview.json`:

   ```json
   {
     "title": "Dailo Overview",
     "uid": "dailo-overview",
     "schemaVersion": 39,
     "version": 1,
     "refresh": "30s",
     "time": { "from": "now-1h", "to": "now" },
     "panels": [
       {
         "id": 1,
         "title": "p95 request latency",
         "type": "timeseries",
         "gridPos": { "h": 8, "w": 24, "x": 0, "y": 0 },
         "datasource": { "type": "prometheus", "uid": "prometheus" },
         "targets": [
           {
             "datasource": { "type": "prometheus", "uid": "prometheus" },
             "expr": "histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le))",
             "legendFormat": "p95",
             "refId": "A"
           }
         ]
       },
       {
         "id": 2,
         "title": "Recent logs",
         "type": "logs",
         "gridPos": { "h": 8, "w": 24, "x": 0, "y": 8 },
         "datasource": { "type": "loki", "uid": "loki" },
         "targets": [
           {
             "datasource": { "type": "loki", "uid": "loki" },
             "expr": "{service_name=\"Dailo.Api\"}",
             "refId": "A"
           }
         ]
       }
     ]
   }
   ```

3. In `observability/docker-compose.yml`, mount the dashboards directory into the `grafana`
   service:

   ```yaml
     grafana:
       image: grafana/grafana:11.3.1
       volumes:
         - ./grafana/provisioning:/etc/grafana/provisioning:ro
         - ./grafana/dashboards:/etc/grafana/provisioning/dashboards/json:ro
         - grafana-data:/var/lib/grafana
       ports:
         - "3100:3000"
       depends_on:
         - tempo
   ```

4. Run it, then generate a few spaced-out requests so `rate()` has data:

   ```bash
   docker compose -f observability/docker-compose.yml up -d
   for i in 1 2 3 4 5; do curl -k https://localhost:5055/auth/altcha-challenge; sleep 5; done
   ```

5. **Verify:** open `http://localhost:3100` → Dashboards → **Dailo Overview**. Both panels
   should render: a latency line and recent log lines. If the latency panel says "No data,"
   check the real metric name at `http://localhost:9090/graph` (search `http_server`) and fix
   the panel's `expr` to match.

6. Commit.

---

## Phase 7: Ship it to production via Dokploy

1. Create `observability/docker-compose.override.prod.yml` — a fully standalone file (matches
   how `dailu-api`/`dailu-frontend` are already deployed at the repo root, not a merge-override).
   This mirrors the local `observability/docker-compose.yml` built up through Phases 1–6,
   including the file-storage permission fix and non-nested dashboards mount, with
   production-specific networking and hardening:

   ```yaml
   name: dailu-observability

   services:
     otel-collector-storage-init:
       image: busybox
       restart: "no"
       command: ["sh", "-c", "chown -R 10001:10001 /var/lib/otelcol/file_storage"]
       volumes:
         - otel-collector-storage:/var/lib/otelcol/file_storage

     otel-collector:
       image: otel/opentelemetry-collector-contrib:0.158.0
       command: ["--config=/etc/otel-collector-config.yaml"]
       restart: unless-stopped
       volumes:
         - ./otel-collector/otel-collector-config.yaml:/etc/otel-collector-config.yaml:ro
         - otel-collector-storage:/var/lib/otelcol/file_storage
       depends_on:
         otel-collector-storage-init:
           condition: service_completed_successfully
       networks:
         - default
         - dokploy-network

     tempo:
       image: grafana/tempo:2.10.7
       command: ["-config.file=/etc/tempo.yaml"]
       restart: unless-stopped
       volumes:
         - ./tempo/tempo.yaml:/etc/tempo.yaml:ro
         - tempo-data:/var/tempo
       networks:
         - default
         - dokploy-network

     prometheus:
       image: prom/prometheus:v3.13.2
       command:
         - "--config.file=/etc/prometheus/prometheus.yml"
         - "--storage.tsdb.retention.time=7d"
         - "--storage.tsdb.retention.size=2GB"
       restart: unless-stopped
       volumes:
         - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
         - prometheus-data:/prometheus
       networks:
         - default
         - dokploy-network

     loki:
       image: grafana/loki:3.7.6
       command: ["-config.file=/etc/loki/loki-config.yaml"]
       restart: unless-stopped
       volumes:
         - ./loki/loki-config.yaml:/etc/loki/loki-config.yaml:ro
         - loki-data:/loki
       networks:
         - default
         - dokploy-network

     grafana:
       image: grafana/grafana:13.1.3
       restart: unless-stopped
       environment:
         GF_SERVER_ROOT_URL: ${GRAFANA_ROOT_URL:?GRAFANA_ROOT_URL is required}
         GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:?GRAFANA_ADMIN_PASSWORD is required}
         GF_AUTH_ANONYMOUS_ENABLED: "false"
         GF_USERS_ALLOW_SIGN_UP: "false"
       volumes:
         - ./grafana/provisioning:/etc/grafana/provisioning:ro
         - ./grafana/dashboards:/etc/grafana/dashboards:ro
         - grafana-data:/var/lib/grafana
       ports:
         - "3100:3000"
       networks:
         - default
         - dokploy-network
       depends_on:
         - tempo
         - prometheus
         - loki

   networks:
     dokploy-network:
       external: true

   volumes:
     tempo-data:
     prometheus-data:
     loki-data:
     grafana-data:
     otel-collector-storage:
   ```

   `grafana` is the only service with a `ports:` mapping — the other four need no host port at
   all; `dailu-api` reaches the Collector purely over `dokploy-network` by service name. This is
   deliberately *not* routed through Dokploy's Traefik/domain feature: assigning a domain there is
   a per-service action in the Dokploy UI with nothing in this compose file stopping someone from
   later assigning one to `tempo`/`loki`/`prometheus` too — and those three have zero built-in
   auth, so that mistake would fully expose all traces/logs/metrics with no login required. Using
   a plain `ports:` mapping instead keeps "only Grafana is reachable" a fact of the compose file
   itself, not a habit someone has to remember in a separate UI.

   Grafana's port is **not** bound to a specific Tailscale IP in Docker (`"3100:3000"`, not
   `"${TAILSCALE_IP}:3100:3000"`) — it's published normally, and access is restricted at the host
   firewall instead, scoped to the `tailscale0` interface/tailnet CIDR. That's the same mechanism
   `step-ca` (8443) and `sshd` (22) already use on this host
   ([ADR 009](adr/009_production_vpn.md)), just applied via firewall rules rather than Docker's
   own IP-binding — set that rule up yourself on the Hetzner host (see step 4a). `3100`, not
   `3000`, is used for the host port since Dokploy's own UI already occupies `3000` on this host,
   same reasoning as the local Phase 3 setup. The `GF_AUTH_ANONYMOUS_ENABLED`/
   `GF_USERS_ALLOW_SIGN_UP` hardening stays regardless — Grafana's own login is the backstop if the
   firewall rule is ever misconfigured.

   `otel-collector-storage-init` reuses the same non-root-image permission fix from local Phase 3:
   `otel/opentelemetry-collector-contrib` runs as UID `10001` and has no shell, so a fresh named
   volume needs its ownership fixed by a separate container before the Collector can write its
   persistent queue to it.

2. In the root `docker-compose.override.prod.yml`, add one line to `dailu-api`'s
   `environment:` block:

   ```yaml
         OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317
   ```

3. Commit both files.

4. **Deploy manually** (this touches live production infra, the host firewall, and Infisical
   secrets — do this yourself, not via an agent):

   a. SSH to the Hetzner host and run `tailscale ip -4` — note the output; it's needed both to
      compute `GRAFANA_ROOT_URL` below and for the firewall rule in step (b).

   b. Add a firewall rule restricting host port `3100` to the `tailscale0` interface/tailnet
      CIDR, the same mechanism already protecting `step-ca` (8443) and `sshd` (22)
      ([ADR 009](adr/009_production_vpn.md)) — use whatever firewall tool those existing rules
      use on this host, mirroring their scope for consistency. Docker publishes container ports
      by inserting its own `iptables`/nftables rules ahead of most default-deny setups, so if the
      existing rules were written assuming that ordering, verify this new one actually takes
      effect against Docker-published ports before moving on — don't just assume it composes the
      same way a plain host-process rule would.

   c. In the Dokploy UI, create a new **Compose** application (e.g. `dailo-observability`)
      pointing at this repo with compose file path `observability/docker-compose.override.prod.yml`,
      and enable **Auto Deploy**. Unlike `dailu-api`/`dailu-frontend`, nothing here needs a CI
      build step — every image is off-the-shelf and versioned by tag, and all that changes on a
      push is mounted config, so Dokploy's own git-pull-and-restart is sufficient; no GitHub
      Actions job needed. Don't assign a domain to any service here — access is via the
      firewall-scoped port from step (b), not Dokploy's Traefik.

   d. Set its environment variables (values sourced from Infisical per
      [ADR 007](adr/007_secrets_management.md)):
      - `GRAFANA_ROOT_URL` — e.g. `http://<TAILSCALE_IP>:3100`
      - `GRAFANA_ADMIN_PASSWORD` — a generated strong password

   e. Deploy. Confirm all six containers (`otel-collector-storage-init` exits 0,
      `otel-collector`, `tempo`, `prometheus`, `loki`, `grafana`) show healthy in the Dokploy UI.

   f. Redeploy the existing `dailu-api` Dokploy application so it picks up the new
      `OTEL_EXPORTER_OTLP_ENDPOINT` env var from step 2.

   g. Verify network isolation. From a device on the tailnet:

      ```bash
      curl http://<TAILSCALE_IP>:3100
      ```

      should return Grafana's login page. From a device **not** on the tailnet:

      ```bash
      curl --max-time 5 http://<hetzner-public-ip>:3100
      ```

      should time out.

5. **A week later:** check disk usage on the host (`df -h`). If Tempo/Loki/Prometheus volumes
   are growing faster than expected, tighten `block_retention` / `retention_period` /
   `--storage.tsdb.retention.*` below the defaults set above. Also check the `otel-collector`
   container's actual memory usage (`docker stats otel-collector`) against
   `processors.memory_limiter.limit_mib`/`spike_limit_mib` in `otel-collector/config.yaml` — the
   400/100 MiB set in Phase 3 was a starting guess, not a measured value; raise or lower it to
   match what the container actually needs alongside everything else on the box.

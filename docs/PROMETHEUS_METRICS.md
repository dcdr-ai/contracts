# Prometheus metrics (DCDR Runtime)

This document describes the Prometheus metrics exported by **DCDR Runtime**.

## Scrape endpoint

- Endpoint: `GET /api/system/metrics`
- Content-Type: Prometheus text exposition format
- Notes:
  - By default, runtime mounts `/api/system/*` without API token middleware. If you want to restrict access, do it at your ingress / reverse proxy.
  - The TypeScript client method `DcdrRuntimeClient.metrics()` calls this endpoint and returns the raw text.

## Metric namespaces

The runtime exports two namespaces:

- `dcdr_runtime_*`: DCDR-specific runtime metrics (documented below)
- `dcdr_runtime_node_*`: default Node.js / process metrics collected by `prom-client` (see “Node.js default metrics”)

All metrics include a default label:

- `host`: the container/host hostname

## DCDR runtime metrics (`dcdr_runtime_*`)

### Build and host health

- `dcdr_runtime_build_info{version}` (Gauge)
  - Value: always `1`
  - Labels:
    - `version`: build identifier (e.g. `v20250823.2`)

- `dcdr_runtime_availability_score` (Gauge)
  - Value: availability score in the range `0..100`

- `dcdr_runtime_effective_weight_score` (Gauge)
  - Value: effective node score (currently described as `1..256`)

- `dcdr_runtime_redis_connected` (Gauge)
  - Value: `1` when Redis is connected, otherwise `0`

- `dcdr_runtime_host_free_mem_gb` (Gauge)
  - Value: free memory in GB

- `dcdr_runtime_host_total_mem_gb` (Gauge)
  - Value: total memory in GB

- `dcdr_runtime_host_load1m` (Gauge)
  - Value: 1-minute load average (raw)

- `dcdr_runtime_host_normalized_load1m` (Gauge)
  - Value: 1-minute load average normalized by CPU cores

- `dcdr_runtime_killed_signal_received` (Gauge)
  - Value: `1` if the container has received a kill signal, otherwise `0`

### Multi-tenant and auth snapshot cache

These metrics are intentionally designed to keep label cardinality bounded.

- `dcdr_runtime_tenants_total` (Gauge)
  - Value: number of tenant entries currently present in memory (includes internal tenant)

- `dcdr_runtime_tenants_with_registry_total` (Gauge)
  - Value: number of tenants that currently have a registry snapshot loaded in memory

- `dcdr_runtime_entitlements_cache_entries_total` (Gauge)
  - Value: number of entitlements cache entries in memory

- `dcdr_runtime_entitlements_cache_with_data_total` (Gauge)
  - Value: number of entitlements cache entries that currently have a snapshot

- `dcdr_runtime_service_tokens_snapshot_cache_entries_total` (Gauge)
  - Value: number of service token snapshot cache entries in memory

- `dcdr_runtime_service_tokens_snapshot_cache_with_data_total` (Gauge)
  - Value: number of service token snapshot cache entries that currently have a snapshot

- `dcdr_runtime_service_tokens_snapshot_tokens_total` (Gauge)
  - Value: total number of token items across all cached snapshots

- `dcdr_runtime_service_token_snapshot_fetch_total{status}` (Counter)
  - Value: total snapshot fetch outcomes for service token snapshots
  - Labels:
    - `status`: fetch outcome (bounded set)

- `dcdr_runtime_service_token_allowlist_total{result}` (Counter)
  - Value: total allowlist decisions for service token validation
  - Labels:
    - `result`: allow/deny reason (bounded set)

### HTTP request metrics

These metrics provide a stable overview of runtime HTTP traffic.

- `dcdr_runtime_http_requests_total{method,route,code}` (Counter)
  - Value: total HTTP requests
  - Labels:
    - `method`: HTTP method
    - `route`: normalized route template (keeps cardinality bounded)
    - `code`: HTTP status code

- `dcdr_runtime_http_request_duration_seconds{method,route,code}` (Histogram)
  - Value: request latency distribution in seconds
  - Labels: `method`, `route`, `code`
  - Buckets: `[0.05, 0.1, 0.2, 0.5, 1, 2, 5]`

- `dcdr_runtime_api_requests_total{route,method,code}` (Counter)
  - Value: total API requests (app-level)
  - Labels: `route`, `method`, `code`

### Registry model / implementation metrics

These metrics track the **in-memory registry** and model call outcomes.

#### Registry synchronization

- `dcdr_runtime_model_active{intent,model,provider}` (Gauge)
  - Value: `1` if this implementation is currently active, otherwise `0`

- `dcdr_runtime_model_last_seen_timestamp{intent,model,provider}` (Gauge)
  - Value: Unix timestamp (seconds) for last time the implementation was seen during a backend registry sync

#### End-to-end (logical) model calls

A “model call” here means the **end-to-end** intent execution against a chosen implementation, after retries/fallback have completed.

- `dcdr_runtime_model_calls_total{intent,model,provider,outcome}` (Counter)
  - Labels:
    - `intent`: intent name
    - `model`: model identifier
    - `provider`: provider identifier
    - `outcome`: `success | error | timeout | rejected | circuit_open`

- `dcdr_runtime_model_call_duration_seconds{intent,model,provider,outcome}` (Histogram)
  - Latency of end-to-end model calls (seconds)
  - Buckets: `[0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 40, 80]`

- `dcdr_runtime_model_retries_total{intent,model,provider}` (Counter)
  - Total retries consumed for model calls (sum of retry attempts)

- `dcdr_runtime_model_failures_total{intent,model,provider,error_class}` (Counter)
  - Total model failures by error class
  - Labels:
    - `error_class`: bounded classification (never raw messages)

#### Attempt-level provider calls

An “attempt” here means a **single provider request** against an implementation (so retries/fallback increase attempts).

- `dcdr_runtime_model_attempts_total{intent,model,provider,outcome}` (Counter)

- `dcdr_runtime_model_attempt_duration_seconds{intent,model,provider,outcome}` (Histogram)
  - Buckets: `[0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 40, 80]`

- `dcdr_runtime_model_attempt_retries_total{intent,model,provider}` (Counter)
  - Total retries consumed per implementation (attempt number > 1 for that impl)

### Cache metrics

- `dcdr_runtime_cache_access_total{host,intent,model,provider,level,result}` (Counter)
  - Tracks cache hits/misses per cache level.
  - Labels:
    - `level`: `L1 | L2`
    - `result`: `hit | miss`

### Gateway error + overhead metrics

These help separate **gateway overhead** from **provider time**.

- `dcdr_runtime_gateway_errors_total{intent,error_code}` (Counter)
  - Errors produced before a provider/model attempt is executed (validation/config/routing)

- `dcdr_runtime_gateway_overhead_duration_seconds{intent,outcome}` (Histogram)
  - Gateway overhead excluding provider calls (validation, prompt render, routing, response build)
  - Buckets: `[0.001, 0.0025, 0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2]`

- `dcdr_runtime_gateway_pre_provider_duration_seconds{intent}` (Histogram)
  - Time spent in gateway before first provider call

- `dcdr_runtime_provider_total_duration_seconds{intent}` (Histogram)
  - Sum of provider execution durations across attempts (includes retries/fallback)

## Node.js default metrics (`dcdr_runtime_node_*`)

The runtime enables `prom-client` default collectors with the prefix `dcdr_runtime_node_`.

This typically includes process + Node runtime metrics such as:

- CPU time counters
- memory gauges (RSS / heap)
- event loop lag
- GC stats (if enabled by `prom-client` / Node version)

Because the exact metric set can change between Node/prom-client versions, treat these as *platform metrics*.

To see the full set in your environment:

```bash
curl -sS http://localhost:8000/api/system/metrics | grep '^dcdr_runtime_node_'
```

## Cardinality guidance (important)

Prometheus works best when label cardinality is bounded.

- Do not add labels like `customerId`, raw URLs, prompt text, or raw error messages.
- Prefer a small enum-like label (e.g. `outcome`, `error_class`).
- Prefer route templates (e.g. `/api/execution/run/:intent`) instead of raw paths.

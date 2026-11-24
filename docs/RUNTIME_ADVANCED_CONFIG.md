# Runtime advanced configuration

Advanced configuration options for DCDR Runtime (self-hosted) via environment variables.

## SSL / HTTPS (Runtime (self-hosted))

The runtime can serve HTTPS when you provide a certificate + private key file.

- `BACKEND_SSL_CERT`: absolute path (inside the container) to the TLS certificate file.
- `BACKEND_SSL_KEY`: absolute path (inside the container) to the TLS private key file.

Behavior

- If both are set and both files exist, the runtime starts an HTTPS server.
- Otherwise it falls back to HTTP.

Example (Docker)

```bash
docker run --rm -p 8443:8000 \
  -e BACKEND_SSL_CERT=/certs/tls.crt \
  -e BACKEND_SSL_KEY=/certs/tls.key \
  -v "$PWD/certs:/certs:ro" \
  dcdrai/runtime:latest
```

## Networking

- `BACKEND_PORT` (default `8000`): HTTP/HTTPS port the runtime listens on.

## API surface

- `REQUEST_SIZE_LIMIT` (default `50mb`): JSON body size limit for incoming requests.
- `ENABLE_SWAGGER` (default `true`): enables Swagger UI + OpenAPI endpoints.

## Auth and session validation

- `API_TOKEN` (default: built-in UUID): internal/dev API token (sent as `token: ...`).
- `ALLOW_SESSION_BYPASS` (default `false`): allows `x-session-bypass` for dev/testing when explicitly enabled.
- `SESSION_BYPASS_TOKEN` (optional): the expected `x-session-bypass` value.

## Tenant entitlements (DCDR Cloud and DCDR installs)

When the runtime serves customer traffic, it reads each tenant's entitlements (plan, quotas, subscription
state) from the DCDR control plane and caches them.

- `TENANT_ENTITLEMENTS_MAX_AGE_MS` (default 5 minutes): how long a cached snapshot is used before it is refreshed.
- `TENANT_ENTITLEMENTS_STALE_MAX_AGE_MS` (default 10 minutes): how old a cached snapshot may be and still be used
  while the control plane cannot be reached.
- `TENANT_ENTITLEMENTS_FAIL_CLOSED` (default: closed): when the control plane cannot be reached and no usable
  snapshot is cached, customer requests are refused with HTTP `503`. **Only the exact value `false` opens it**
  and lets requests through without entitlements; unset, blank or any other value (`0`, `no`, `False`, a typo)
  keeps it closed.

**A DCDR install must never run with `TENANT_ENTITLEMENTS_FAIL_CLOSED` set to anything but `true`.** Leave it
unset (the DCDR installer does). Fail-closed is what keeps an install's licence, plan and quotas in force
while the control plane is unreachable; opening it means customer traffic runs with no limits and no
licence check for as long as the outage lasts.

## Managed asset storage on a DCDR install

On a DCDR install (private cloud or on premises) the runtime keeps the assets it manages for itself in
the install's own file store: an S3-compatible store (the install's MinIO, or your S3) or Google Cloud
Storage. The DCDR installer sets these for you. Leave `DCDR_ASSET_STORAGE_PROVIDER` unset to keep the
default storage.

| Variable | Description |
| --- | --- |
| `DCDR_ASSET_STORAGE_PROVIDER` | `s3` or `gcs`. Turns the install store on. |
| `DCDR_ASSET_STORAGE_BUCKET` | Bucket (required). |
| `DCDR_ASSET_STORAGE_PREFIX` | The runtime's folder in the bucket, e.g. `assets` (required; no leading or trailing slash). |
| `DCDR_ASSET_STORAGE_S3_ENDPOINT` | S3 endpoint origin, e.g. `http://minio:9000`. Empty = AWS. |
| `DCDR_ASSET_STORAGE_S3_PUBLIC_ENDPOINT` | Public origin of the same store, if browsers reach it at another address. Defaults to the endpoint. |
| `DCDR_ASSET_STORAGE_S3_REGION` | Region (default `us-east-1`). |
| `DCDR_ASSET_STORAGE_S3_FORCE_PATH_STYLE` | `true` / `false` (default `true` when an endpoint is set). |
| `DCDR_ASSET_STORAGE_S3_ACCESS_KEY_ID_FILE` | Path to a file holding the access key id (e.g. a Docker secret). Required for `s3`. |
| `DCDR_ASSET_STORAGE_S3_SECRET_ACCESS_KEY_FILE` | Path to a file holding the secret access key. Required for `s3`. |
| `DCDR_ASSET_STORAGE_GCS_CREDENTIALS_FILE` | Path to a service account JSON key. Required for `gcs`. |
| `DCDR_ASSET_STORAGE_SIGNED_URL_TTL_SECONDS` | Lifetime of the signed links the runtime creates (default `900`). |

Behavior

- A missing or invalid variable stops the runtime at startup, with a message naming the variable.
- Keys are read from the files only, never from environment values.
- Signed links to the runtime's own files in an S3-compatible install store can be used as `URL`
  input parts: the runtime fetches them itself, even when the store is only reachable inside the install.

## OpenTelemetry receivers (`/v1/traces`, `/v1/logs`)

Available with the control plane only (not in `--registry` mode). Defaults suit most installs; see
[TELEMETRY.md](TELEMETRY.md) for what the endpoints do.

Request limits (a request over a size limit is refused whole with `413`):

- `DCDR_TELEMETRY_MAX_BODY_BYTES` (default `5242880`, 5 MB): request body as received (compressed).
- `DCDR_TELEMETRY_BODY_READ_TIMEOUT_MS` (default `30000`): time to receive a whole body; past it the request is answered `408` and the connection closed.
- `DCDR_TELEMETRY_MAX_DECOMPRESSED_BYTES` (default `20971520`, 20 MB): body after gzip / deflate.
- `DCDR_TELEMETRY_MAX_ITEMS` (default `2000`): spans or log records per request.
- `DCDR_TELEMETRY_MAX_VALUES` (default `500000`): decoded attribute values per request.
- `DCDR_TELEMETRY_MAX_DEPTH` (default `32`): attribute nesting depth.
- `DCDR_TELEMETRY_MAX_SPAN_AGE_MS` (default `2592000000`, 30 days): older spans are rejected.
- `DCDR_TELEMETRY_MAX_FUTURE_SKEW_MS` (default `300000`, 5 minutes): spans starting further in the future are rejected.

Rate limit per service token (answers `429` with `Retry-After`; never bans):

- `DCDR_TELEMETRY_RATE_LIMIT_PER_SECOND` (default `20`; `0` disables): sustained requests per second.
- `DCDR_TELEMETRY_RATE_LIMIT_BURST` (default `200`): burst allowance.
- `DCDR_TELEMETRY_MAX_CONCURRENT_DECODES_PER_TENANT` (default `4`): requests of one workspace read and decoded at the same time; past it `429` with `Retry-After: 1`.

Telemetry configuration from the control plane:

- `DCDR_TELEMETRY_SERVICES_SNAPSHOT_PATH` (default `/api/dcdr/telemetry/services_snapshot`).
- `DCDR_TELEMETRY_SNAPSHOT_TTL_MS` (default `30000`): how long a workspace's configuration is reused before it is revalidated.
- `DCDR_TELEMETRY_SNAPSHOT_MAX_STALE_MS` (default `600000`): how long a cached configuration keeps being used while the control plane cannot be reached; past it the receivers answer `503`.
- `DCDR_TELEMETRY_UNKNOWN_CUSTOMER_TTL_MS` (default `30000`): how long a "workspace not found" answer is reused.
- `DCDR_TELEMETRY_SNAPSHOT_RETRY_BACKOFF_MS` (default `30000`): after a failed refresh, how long the cached configuration is served without asking the control plane again.

Pipeline to the control plane:

- `DCDR_TELEMETRY_PATH` (default `/api/dcdr/telemetry`): ingest route.
- `DCDR_TELEMETRY_JOIN_WINDOW_MS` (default `10000`): how long a span waits for the log records that carry its content (and the other way round).
- `DCDR_TELEMETRY_JOIN_MAX_PENDING_SPANS` (default `10000`), `DCDR_TELEMETRY_JOIN_MAX_PENDING_LOGS` (default `20000`), `DCDR_TELEMETRY_JOIN_MAX_PENDING_BYTES` (default `67108864`, 64 MB): bounds of that wait (memory only).
- `DCDR_TELEMETRY_JOIN_MAX_CONTRIBUTIONS_PER_SPAN` (default `256`): log records one request may bring to the same span; the rest are dropped and reported in `partialSuccess`.
- `DCDR_TELEMETRY_BUFFER_MAX_SPANS` (default `5000`) and `DCDR_TELEMETRY_BUFFER_MAX_BYTES` (default `67108864`, 64 MB): spans held in memory before spilling to disk, whichever is reached first.
- `DCDR_TELEMETRY_SPOOL_DIR` (default `<BACKEND_LOG_FOLDER>/dcdr.telemetry.spool`): disk spool; `DCDR_TELEMETRY_SPOOL_MAX_BYTES` (default `268435456`, 256 MB) caps it. When memory and spool cannot take a request the receivers answer `503` (nothing of that request is kept).
- `DCDR_TELEMETRY_TENANT_MAX_BUFFER_SHARE` (default `0.5`; `1` disables): share of the buffer (memory and spool bytes together) one workspace may hold; a request that would take it past its share is answered `503` while others keep sending. Telemetry answered `200` is never dropped to make room.
- `DCDR_TELEMETRY_FLUSH_INTERVAL_MS` (default `5000`): how often batches are sent.
- `DCDR_TELEMETRY_BATCH_MAX_SPANS` (default and maximum `100`), `DCDR_TELEMETRY_BATCH_MAX_BYTES` (default and maximum `4194304`): a batch closes at whichever comes first.

## Logs

- `BACKEND_LOG_FOLDER` (default `./log`): log folder path.
- `BACKEND_ENABLE_FILE_LOGS` (optional): enables file logging when set to `true`.

## Observability / metrics

- `METRICS_UPDATE_INTERVAL_MS` (default `10000`): metrics update interval.

## Availability / agent-check weighting (advanced)

These control the availability score and effective weight used by agent-check.

- `EVENT_LOOP_BLOCK_THRESHOLD` (default `5000`)
- `AVAIL_BASE_BASEWEIGHT` (default `180`)
- `AVAIL_BASELINE_CORES` (default `12`)
- `AVAIL_BASELINE_RAM_GB` (default `64`)
- `AVAIL_BASE_CPU_WEIGHT` (default `0.6`)
- `AVAIL_BASE_RAM_WEIGHT` (default `0.4`)
- `AVAIL_DAMPING` (default `0.5`)
- `AVAIL_SPREAD_MIN` (default `0.70`)
- `AVAIL_SPREAD_MAX` (default `1.30`)
- `AVAIL_WEIGHT_STEP` (default `5`)
- `AVAIL_WEIGHT_MIN_DELTA` (default `3`)
- `AVAIL_CPU_PCT` (optional number)
- `AVAIL_EL_LAG_MS` (optional number)

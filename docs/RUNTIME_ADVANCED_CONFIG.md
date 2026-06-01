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

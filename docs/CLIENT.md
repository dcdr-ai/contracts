# TypeScript client (`DcdrRuntimeClient`)

This is the full reference for the TypeScript client. The README keeps only the quickstart.

## Core operations (methods)

`DcdrRuntimeClient` is a small, strongly-typed wrapper over the runtime HTTP API.

Quick map (method → HTTP surface):

| Method | HTTP | Auth | When to use |
|---|---|---|---|
| `healthcheck()` | `GET /api/system/healthcheck` | none by default | Load balancers / basic diagnostics |
| `metrics()` | `GET /api/system/metrics` | none by default | Prometheus scraping |
| `executeIntent(intent, request)` | `POST /api/execution/run/:intent` | required | Normal intent execution |
| `executeIntentStream(intent, request)` | `POST /api/execution/stream/:intent` | required | Streaming execution (SSE) |
| `demo(intent, request)` | `POST /api/execution/demo/:intent` | required (except demo mode) | Demo-specific intent execution |
| `dryRun(intent, vars)` | `POST /api/execution/dry-run/:intent` | required | Debug prompt rendering & resolved config |
| `eval(intent, vars)` | `POST /api/execution/eval/:intent` | required | Cloud and Cloud Pro evaluation workflows |
| `circuitBreakerStatus(provider, model?, tenantCid?)` | `GET /api/execution/circuit-breakers` | required | Observe breaker state (tenant-scoped) |
| `resetCircuitBreaker(provider, model?, tenantCid?)` | `PUT /api/execution/circuit-breakers/reset` | internal only | Reset breaker state (ops) |

What “auth required” means:

- **Customer mode (Cloud and Cloud Pro)**: set `bearerToken` (sends `Authorization: Bearer <DcdrSessionToken>`)
	- You create/get the token in the DCDR Cloud UI.
- **Internal/dev mode (Runtime (self-hosted))**: set `apiToken` (sends `token: <token>`)
	- Note: `/api/execution/*` endpoints require a session. For dev/testing you can set `sessionBypassToken` (sends `x-session-bypass`) when the runtime is configured with `SESSION_BYPASS_TOKEN`.

Common error patterns (all methods):

- Network/timeout errors: thrown as `Error` by the client.
- HTTP errors (non-2xx): thrown as `Error` with method/path/status and a body preview.

Runtime error codes (not exhaustive)

- `INVALID_CREDENTIALS`: returned when the upstream provider rejects credentials (typically HTTP 401/403).
	- Runtime HTTP: `401`
	- Response: `ExecuteIntentResponse.status="ERROR"` with `error.code="INVALID_CREDENTIALS"`

### `healthcheck()`

- Returns a minimal `DcdrRuntimeHealthcheckResponse` so you can probe readiness/liveness.
- Does not require auth by default (runtime mounts `/api/system/*` without auth middleware).

### `metrics()`

- Returns raw Prometheus text (same output as `curl /api/system/metrics`).
- See: [PROMETHEUS_METRICS.md](PROMETHEUS_METRICS.md)

### `executeIntent(intent, request)`

- The core call your application makes in production.
- Endpoint: `POST /api/execution/run/:intent`
- Input contract: `ExecuteIntentRequest`
- Output contract: `ExecuteIntentResponse` (includes `report` for deep diagnostics)

### `executeIntentStream(intent, request)`

- Endpoint: `POST /api/execution/stream/:intent`
- Transport: Server-Sent Events (SSE), `Content-Type: text/event-stream`
- Output: a stream of events (`meta`, optional `delta`, then `final`)

See: [STREAMING_EXECUTION_SSE.md](STREAMING_EXECUTION_SSE.md)

### `demo(intent, request)`

- Same shape as `executeIntent`, but targets the demo route: `POST /api/execution/demo/:intent`.
- Intended for curated demo intents (e.g. `DCDR_LOCAL_DEMO`).
- When the runtime is started in demo mode (for example `dcdr-runtime:latest --demo`), demo intents are intended to be callable without auth.

### `dryRun(intent, vars)`

- Endpoint: `POST /api/execution/dry-run/:intent`
- Purpose: validate and render prompt inputs without executing a provider/model call.

### `eval(intent, vars)`

- Endpoint: `POST /api/execution/eval/:intent`
- Cloud and Cloud Pro only: this endpoint is disabled in Runtime (self-hosted) and can return a `403`.

### `circuitBreakerStatus(provider, model?, tenantCid?)`

- Endpoint: `GET /api/execution/circuit-breakers?provider=...&model=...`

### `resetCircuitBreaker(provider, model?, tenantCid?)`

- Endpoint: `PUT /api/execution/circuit-breakers/reset`

## Request/response shapes

The most common payload is `ExecuteIntentRequest`:

- `vars?: Record<string, unknown>` — template variables (e.g. `{ name: "Ada" }`)
- `routing?: { ... }` — optional routing hints (force provider/implementation, tune retries)

The response is `ExecuteIntentResponse`:

- `status: "OK" | "ERROR"`
- `output?: any` — parsed result (when OK). Shape depends on the intent's output schema.
- `error?: ExecutionError` — error details (when ERROR)
- `report: ExecutionReport` — full attempt-by-attempt report (attempts, timings, retry/fallback choices)

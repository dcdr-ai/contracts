# @dcdr/contracts

Contracts package consumed by the runtime gateway.

## Runtime quickstart (Docker)

If you just want to try the runtime API, you can run the Docker image.

Assuming the image is published to Docker Hub as `dcdr.ai/dcdr-runtime`:

### Freeware/runtime mode (local registry)

Run the runtime from a local `registry.json` (recommended for offline/local usage):

```bash
docker pull dcdr.ai/dcdr-runtime:latest

# Windows PowerShell: mount a local registry.json into the container
docker run --rm -p 8000:8000 `
	-v "${PWD}/registry.json:/data/registry.json:ro" `
	dcdr.ai/dcdr-runtime:latest --registry /data/registry.json
```

### Internal/dev mode (API token)

Enable internal auth for local ops/testing:

```bash
docker run --rm -p 8000:8000 \
	-e API_TOKEN="dev-token" \
	-e ALLOW_SESSION_BYPASS="true" \
	-e SESSION_BYPASS_TOKEN="bypass-token" \
	dcdr.ai/dcdr-runtime:latest
```

### Swagger / OpenAPI

```bash
docker run --rm -p 8000:8000 \
	-e ENABLE_SWAGGER="true" \
	dcdr.ai/dcdr-runtime:latest
```

Then open:

- `http://localhost:8000/api/docs`
- `http://localhost:8000/api/openapi.json`

## CLI (dcdr)

This repo's runtime includes a small CLI (`dcdr`) built on top of `DcdrRuntimeClient`.

It currently ships with the **runtime repo** (not as a standalone npm package):

```bash
# From the dcdr-runtime repository root
npm ci
npm run dcdr -- --help
```

### Auth modes

- Customer mode: `--bearer <DcdrSessionToken>` (sends `Authorization: Bearer ...`)
- Internal/dev mode: `--api-token <token>` and optional `--bypass <token>` (sends `token: ...` and `x-session-bypass: ...`)

### Common commands

```bash
# Healthcheck
npm run dcdr -- health --base-url http://localhost:8000 --api-token dev-token --bypass bypass-token

# Execute an intent
npm run dcdr -- run MY_INTENT --base-url https://dcdr.equivalo.com --bearer $TOKEN --vars-json '{"name":"Jose"}'

# Demo route
npm run dcdr -- demo DCDR_LOCAL_DEMO --base-url http://localhost:8000 --api-token dev-token --vars-file ./vars.json

# Circuit breaker status (internal ops can scope by tenant)
npm run dcdr -- circuit-breaker openai --base-url http://localhost:8000 --api-token dev-token --tenant-cid myTenant
```

### Output options

- `--json` for machine-readable output
- `--color auto|always|never` to control ANSI coloring

## Install

```bash
npm ci
```

## Build

```bash
npm run build
```

## Tests

Tests live under [tests/](tests) and are executed with Jest.

```bash
npm run test
npm run test:ci
```

## DcdrRuntimeClient

`DcdrRuntimeClient` is a minimal HTTP client for calling the runtime gateway.

### Customer mode (recommended in cloud)

Send a backend-issued `DcdrSessionToken` as a bearer token.

```ts
import { DcdrRuntimeClient } from "@dcdr/contracts";

const client = new DcdrRuntimeClient({
	baseUrl: "https://dcdr.equivalo.com",
	bearerToken: process.env.DCDR_SESSION_TOKEN || "",
});

const res = await client.executeIntent("MY_INTENT", { vars: { name: "Jose" } });

const health = await client.healthcheck();
const metricsText = await client.metrics();

// Cloud-only features (disabled in freeware runtime mode)
const dry = await client.dryRun("MY_INTENT", { name: "Jose" });
const evalRes = await client.eval("MY_INTENT", { name: "Jose" });
```

### Internal mode (dev/ops)

Use `API_TOKEN` and optionally `x-session-bypass` (only when explicitly enabled on the server).

```ts
import { DcdrRuntimeClient } from "@dcdr/contracts";

const client = new DcdrRuntimeClient({
	baseUrl: "http://localhost:8000",
	apiToken: process.env.API_TOKEN || "",
	sessionBypassToken: process.env.SESSION_BYPASS_TOKEN,
});

const res = await client.demo("DCDR_LOCAL_DEMO", { vars: { name: "Jose" } });
```

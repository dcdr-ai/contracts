# @dcdr/contracts

Contracts package consumed by the runtime gateway.

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

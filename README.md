# @dcdr/contracts

> ⚙️ Intent-based AI runtime + control plane for production systems

[![version](https://img.shields.io/npm/v/@dcdr/contracts?label=version&color=blue)](https://www.npmjs.com/package/@dcdr/contracts)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![typescript](https://img.shields.io/badge/language-TypeScript-blue.svg)](https://www.typescriptlang.org/)

DCDR runs AI capabilities as stable, versioned Intents (with configurable routing/retries) instead of hardcoding model calls in application code.

## Why DCDR

Most applications hardcode model calls, prompts, and retry logic directly in code — making changes slow and risky.

DCDR moves this into a versioned, configurable layer so you can:

- change models without redeploying
- iterate prompts safely
- control routing and fallback centrally
- use execution logs + QC workflows to review and correct outputs, enabling fast iteration on prompts and models based on real traffic

Learn more: <https://dcdr.ai>

## 💣 What problem does this solve?

Shipping AI to production hurts because:

- Models drift and outputs change without warning.
- Prompts and retries live in app code, so every fix needs a redeploy.
- Failures are hard to reproduce, diagnose, and roll back.

DCDR pulls this into a versioned runtime + Registry layer so you can change prompts/models/routing safely, add fallbacks, and debug real executions — without touching application deploys.

On top of that, every failure can be reviewed, corrected, and turned into training data for continuous improvement.

## What this package provides

- **Public TypeScript contracts** (interfaces/enums) for DCDR Registries and runtime API payloads.
- **`DcdrRuntimeClient`**: a strongly-typed TypeScript HTTP client for calling a DCDR Runtime instance.
- **Tracked-call rating metadata**: a shared, versioned multimodal multiplier matrix that backend/UI can render and audit consistently with runtime behavior.
- **Governance contracts**: shared provider/model limit shapes (`provider-limits.contract`) for tenant-level enablement, call-window, and budget-window policy configuration.

## Who should use it

- Node.js / TypeScript applications that call the DCDR Runtime HTTP API.
- Tooling that reads/writes `registry.json` (Runtime (self-hosted)) and wants stable types.

## When to use it

- You want compile-time type safety for runtime requests/responses (for example `ExecuteIntentRequest` / `ExecuteIntentResponse`).
- You want stable types when authoring DCDR Registries and Intent definitions (`DcdrRegistry`, `IntentContract`, policies, implementations).

---

## ⚡ When should I use DCDR?

### Use DCDR if

- You need stable AI interfaces (intents)
- You want to decouple prompts from code
- You need retries, fallback, routing
- You need structured outputs (JSON enforcement)

### Do NOT use DCDR if

- You only need simple one-off OpenAI calls
- You don't need control over execution or quality

DCDR does not replace model providers (OpenAI, local models, etc.). It orchestrates how they are used.

### Fastest way to try it

- Run Runtime (self-hosted) with Docker
- Call a built-in demo intent (no API key required)

---

## 🧠 Mental model

- Your app calls an Intent.
- The runtime resolves configuration from the Registry.
- A prompt is rendered.
- An Implementation is selected.
- Execution + retries + fallback happen.
- A structured result is returned.

---

## ⚡ 30-second quickstart

Run a working intent in seconds, no API key required:

1. Run runtime container:

```bash
docker run --rm -p 8000:8000 dcdrai/runtime:latest --demo
```

1. Call a built-in demo Intent:

```bash
curl -sS -H 'Content-Type: application/json' \
  -X POST http://localhost:8000/api/execution/demo/DCDR_LOCAL_DEMO \
  -d '{"vars":{"name":"Ada"}}'

# Optional: remote demo (calls dcdr.ai; falls back to local if blocked)
curl -sS -H 'Content-Type: application/json' \
  -X POST http://localhost:8000/api/execution/demo/DCDR_REMOTE_DEMO \
  -d '{"vars":{"name":"Ada"}}'
```

---

## Choose your path

- **Smoke test (no tokens, no registry)** → [30-second quickstart](#-30-second-quickstart)
- **Self-hosted (registry.json + auth)** → [Quickstart (Docker runtime – registry.json setup)](#quickstart-docker-runtime--registryjson-setup)
- **Managed cloud (DCDR Cloud / Cloud Pro)** → [docs/PLATFORM_OVERVIEW.md](docs/PLATFORM_OVERVIEW.md)
- **TypeScript client only** → [Use the TypeScript client](#use-the-typescript-client)
- **Define intents / registry authoring** → [docs/CONTRACTS.md](docs/CONTRACTS.md)

---

## Table of contents

- [When should I use DCDR?](#-when-should-i-use-dcdr)
- [30-second quickstart](#-30-second-quickstart)
- [Quickstart (Docker runtime – registry.json setup)](#quickstart-docker-runtime--registryjson-setup)
- [Use the TypeScript client](#use-the-typescript-client)
- [Common patterns (recipes)](#-common-patterns-recipes)
- [More docs](#more-docs)

---

## Quickstart (Docker runtime – registry.json setup)

This quickstart is for **Runtime (self-hosted)** with a local `registry.json`.

Notes

- This is a production-oriented setup: `/api/execution/*` endpoints require auth + session.
- If you only want to confirm the runtime works (no tokens, no registry), use the [30-second quickstart](#-30-second-quickstart) with `--demo`.

If you are using **Cloud** or **Cloud Pro**, skip this section and see [docs/PLATFORM_OVERVIEW.md](docs/PLATFORM_OVERVIEW.md).

Docker image:

- `dcdrai/runtime:latest`

### 1) Create a local `registry.json` (HELLO_WORLD)

Copy the example file and edit it:

```bash
cp ./examples/registry.hello_world.json ./registry.json
```

Or start from the minimal sample registry at the repo root:

```bash
cp ./sample_registry.json ./registry.json
```

Then replace:

- `REPLACE_ME_OPENAI_API_KEY` → your real OpenAI API key

This example includes:

- 1 intent (`HELLO_WORLD`)
- 2 implementations (same provider `OPEN_AI`, two models)
- `executionPolicy.type = WEIGHTED` and implementation `weight` values (conventionally **0..1**, but any positive numbers work)
- OpenAI `endpoint` set to **`https://api.openai.com/v1`** (base URL)

### 2) Run the runtime container

#### Windows PowerShell

```powershell
docker pull dcdrai/runtime:latest
docker run --rm -p 8000:8000 `
 -e API_TOKEN='dev-token' `
 -e SESSION_BYPASS_TOKEN='dev-session-bypass' `
 -v "${PWD}/registry.json:/data/registry.json:ro" `
 dcdrai/runtime:latest --registry /data/registry.json
```

#### Linux / macOS

```bash
docker pull dcdrai/runtime:latest
docker run --rm -p 8000:8000 \
 -e API_TOKEN='dev-token' \
 -e SESSION_BYPASS_TOKEN='dev-session-bypass' \
 -v "$PWD/registry.json:/data/registry.json:ro" \
 dcdrai/runtime:latest --registry /data/registry.json
```

### 3) Call the runtime (curl)

Healthcheck:

```bash
curl -sS -H 'token: dev-token' http://localhost:8000/api/system/healthcheck
```

Execute the `HELLO_WORLD` intent:

```bash
curl -sS \
 -H 'Content-Type: application/json' \
 -H 'token: dev-token' \
 -H 'x-session-bypass: dev-session-bypass' \
 -X POST http://localhost:8000/api/execution/run/HELLO_WORLD \
 -d '{"vars":{"name":"Ada"}}'
```

### 4) Swagger / OpenAPI

- Swagger UI: `http://localhost:8000/api/docs`
- OpenAPI JSON: `http://localhost:8000/api/openapi.json`

---

## Use the TypeScript client

### Client config & auth modes

`DcdrRuntimeClient` supports two auth modes:

- **Customer mode (Cloud; also Cloud Pro)**: `bearerToken` → sends `Authorization: Bearer <DcdrSessionToken>`
  - You obtain the `DcdrSessionToken` in Cloud.
- **Internal/dev mode (Runtime (self-hosted))**: `apiToken` → sends `token: <token>`
  - Note: `/api/execution/*` endpoints require a session. For dev/testing you can set `SESSION_BYPASS_TOKEN` on the runtime and pass `sessionBypassToken` in the client (sends `x-session-bypass`).

Install (in a Node/TS app):

```bash
npm i @dcdr/contracts
```

Example (internal/dev mode):

```ts
import { DcdrRuntimeClient } from "@dcdr/contracts";

const client = new DcdrRuntimeClient({
  baseUrl: "http://localhost:8000",
  apiToken: "dev-token",
  sessionBypassToken: "dev-session-bypass",
});

const health = await client.healthcheck();
const res = await client.executeIntent("HELLO_WORLD", {
  vars: { name: "Ada" },
});

console.log(health.status);
console.log(res.status, res.output);
```

Example (customer mode / live):

```ts
import { DcdrRuntimeClient } from "@dcdr/contracts";

const client = new DcdrRuntimeClient({
  // baseUrl defaults to https://runtime.dcdr.ai
  bearerToken: process.env.DCDR_SESSION_TOKEN,
});

// 1) Verify token is accepted (recommended during setup/debugging)
const auth = await client.authCheck();
console.log(auth.valid, auth.authMode, auth.cid);

// 2) Execute your first Intent (must exist in your Registry)
const res = await client.executeIntent("MY_FIRST_INTENT", {
  workflow: {
    workflowId: "ticket-triage",
    runId: "run-20260613-001",
    stepId: "classify",
  },
  vars: { topic: "hello", language: "es" },
  context: { channel: "support", priority: "normal" },
});

console.log(res.status, res.output);
```

`workflow` is optional and is intended for higher-level orchestration layers such as agent runners, graph/state-machine systems, and multi-step workflows. It is metadata for coordination/correlation, while `context` remains the open functional/business context for the execution itself.

`workflow` is a strongly typed top-level surface: supported keys are `workflowId`, `runId`, `nodeId`, `stepId`, `parentExecutionId`, and `idempotencyKey`. Unsupported `workflow` keys are rejected at the runtime boundary; open-ended caller/business metadata should go into `context` instead.

Full client reference: [docs/CLIENT.md](docs/CLIENT.md)

Prometheus metrics: [docs/PROMETHEUS_METRICS.md](docs/PROMETHEUS_METRICS.md)

---

## 🧪 Common patterns (recipes)

### 1) Strict JSON output Intent

Use this pattern when you need guaranteed machine-readable outputs.

```json
{
  "id": "INTENT_ID",
  "intent": "FORMAT_PARSER",
  "type": "CHAT",
  "active": true,
  "outputSchema": {
    "result": { "type": "string", "required": true }
  },
  "defaultPrompt": {
    "id": "PROMPT_ID",
    "version": "v1",
    "name": "format-parser",
    "sha256": "PROMPT_SHA256",
    "semanticHash": "PROMPT_SEMANTIC_HASH",
    "messages": [
      { "role": "system", "content": "Return JSON only." },
      { "role": "user", "content": "Input: {{text}}" }
    ],
    "variablesInterpolationType": "MUSTACHE",
    "params": { "response_format": "json_schema" }
  },
  "retryPolicy": {
    "maxAttempts": 3,
    "allowFallback": true,
    "repairOnParseFail": true,
    "retryOn": ["PARSE_FAIL", "SCHEMA_FAIL"]
  },
  "implementations": [
    {
      "id": "IMPL_ID",
      "provider": "OPEN_AI",
      "name": "openai-format-parser",
      "version": "v1",
      "sha256": "IMPL_SHA256",
      "semanticHash": "IMPL_SEMANTIC_HASH",
      "model": "gpt-4.1-mini",
      "endpoint": "https://api.openai.com/v1",
      "active": true
    }
  ]
}
```

### 2) Weighted routing across two models

```json
{
  "executionPolicy": { "type": "WEIGHTED" },
  "implementations": [
    {
      "id": "IMPL_PRIMARY",
      "provider": "OPEN_AI",
      "name": "primary",
      "version": "v1",
      "sha256": "IMPL_SHA256_1",
      "semanticHash": "IMPL_SEMANTIC_HASH_1",
      "model": "gpt-4.1-mini",
      "endpoint": "https://api.openai.com/v1",
      "active": true,
      "weight": 0.7
    },
    {
      "id": "IMPL_SECONDARY",
      "provider": "OPEN_AI",
      "name": "secondary",
      "version": "v1",
      "sha256": "IMPL_SHA256_2",
      "semanticHash": "IMPL_SEMANTIC_HASH_2",
      "model": "gpt-4.1",
      "endpoint": "https://api.openai.com/v1",
      "active": true,
      "weight": 0.3
    }
  ]
}
```

### 3) Debugging Intent rendering (`dryRun`)

```bash
curl -sS \
 -H 'Content-Type: application/json' \
 -H 'token: dev-token' \
 -X POST http://localhost:8000/api/execution/dry-run/HELLO_WORLD \
 -d '{"vars":{"name":"Ada"}}'
```

Shows rendered messages and resolved execution configuration, without calling an external provider.

---

## ⚙️ Introduction to execution modes

- Runtime (self-hosted): you run the runtime; you manage the Registry in `registry.json`.
- Cloud: managed runtime + managed Registry/configuration.
- Cloud Pro: Cloud + Cloud Pro entitlements.

See full feature matrix: [docs/TIERS_FEATURE_MATRIX.md](docs/TIERS_FEATURE_MATRIX.md)

---

## Managed storage credentials

Cloud-managed assets keep tenant-visible storage descriptors and concrete secrets separate:

- `DcdrAssetStorageDescriptor` stays secret-free and travels through entitlements.
- Backend/runtime secret exchange uses the shared `storage.credentials.contract` surface.
- Current runtime support resolves Google Cloud service-account credentials for managed buckets and leaves room for future `S3`, `FTP`, and `NAS` credential kinds without changing the public asset upload/get/delete routes.

## More docs

### Core concepts

- [docs/CONTRACTS.md](docs/CONTRACTS.md) — How Registries, Intents, implementations, policies, and capabilities fit together.
- [docs/EXECUTION_POLICY.md](docs/EXECUTION_POLICY.md) — ExecutionPolicy reference (availability matrix + tie-breakers).
- [docs/PLATFORM_OVERVIEW.md](docs/PLATFORM_OVERVIEW.md) — Runtime (self-hosted) vs Cloud vs Cloud Pro (what runs where, who owns what).
- [docs/TIERS_FEATURE_MATRIX.md](docs/TIERS_FEATURE_MATRIX.md) — One-page feature/tier reference.
- [docs/SUPPORTED_MODELS.md](docs/SUPPORTED_MODELS.md) — Provider model IDs currently marked as runtime-supported.

### Development

- [docs/CLIENT.md](docs/CLIENT.md) — Full `DcdrRuntimeClient` reference (methods, auth options, errors).
- [docs/EXECUTION_ERROR_CODES.md](docs/EXECUTION_ERROR_CODES.md) — Stable runtime execution error codes and their meanings.
- [docs/CLI.md](docs/CLI.md) — CLI usage patterns (healthcheck, run, demo, dry-run).
- [docs/STREAMING_EXECUTION_SSE.md](docs/STREAMING_EXECUTION_SSE.md) — Streaming intent execution over SSE (`/api/execution/stream/:intent`).
- [docs/RUNTIME_ADVANCED_CONFIG.md](docs/RUNTIME_ADVANCED_CONFIG.md) — Runtime (self-hosted) env vars (SSL/HTTPS, networking, auth, logs, metrics).

### Integrations

- [docs/OPENAPI_SDKS.md](docs/OPENAPI_SDKS.md) — Generate Python/C#/Java SDKs from `openapi.runtime.json`.
- [docs/PROMETHEUS_METRICS.md](docs/PROMETHEUS_METRICS.md) — Metrics endpoint + the Prometheus gauges/counters we expose.
- [docs/EXAMPLES.md](docs/EXAMPLES.md) — End-to-end examples and small recipes.
- [CHANGELOG.md](CHANGELOG.md) — Release notes (synced from the runtime repo changelog; entries start with `RUNTIME` / `CONTRACTS`).

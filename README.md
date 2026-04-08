# 🚦 @dcdr/contracts

🌐 Commercial site: https://dcdr.ai

Welcome! This package contains the **public contracts** (TypeScript interfaces/enums) for the **DCDR Platform**, plus a fully functional, strongly-typed HTTP client: `DcdrRuntimeClient`.

If you're new to DCDR, this README is the **starting point** 🧭.
It explains what DCDR is (platform, not only runtime), how “intents” work, how to run the runtime engine with Docker, and how to call it from code or the CLI.

---

## 📚 Table of contents

- [✨ Introduction](#-introduction)
- [🌐 DCDR Cloud (subscription)](#-dcdr-cloud-subscription)
- [🧠 Key concepts](#-key-concepts)
	- [What is an intent?](#what-is-an-intent)
	- [What is a DCDR Registry?](#what-is-a-dcdr-registry)
	- [Runtime modes (local vs cloud)](#runtime-modes-local-vs-cloud)
- [📦 DCDR Registry (DcdrRegistry) reference](#-dcdr-registry-dcdrregistry-reference)
	- [Top-level fields](#top-level-fields)
	- [Related contract types (source links)](#related-contract-types-source-links)
- [🧾 IntentContract (deep dive)](#-intentcontract-deep-dive)
	- [Intent identity & lifecycle](#intent-identity--lifecycle)
	- [Input/output schemas](#inputoutput-schemas)
	- [Prompts (templates)](#prompts-templates)
	- [Execution policy (routing)](#execution-policy-routing)
	- [Retry policy (retries & fallback)](#retry-policy-retries--fallback)
	- [Implementations (providers/models/endpoints)](#implementations-providersmodelsendpoints)
- [🚀 Quickstart (Docker runtime)](#-quickstart-docker-runtime)
	- [1) Create a local registry.json (HELLO_WORLD)](#1-create-a-local-registryjson-hello_world)
	- [2) Run the runtime container](#2-run-the-runtime-container)
	- [3) Call the runtime (curl)](#3-call-the-runtime-curl)
	- [4) Swagger / OpenAPI](#4-swagger--openapi)
- [🧩 Use the TypeScript client](#-use-the-typescript-client)
	- [Client config & auth modes](#client-config--auth-modes)
	- [Core operations (methods)](#core-operations-methods)
	- [Request/response shapes](#requestresponse-shapes)
	- [Prometheus metrics](#prometheus-metrics)
- [🧰 CLI (dcdr)](#-cli-dcdr)
	- [Common commands](#common-commands)
	- [Output options](#output-options)
- [🧬 Generate SDKs (Python/C#/Java) from OpenAPI](#-generate-sdks-pythoncjava-from-openapi)
- [🧾 Example registry.json (HELLO_WORLD)](#-example-registryjson-hello_world)

---

## ✨ Introduction

DCDR is a **platform for running AI in production** ✅.

It has two parts:

- 🧠 **DCDR Cloud (dcdr.ai)** — the managed control plane (subscription): https://dcdr.ai
- ⚙️ **DCDR Runtime** — the execution engine that runs intents (Docker)
	- In **Cloud** subscription, DCDR operates the runtime for you (vendor-hosted).
	- In **Runtime/freeware** mode, you run it yourself from a local `registry.json`.

This repository/package (`@dcdr/contracts`) is the shared language between them.
It defines the **interfaces** for:

- intents, prompts, implementations, credentials, execution reports
- the runtime HTTP API client (`DcdrRuntimeClient`)

You define “what your system can do” as **intents** (e.g. `HELLO_WORLD`, `NAME_PROCESSOR`, `FORMAT_PARSER`).
Then the runtime executes them by selecting one of the configured implementations (OpenAI, on‑prem models, etc.).

Why this exists (the pain DCDR removes):

- ✅ You stop hardcoding prompts, provider configs, routing rules, and retries in app code
- ✅ You get versioning + reproducibility for prompts/implementations (and safe rollouts)
- ✅ You can centralize smart routing + retry/fallback policies
- ✅ You can operate quality workflows (logs, QC, annotations) in subscription mode

The runtime is the **motor** 🚂. The cloud control plane is the **operating system** 🧩.
`@dcdr/contracts` is the stable contract between them.

---

## 🌐 DCDR Cloud (subscription)

DCDR Cloud is the **control plane** for operating AI in production — not just running prompts.

Learn more: https://dcdr.ai

If the runtime is the **motor** 🚂, the cloud is where you **control behavior**, **observe executions**, and **improve quality** with evidence from real traffic.

What you get in subscription mode:

- 🧩 **Stable intents + contracts**: define once, call from your app forever (schemas included)
- 🧠 **Smart routing**: multiple routing methods (per intent) without changing app code:
	- `WEIGHTED` (weights)
	- `FALLBACK_CHAIN` (fixed order)
	- `LOCAL_FIRST` (prefer on‑prem/office first)
	- `CHEAPEST_FIRST`, `FASTEST_FIRST`, `QUALITY_FIRST` (when metadata is present)
	- safe fallback behavior via `fallbackMode` (e.g. fall back to `WEIGHTED` or declared order, or fail fast)
	- plus per-request routing hints for debugging/ops (e.g. prefer/deny provider, force implementation)
	- Source contract: [src/policies.contract.ts](src/policies.contract.ts#L183)
- 🔁 **Retries + fallback**: policy-driven attempts, backoff/jitter, and repair flows for strict JSON intents
- 🧾 **Execution tracing**: understand which prompt + implementation actually ran, with attempt-by-attempt reports
- 🔐 **Managed credentials**: keep secrets out of JSON files; reuse encrypted credentials across implementations
- 🔎 **Centralized logs + search**: investigate failures, compare behavior across versions and implementations
- ✅ **Quality loop (tier-dependent)**: review outputs (QC), add annotations/taxonomy, and iterate safely
- 🧪 **Prompt versioning + canary** (where available): roll out changes gradually and measure impact

Incremental operation (the core idea) 📈:

- 🧬 **Version everything** (intents, prompts, implementations) so production behavior is reproducible and changes are attributable.
- 🔁 **Iterate prompts without touching implementations**: improve quality/format/structure while keeping the same provider/model endpoints.
- 🔀 **Iterate implementations without touching prompts**: swap models, adjust weights, change routing/fallback, or roll out new endpoints safely.
- 📊 **Quality reports & drift detection** (tier-dependent): detect when quality changes over time, then iterate with evidence from real traffic.

This is how you avoid “one-shot prompt engineering” and instead run a continuous improvement loop: ship → observe → review → iterate.

### What you do in cloud mode (typical flow)

In **cloud subscription**, you don’t manage `registry.json` files and you don’t run Docker.
The usual workflow is:

- 1) Go to the DCDR Cloud UI (https://dcdr.ai)
- 2) Define intents, prompts, implementations, policies, and credentials via UI (control plane)
- 3) Create/get a **customer token** (`DcdrSessionToken`) for your app/user/workload
- 4) Call the runtime API using your preferred client (TypeScript client, OpenAPI-generated SDKs, etc.) with `Authorization: Bearer <DcdrSessionToken>`

How it works (high level) 🗺️:

- 1) Your app calls an **intent** (not a model name)
- 2) The runtime resolves the intent → renders prompt → selects implementation(s) → applies retries/fallback → returns structured output
- 3) Cloud components (optional) add: versioning, governance, logs/QC, reporting, and continuous improvement workflows

In **runtime/freeware** mode, the runtime works on its own from a local JSON registry.
In **cloud subscription**, DCDR Cloud operates the control plane and the runtime for you, so you don’t manage registry files.

📌 Full tier breakdown (commercial): [docs/TIERS_FEATURE_MATRIX.md](docs/TIERS_FEATURE_MATRIX.md)

---

## 🧠 Key concepts

Before jumping into code, it helps to understand the three “layers”:

- 🧩 **Control plane (cloud)**: authoring, versioning, rollouts, logs/QC
- ⚙️ **Runtime engine (docker)**: executes intents and exposes HTTP API
- 🧰 **Clients**: your app calls the runtime via HTTP (SDK/CLI)

### What is an intent?

An **intent** is a named AI capability, like a function.

Examples:

- `HELLO_WORLD` (simple chat response)
- `FORMAT_PARSER` (extract structure from product names)
- `EMBEDDING_SEARCH` (generate embeddings)

An intent includes:

- a prompt template (messages + params like temperature)
- a retry/fallback policy
- one or more implementations (provider + model + endpoint + auth)

### What is a DCDR Registry?

A **DCDR Registry** is the configuration bundle that tells the runtime what it can execute.

In **cloud subscription**, you typically never create or edit a `registry.json` file yourself.
You manage intents, prompts, implementations, credentials, and policies in the **control plane**, and the runtime receives a validated registry snapshot from DCDR Cloud.

In runtime/local mode, the registry is commonly stored as a JSON file named `registry.json` (the filename is conventional) and passed to the runtime with `--registry <path>`.

It contains:

- the list of intents
- optional credentials
- optional signature metadata (cloud/pro flows)

In **local/runtime mode**, the runtime runs entirely from that registry file.

Good to know:

- You may omit `sha256` in local files: the runtime computes it.
- In cloud/pro, registries can be signed and verified.

### Runtime modes (local vs cloud)

DCDR supports two main ways of running:

- 🧰 **Runtime mode (local/freeware)**
	- You start the runtime with `--registry /path/to/registry.json`
	- A fully supported **self-hosted flavor**: you run DCDR in your infrastructure and keep full control.
	- Great fit when you:
		- don’t want to pay a subscription (totally fine)
		- need offline/air-gapped execution
		- want to own the full change-control process
	- You (the operator) own the registry lifecycle: editing, versioning, validation, rollouts.
	- Can be used in production in your infra — the “hassle” is simply that you own the configuration lifecycle.
	- Limitations vs subscription:
		- some cloud workflows are intentionally not available (example: `eval` workflows are cloud-only)
	- See the commercial breakdown: [docs/TIERS_FEATURE_MATRIX.md](docs/TIERS_FEATURE_MATRIX.md)

- ☁️ **Cloud / cloud-pro mode (subscription)**
	- **You do not run the runtime container**: runtime is operated in DCDR infrastructure.
	- **No `registry.json` management**: you configure everything in the control plane (UI/API), and runtime consumes a backend-produced registry snapshot.
	- DCDR Cloud is the source of truth for versioning, canaries, credentials, routing policies, logs/QC, etc.
	- Entitlements/tier features are enforced by the backend.
	- Net effect: everything “just flows” — UI-driven changes, stable tokens, and no registry file hassle.

---

## 📦 DCDR Registry (DcdrRegistry) reference

This is the canonical registry object used by DCDR.

- Source type: [src/control.contract.ts](src/control.contract.ts#L8)

In runtime/local mode, this object is typically serialized to a JSON file (often called `registry.json`) and passed to the runtime via `--registry`.

### Top-level fields

All fields below belong to `DcdrRegistry`:

- `sha256` 🧾
	- Purpose: fingerprint of the registry payload for audit/reproducibility.
	- Behavior:
		- if omitted in local files, the runtime computes it
		- if provided, the runtime may verify it
	- Notes: runtime computes the hash over a stable clone that excludes signature fields.

- `generatedAt` 🕒
	- Purpose: timestamp (ISO string) for when the registry bundle was generated.
	- Common source: the control plane.

- `signature` 🔏 (optional)
	- Purpose: cryptographic signature for the registry bundle.
	- Used for: verifying registries issued by the control plane (tier-dependent flows).

- `signatureKeyId` 🗝️ (optional)
	- Purpose: key identifier/version to support signature rotation.

- `intents` 🧠
	- Purpose: list of everything the runtime can execute.
	- Type: `IntentContract[]`.
	- Source type: [src/intent.contract.ts](src/intent.contract.ts#L98)

- `credentials` 🔐 (optional)
	- Purpose: reusable auth material referenced by implementations.
	- Type: `CredentialsContract[]`.
	- Source type: [src/credentials.contract.ts](src/credentials.contract.ts#L8)
	- Referenced by: `ImplementationContract.credentialRef`.

### Related contract types (source links)

This section is intentionally link-heavy: the inline comments in code are the “always up to date” documentation.

Core registry types:

- `DcdrRegistry`: [src/control.contract.ts](src/control.contract.ts#L8)
- `CredentialsContract`: [src/credentials.contract.ts](src/credentials.contract.ts#L8)
- `IntentContract` + `IntentType`: [src/intent.contract.ts](src/intent.contract.ts#L16) and [src/intent.contract.ts](src/intent.contract.ts#L98)

Prompting + schemas:

- `PromptTemplateInterpolationType`: [src/prompts.contract.ts](src/prompts.contract.ts#L7)
- `PromptVariableType`: [src/prompts.contract.ts](src/prompts.contract.ts#L23)
- `PromptVariable`: [src/prompts.contract.ts](src/prompts.contract.ts#L38)
- `PromptTemplate`: [src/prompts.contract.ts](src/prompts.contract.ts#L105)
- `PromptParameters`: [src/policies.contract.ts](src/policies.contract.ts#L109)

Routing + retries:

- `RetryPolicy`: [src/policies.contract.ts](src/policies.contract.ts#L12)
- `ExecutionPolicyType`: [src/policies.contract.ts](src/policies.contract.ts#L183)
- `ExecutionPolicy`: [src/policies.contract.ts](src/policies.contract.ts#L258)

Provider execution:

- `ImplementationContract`: [src/implementations.contract.ts](src/implementations.contract.ts#L54)
- `HttpRequestParams`: [src/http.contract.ts](src/http.contract.ts#L13)
- `IntentProvider`: [src/provider.contract.ts](src/provider.contract.ts#L19)

Runtime API shapes:

- `ExecuteIntentRequest`: [src/execution.contract.ts](src/execution.contract.ts#L10)
- `ExecutionReport`: [src/execution.contract.ts](src/execution.contract.ts#L69)
- `ExecuteIntentResponse`: [src/execution.contract.ts](src/execution.contract.ts#L190)
- `Message`: [src/messages.contract.ts](src/messages.contract.ts#L13)
- `DcdrRuntimeClient`: [src/runtime.client.ts](src/runtime.client.ts#L110)

---

## 🧾 IntentContract (deep dive)

If you understand **intents**, you understand DCDR.
An intent is a versionable, provider-agnostic unit that can be executed consistently in production.

In TypeScript, an intent is represented by `IntentContract` (see `@dcdr/contracts/intent.contract`).

This section explains the fields you can configure and why they exist.

### Intent identity & lifecycle

Key fields:

- 🆔 `id` — stable identifier for the intent. In cloud, this is usually a UUID. In local/runtime mode you can use simple IDs like `"hello_world"` as long as they are stable.
- 🏷️ `intent` — the public name you call over HTTP, e.g. `POST /api/execution/run/HELLO_WORLD`.
- 🧭 `type` — intent category (CHAT, EMBEDDING, IMAGE_GENERATION, …). This is used for capability checks and for picking the right provider adapter.
- ✅ `active` — global on/off switch.
- 📝 `description`, `name`, `tags` — human-facing metadata for UIs, logs, and analytics.

### Input/output schemas

Schemas are optional but strongly recommended if you want reliability.

- 📥 `inputSchema` — documents the inputs your intent expects.
- 📤 `outputSchema` — documents the outputs you want back.

In DCDR these schemas are expressed as a map of variables (`Record<string, PromptVariable>`). They are used for:

- UI form generation (cloud)
- validation hints
- structured output enforcement (when combined with prompt params like `response_format`)

Example pattern:

- `inputSchema.name` as a required string
- `outputSchema.result` as a required string

### Prompts (templates)

The prompt lives in `defaultPrompt` (and optionally `canaryPrompt`).

Important fields:

- 🧩 `variablesInterpolationType` — how `{{vars}}` are expanded.
	- Recommended: `MUSTACHE` → `{{name}}`
- 💬 `messages[]` — the chat prompt.
	- `system` sets behavior/constraints
	- `user` is the actual user input template
- 🎛️ `params` — runtime model parameters (examples below)

Common `params` you will use:

- 🌡️ `temperature` (0..2)
- 🎲 `top_p` (0..1)
- 🔢 `top_k`
- ✂️ `max_tokens`
- 🧠 `enable_thinking` (best-effort hint; model/provider dependent)
- 🧾 `response_format` (`text`, `json_object`, `json_schema`, …)
- ➕ `presence_penalty`, `frequency_penalty`
- 🎯 `seed` (reproducibility)

Canary support:

- 🧪 `canaryPrompt` and `canaryPromptWeight` allow controlled rollout between two prompts (tier-dependent).

Hashes:

- `sha256` and `semanticHash` exist for audit/reproducibility. In local/runtime mode examples you can use placeholder values.

### Execution policy (routing)

`executionPolicy` defines how the runtime should *plan candidates* **before** retries/fallback happen.

The simplest and most common policy is:

- ⚖️ `type: WEIGHTED` — use each implementation's `weight` for selection.

Other policies exist (fallback chain, local-first, cheapest-first, fastest-first, quality-first). In subscription mode, DCDR Cloud helps you manage and visualize this.

### Retry policy (retries & fallback)

`retryPolicy` defines what happens when providers fail.

Common knobs:

- 🔁 `maxAttempts` — total attempts across all candidates
- 🧪 `maxPerCandidate` — attempts per implementation before switching
- ⏱️ `attemptTimeoutMs`
- 🪂 `allowFallback`
- 🧯 `repairOnParseFail` — useful when you require strict JSON output
- 🧨 `retryOn` — error classes that are retryable
- 🌀 backoff/jitter (`retryBackoffMs`, `retryBackoffStrategy`, `retryJitterMs`, `retryBackoffCapMs`)

✅ Real-world pattern (recommended for production intents):

- Set `defaultPrompt.params.response_format = "json_schema"` (or `json_object` depending on your needs)
- Define an `outputSchema`
- Enable `retryPolicy.repairOnParseFail = true`
- Include `PARSE_FAIL` + `SCHEMA_FAIL` in `retryOn`

This gives you **strict outputs** with automatic repair attempts when providers return malformed JSON.

### Implementations (providers/models/endpoints)

Implementations are the concrete ways an intent can run.
Think: *provider + model + endpoint + auth + runtime config*.

Key fields:

- 🧠 `provider` — e.g. `OPEN_AI`, `OFFICE`
- 🤖 `model` — e.g. `gpt-4.1-mini`, `Qwen3-4B-Instruct-2507`
- 🌍 `endpoint` — base URL. For OpenAI it should be `https://api.openai.com/v1`.
- ⚖️ `weight` — selection weight for `WEIGHTED` policy. Conventionally use **0..1** (e.g. 0.7 / 0.3).
- 🔐 `credentialRef` — reference a credential object by id (recommended; avoids duplicating secrets)
- ⏱️ `runtimeConfig.timeoutMs` — provider attempt timeout override

Advanced ops knobs (optional):

- 🕒 `executionWindow` (days/hours masks)
- 💾 `cacheTTLSeconds`
- 🧾 `trackingIOProbability`
- 🏷️ `costScore`, `latencyScore`, `qualityScore` (for policy-based routing tiers)

---

## 🚀 Quickstart (Docker runtime)

This quickstart is for **runtime/freeware (customer-hosted)** mode.
It runs the execution engine locally using Docker and a local `registry.json`.

This is a first-class option if you prefer to run DCDR yourself (including production in your infra). The trade-off is that you manage the registry lifecycle.

It’s also ideal for local/dev/test and offline evaluation.

If you are using **DCDR Cloud subscription**, you can skip this section:

- you don't need to run Docker
- you don't need to manage registries
- you configure intents in the control plane and call the provided runtime endpoint from your app

📦 Docker image:

- `dcdr.ai/dcdr-runtime:latest`

If you're evaluating the platform and want the managed control plane, start here: https://dcdr.ai

### 1) Create a local registry.json (HELLO_WORLD)

Copy the example file and edit it:

```bash
cp ./src/contracts/examples/registry.hello_world.json ./registry.json
```

Then replace:

- `REPLACE_ME_OPENAI_API_KEY` → your real OpenAI API key

✅ This example includes:

- 1 intent (`HELLO_WORLD`)
- 2 implementations (same provider `OPEN_AI`, two models)
- `executionPolicy.type = WEIGHTED` and implementation `weight` values in **0..1**
- OpenAI `endpoint` set to **`https://api.openai.com/v1`** (base URL)

### 2) Run the runtime container

#### Windows PowerShell

```powershell
docker pull dcdr.ai/dcdr-runtime:latest

docker run --rm -p 8000:8000 `
	-e API_TOKEN='dev-token' `
	-v "${PWD}/registry.json:/data/registry.json:ro" `
	dcdr.ai/dcdr-runtime:latest --registry /data/registry.json
```

#### Linux / macOS

```bash
docker pull dcdr.ai/dcdr-runtime:latest

docker run --rm -p 8000:8000 \
	-e API_TOKEN='dev-token' \
	-v "$PWD/registry.json:/data/registry.json:ro" \
	dcdr.ai/dcdr-runtime:latest --registry /data/registry.json
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
	-X POST http://localhost:8000/api/execution/run/HELLO_WORLD \
	-d '{"vars":{"name":"Ada"}}'
```

### 4) Swagger / OpenAPI

- 🧾 Swagger UI: `http://localhost:8000/api/docs`
- 🧬 OpenAPI JSON: `http://localhost:8000/api/openapi.json`

---

## 🧩 Use the TypeScript client

### Client config & auth modes

`DcdrRuntimeClient` supports two auth modes:

- 👤 **Customer mode (cloud subscription)**: `bearerToken` → sends `Authorization: Bearer <DcdrSessionToken>`
	- You obtain the `DcdrSessionToken` inside the DCDR Cloud control plane.
- 🛠️ **Internal/dev mode (self-hosted runtime)**: `apiToken` → sends `token: <token>` and optionally `x-session-bypass`

Install (in a Node/TS app):

```bash
npm i @dcdr/contracts
```

Example (internal/dev mode):

```ts
import { DcdrRuntimeClient } from "@dcdr/contracts/runtime.client";

const client = new DcdrRuntimeClient({
	baseUrl: "http://localhost:8000",
	apiToken: "dev-token",
});

const health = await client.healthcheck();
const res = await client.executeIntent("HELLO_WORLD", { vars: { name: "Ada" } });

console.log(health.status);
console.log(res.status, res.output);
```

### Core operations (methods)

`DcdrRuntimeClient` is a small, strongly-typed wrapper over the runtime HTTP API.

Quick map (method → HTTP surface):

| Method | HTTP | Auth | When to use |
|---|---|---|---|
| `healthcheck()` | `GET /api/system/healthcheck` | none by default | Load balancers / basic diagnostics |
| `metrics()` | `GET /api/system/metrics` | none by default | Prometheus scraping |
| `executeIntent(intent, request)` | `POST /api/execution/run/:intent` | required | Normal intent execution |
| `demo(intent, request)` | `POST /api/execution/demo/:intent` | required | Demo-specific intent execution |
| `dryRun(intent, vars)` | `POST /api/execution/dry-run/:intent` | required | Debug prompt rendering & resolved config |
| `eval(intent, vars)` | `POST /api/execution/eval/:intent` | required | Cloud-only evaluation workflows |
| `circuitBreakerStatus(provider, model?, tenantCid?)` | `GET /api/execution/circuit-breakers` | required | Observe breaker state (tenant-scoped) |
| `resetCircuitBreaker(provider, model?, tenantCid?)` | `PUT /api/execution/circuit-breakers/reset` | internal only | Reset breaker state (ops) |

What “auth required” means:

- **Customer mode (cloud subscription)**: set `bearerToken` (sends `Authorization: Bearer <DcdrSessionToken>`)
	- You create/get the token in the DCDR Cloud UI.
- **Internal/dev mode (self-hosted runtime)**: set `apiToken` (sends `token: <token>`) and optionally `sessionBypassToken` (sends `x-session-bypass`)

Common error patterns (all methods):

- Network/timeout errors: thrown as `Error` by the client.
- HTTP errors (non-2xx): thrown as `Error` with method/path/status and a body preview.

#### `healthcheck()`

- Returns a minimal `DcdrRuntimeHealthcheckResponse` so you can probe readiness/liveness.
- Does not require auth by default (runtime mounts `/api/system/*` without auth middleware).

#### `metrics()`

- Returns **raw Prometheus text** (same output as `curl /api/system/metrics`).
- See: `docs/PROMETHEUS_METRICS.md` for the metric reference.

#### `executeIntent(intent, request)`

- The core call your application makes in production.
- Endpoint: `POST /api/execution/run/:intent`
- Input contract: `ExecuteIntentRequest`
- Output contract: `ExecuteIntentResponse` (includes `report` for deep diagnostics)

#### `demo(intent, request)`

- Same shape as `executeIntent`, but targets the demo route: `POST /api/execution/demo/:intent`.
- Intended for curated demo intents (e.g. `DCDR_LOCAL_DEMO`).

#### `dryRun(intent, vars)`

- Endpoint: `POST /api/execution/dry-run/:intent`
- Purpose: validate and render prompt inputs without executing a provider/model call.
- Useful to debug template variables, prompt selection, and routing configuration.

#### `eval(intent, vars)`

- Endpoint: `POST /api/execution/eval/:intent`
- **Cloud-only**: in freeware runtime mode (local `--registry`), this endpoint can be disabled and return a `403`.

#### `circuitBreakerStatus(provider, model?, tenantCid?)`

- Endpoint: `GET /api/execution/circuit-breakers?provider=...&model=...`
- Breakers are **tenant-scoped server-side**.
	- In customer mode, the tenant is derived from the session token.
	- In internal mode, you may pass `tenantCid` to inspect a specific tenant.

#### `resetCircuitBreaker(provider, model?, tenantCid?)`

- Endpoint: `PUT /api/execution/circuit-breakers/reset`
- **Internal-only**: use this for ops tooling / controlled runbooks.
- Breakers are **tenant-scoped server-side**.

### Request/response shapes

The most common payload is `ExecuteIntentRequest`:

- `vars?: Record<string, unknown>` — template variables (e.g. `{ name: "Ada" }`)
- `routing?: { ... }` — optional routing hints (force provider/implementation, tune retries)

The response is `ExecuteIntentResponse`:

- `status: "OK" | "ERROR"`
- `output?: any` — parsed result (when OK). Shape depends on the intent's output schema.
- `error?: ExecutionError` — error details (when ERROR)
- `report: ExecutionReport` — full attempt-by-attempt report (attempts, timings, retry/fallback choices)

### Prometheus metrics

The runtime exports Prometheus metrics at:

- `GET /api/system/metrics`

Metric reference:

- `docs/PROMETHEUS_METRICS.md`

---

## 🧰 CLI (dcdr)

The runtime repository includes a small CLI called `dcdr`.

📌 Where it lives:

- It ships with the **runtime repo source** (it is not a standalone published binary yet).

Run it from the `dcdr-runtime` repository root:

```bash
npm ci
npm run dcdr -- --help
```

### Common commands

```bash
# Healthcheck
npm run dcdr -- health --base-url http://localhost:8000 --api-token dev-token

# Execute an intent
npm run dcdr -- run HELLO_WORLD --base-url http://localhost:8000 --api-token dev-token --vars-json '{"name":"Ada"}'

# Demo
npm run dcdr -- demo DCDR_LOCAL_DEMO --base-url http://localhost:8000 --api-token dev-token --vars-file ./vars.json

# Circuit breaker status
npm run dcdr -- circuit-breaker openai --base-url http://localhost:8000 --api-token dev-token

# Circuit breaker reset (internal-only)
npm run dcdr -- circuit-breaker-reset openai --base-url http://localhost:8000 --api-token dev-token
```

### Output options

- `--json` → machine-readable output
- `--color auto|always|never` → ANSI colors

---

## 🧬 Generate SDKs (Python/C#/Java) from OpenAPI

The runtime publishes a canonical OpenAPI spec. This is the best way to generate SDKs for other languages.

### 1) Get the OpenAPI JSON

Option A (simplest): download from a running runtime:

```bash
curl -sS http://localhost:8000/api/openapi.json > openapi.runtime.json
```

Option B (reproducible): dump from the runtime repo (recommended for CI and releases):

```bash
# From the `dcdr-runtime` repository root
npm run openapi:dump
```

This writes `openapi.runtime.json` deterministically.

### 2) Generate a client SDK

You can use OpenAPI Generator.

If you don't want to install anything globally, run it via Docker:

```bash
docker run --rm -v "$PWD:/local" openapitools/openapi-generator-cli \
	generate -i /local/openapi.runtime.json -g python -o /local/out/python
```

Windows PowerShell note: if `$PWD` doesn't mount correctly, try `-v "${PWD}:/local"`.

Other common targets:

```bash
# C#
docker run --rm -v "$PWD:/local" openapitools/openapi-generator-cli \
	generate -i /local/openapi.runtime.json -g csharp -o /local/out/csharp

# Java
docker run --rm -v "$PWD:/local" openapitools/openapi-generator-cli \
	generate -i /local/openapi.runtime.json -g java -o /local/out/java
```


### 3) Compatibility guidance

- Prefer generating against a pinned runtime version (or pinned `openapi.runtime.json`) to keep SDKs stable.
- The runtime API uses stable `operationId`s specifically to support SDK generation.

---

## 🧾 Example registry.json (HELLO_WORLD)

You can find a complete, copy/paste ready registry here:

- `src/contracts/examples/registry.hello_world.json`

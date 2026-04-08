# Platform overview

This content is moved from the README to keep the package entry point scannable.

## ⚙️ Execution modes

DCDR has exactly three execution modes from an operator/user perspective:

### Runtime (self-hosted)

- Who runs the runtime: you (in your infrastructure)
- Who manages the Registry: you (a local `registry.json`)
- Who controls configuration: you (files + your deployment process)
- When to use it: self-hosting, offline/air‑gapped environments, or when you want full control over Registry lifecycle

### Cloud

- Who runs the runtime: DCDR (managed)
- Who manages the Registry: Cloud
- Who controls configuration: Cloud (Intent, Implementation, Registry)
- When to use it: you want managed configuration and do not want to operate `registry.json` files

### Cloud Pro

- Who runs the runtime: DCDR (managed)
- Who manages the Registry: Cloud
- Who controls configuration: Cloud, with Cloud Pro entitlements enforced by the backend
- When to use it: you want Cloud, plus Cloud Pro features/entitlements as described in the matrix

## DCDR Runtime (self-hosted)

DCDR Runtime is the execution engine that runs intents (Docker).

- In Runtime (self-hosted), you run it yourself from a local `registry.json`.

## Cloud

Cloud is the managed configuration service for operating DCDR.

Learn more: https://dcdr.ai

What you get in Cloud:

- Stable intents + contracts: define once, call from your app forever (schemas included)
- Smart routing: multiple routing methods (per intent) without changing app code:
	- `WEIGHTED` (weights)
	- `FALLBACK_CHAIN` (fixed order)
	- `LOCAL_FIRST` (prefer on‑prem/office first)
	- `CHEAPEST_FIRST`, `FASTEST_FIRST`, `QUALITY_FIRST` (when metadata is present)
	- safe fallback behavior via `fallbackMode` (e.g. fall back to `WEIGHTED` or declared order, or fail fast)
	- plus per-request routing hints for debugging/ops (e.g. prefer/deny provider, force implementation)
	- Source contract: [../src/policies.contract.ts](../src/policies.contract.ts#L183)
- Retries + fallback: policy-driven attempts, backoff/jitter, and repair flows for strict JSON intents
- Execution tracing: understand which prompt + implementation actually ran, with attempt-by-attempt reports
- Managed credentials: keep secrets out of JSON files; reuse encrypted credentials across implementations
- Centralized logs + search: investigate failures, compare behavior across versions and implementations
- Prompt versioning + canary (where available): roll out changes gradually and measure impact

Cloud Pro extends Cloud with:

- Quality loop (tier-dependent): review outputs (QC), add annotations/taxonomy, and iterate safely
- Quality reports & drift detection (tier-dependent): detect when quality changes over time, then iterate with evidence from real traffic

Incremental operation (core idea):

- Version everything (intents, prompts, implementations) so production behavior is reproducible and changes are attributable
- Iterate prompts without touching implementations: improve quality/format/structure while keeping the same provider/model endpoints
- Iterate implementations without touching prompts: swap models, adjust weights, change routing/fallback, or roll out new endpoints safely
- Quality reports (tier-dependent): spot drift over time, then iterate with evidence from real traffic

In Cloud:

- You don’t manage `registry.json` files.
- You don’t run Docker.
- You call a managed runtime endpoint using `Authorization: Bearer <DcdrSessionToken>`.

Typical flow:

- 1) Go to the DCDR Cloud UI (https://dcdr.ai)
- 2) Define intents, prompts, implementations, policies, and credentials via UI
- 3) Create/get a customer token (`DcdrSessionToken`) for your app/user/workload
- 4) Call the runtime API using your preferred client (TypeScript client, OpenAPI-generated SDKs, etc.)

Feature matrix: [TIERS_FEATURE_MATRIX.md](TIERS_FEATURE_MATRIX.md)

## Key concepts

Before jumping into code, it helps to understand the three layers:

- Cloud: authoring, versioning, rollouts, logs/QC
- Runtime (self-hosted): executes intents and exposes HTTP API
- Clients: your app calls the runtime via HTTP (SDK/CLI)

### What is an intent?

An intent is a named AI capability, like a function.

Examples:

- `HELLO_WORLD` (simple chat response)
- `FORMAT_PARSER` (extract structure from product names)
- `EMBEDDING_SEARCH` (generate embeddings)

An intent includes:

- a prompt template (messages + params like temperature)
- a retry/fallback policy
- one or more implementations (provider + model + endpoint + auth)

### What is an Implementation?

An Implementation is a concrete execution configuration for an Intent (provider + model + endpoint + auth and runtime settings).

### What is a DCDR Registry?

A DCDR Registry is the configuration bundle that tells the runtime what it can execute.

In Cloud, you typically never create or edit a `registry.json` file yourself.
You manage intents, prompts, implementations, credentials, and policies in Cloud, and the runtime receives a validated Registry snapshot.

In Runtime (self-hosted), the Registry is commonly stored as a JSON file named `registry.json` (the filename is conventional) and passed to the runtime with `--registry <path>`.

It contains:

- the list of intents
- optional credentials
- optional signature metadata (Cloud Pro flows)

In Runtime (self-hosted), the runtime runs entirely from that `registry.json` file.

Good to know:

- You may omit `sha256` in Runtime (self-hosted) Registries: the runtime computes it.
- In Cloud Pro, Registries can be signed and verified.

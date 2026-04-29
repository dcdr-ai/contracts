# Changelog

This changelog is automatically generated from the runtime release process.
Entries show the changes introduced in each published build.
Labels indicate the affected area: <kbd>RUNTIME</kbd> or <kbd>CONTRACTS</kbd>.

## [20260429.1] — 11:08UTC

<!--
sourceCommit: d037540f375fc38d239a6350eeba72dc307f31a7
queuedAtUtc: 
previousMirroredBuild: 20260416.14 (2026-04-16)
contractsSubmodule: 06a7faa5e861..5c9c9c48c243
-->

### Added
- <kbd>RUNTIME</kbd> Auth diagnostic endpoint `GET /api/auth/check` to validate tokens and return session + optional entitlements snapshot.
- <kbd>RUNTIME</kbd> Opt-in provider/model E2E test suite (`npm run test:e2e:providers`) gated by env/CI.
- <kbd>RUNTIME</kbd> Optional query-token protection for `GET /api/system/metrics` via `DCDR_SYSTEM_METRICS_TOKEN`.
- <kbd>RUNTIME</kbd> Tenant cache eviction uses TTL + memory-pressure purge (enabled by default) via `TENANT_CONFIG_TTL_MS` and `TENANT_ENTITLEMENTS_CACHE_TTL_MS`.
- <kbd>RUNTIME</kbd> Added memory-pressure purge for tenant caches using watermarks (defaults: purge when memory used >= 75% aiming toward 50%).
### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.4.0`.
- <kbd>CONTRACTS</kbd> Added `DcdrRuntimeClient.authCheck()` and `DcdrRuntimeAuthCheckResponse` for runtime token validation diagnostics.
- <kbd>CONTRACTS</kbd> `DcdrRuntimeClient` now defaults `baseUrl` to `https://runtime.dcdr.ai` when omitted.
- <kbd>CONTRACTS</kbd> Added `SubscriptionStatus` / `SubscriptionStatusPolicy` and typed `DcdrEntitlementsContract.subscriptionStatus` for subscription enforcement surfaces.
- <kbd>RUNTIME</kbd> Customer entitlements enforcement now fails closed with `503` when backend entitlements are unavailable and no recent cached snapshot exists; uses cached snapshot during short backend outages.
- <kbd>RUNTIME</kbd> `GET /api/auth/check` only returns entitlements when token scopes include `entitlements:read` (or `*`).
- <kbd>RUNTIME</kbd> Added Prometheus counters for entitlements fetch and enforcement outcomes.
- <kbd>CONTRACTS</kbd> Added `SubscriptionStatus` enum and expanded `DcdrEntitlementsContract` to include optional subscription/business fields.
- <kbd>CONTRACTS</kbd> Expanded provider model catalog to include baseline OFFICE (vLLM/OpenAI-compatible) model IDs and added E2E legacy override exports.
- <kbd>RUNTIME</kbd> Graceful shutdown grace period is now configurable via `DCDR_SHUTDOWN_GRACE_MS` (default: 5000ms).
- <kbd>RUNTIME</kbd> Circuit breaker L1 now expires failure accumulation by `DCDR_CB_FAIL_WINDOW_MS` and prunes idle breaker key bookkeeping to reduce long-uptime memory growth.
- <kbd>RUNTIME</kbd> In-memory (no-Redis) usage counters now enforce per-counter TTL and are periodically pruned to prevent unbounded growth.
- <kbd>RUNTIME</kbd> Added Prometheus gauges for circuit breaker L1 footprint and in-memory usage delta entries.
- <kbd>RUNTIME</kbd> Public mirror changelog introduction text clarified to be more user-facing.
- <kbd>RUNTIME</kbd> Execution engine now respects `executionPolicy` when ordering implementation candidates (with explicit config errors on invalid policy metadata).
- <kbd>CONTRACTS</kbd> Added optional `executionPolicy.exploration` (epsilon-greedy top-K sampling) and `CapabilityKey.AI_INTENTS_EXPLORATION_POLICY` for Cloud-only exploration.
- <kbd>RUNTIME</kbd> Candidate planning supports explicit exploration after deterministic ordering (Cloud-only) and records bounded Prometheus counters for activations + chosen index bucket.
- <kbd>RUNTIME</kbd> Execution engine now falls back to the next candidate on `MODEL_UNSUPPORTED` when `allowFallback=true`.
- <kbd>RUNTIME</kbd> Execution engine supports an optional repair pass on `PARSE_FAIL`/`SCHEMA_FAIL` when `retryPolicy.repairOnParseFail=true`.
- <kbd>RUNTIME</kbd> Expanded execution reliability test coverage with real in-process integration tests for retry/fallback/policy behaviors and adapter-level error classification.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5*` runtime support metadata (status + preferred API) to support supported-only CI runs.
- <kbd>CONTRACTS</kbd> Added per-model `parameterSupport` metadata (generic prompt parameter support + recommendations) to help adapters and UIs avoid misconfiguration.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4*` runtime support metadata and removed deprecated legacy preview IDs to reduce catalog noise in provider E2E.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-3.5-turbo*` and `o*` runtime support metadata (preferred API routing) and removed non-chat / tool-required model IDs from the CHAT catalog.
- <kbd>CONTRACTS</kbd> Updated OpenAI model pricing snapshot for GPT-5.4/GPT-5.5 (and added long-context tier pricing where published).
- <kbd>CONTRACTS</kbd> Expanded `ExecutionError.code` to include `CONFIG_ERROR` and other runtime-mapped validation codes.
- <kbd>CONTRACTS</kbd> Expanded `ExecutionError.code` to include `PROVIDER_EMPTY_RESPONSE`.
### Fixed
- <kbd>RUNTIME</kbd> Enforce `entitlements.subscriptionStatus` (blocks execution when subscription is not ACTIVE/TRIAL).
- <kbd>RUNTIME</kbd> OpenAI-compatible provider adapter now extracts text from additional fields (e.g. `reasoning_content`) and rejects truly-empty completions instead of returning `output:null` with `status:OK`.
- <kbd>RUNTIME</kbd> OpenAI-compatible structured output mode now supports non-OpenAI backends by using `create` + local JSON/Zod validation instead of SDK `parse`.
- <kbd>RUNTIME</kbd> Upstream provider `model_not_found` (404) is mapped to `MODEL_NOT_FOUND` (HTTP 422) instead of `502` for clearer misconfiguration feedback.
- <kbd>RUNTIME</kbd> Upstream provider errors indicating a model does not support chat-completions are mapped to `MODEL_UNSUPPORTED` (HTTP 422) instead of `502`.
- <kbd>RUNTIME</kbd> OpenAI Responses-only reasoning models now return a clear 4xx when the token budget is too low to produce visible output.
- <kbd>RUNTIME</kbd> OpenAI provider now routes `gpt-5*` models via the Responses API by default and strips unsupported sampling params (e.g. `temperature=0`) to avoid avoidable 4xx errors.
- <kbd>RUNTIME</kbd> OpenAI SDK error payload extraction now inspects `error.error` / `response.data` so model validation errors can be classified consistently.
- <kbd>RUNTIME</kbd> OpenAI Responses structured mode now preserves `PROVIDER_EMPTY_RESPONSE` for empty outputs (was misclassified as `PARSE_FAIL`).
- <kbd>RUNTIME</kbd> Enforced customer session intent-scope checks on execution endpoints (prevents out-of-scope intent execution).
- <kbd>RUNTIME</kbd> Malformed JSON payloads to `/api/*` now return a stable 400 JSON error response (no HTML error rendering).
- <kbd>RUNTIME</kbd> Reduced error detail leakage by omitting stack traces from `INTERNAL_ERROR` responses outside development.
- <kbd>RUNTIME</kbd> Unknown `/api/*` routes now return a stable 404 JSON response.
- <kbd>RUNTIME</kbd> Malformed `/api/*` URLs now return a stable 400 JSON response.
- <kbd>RUNTIME</kbd> Hardened customer-mode rate limit enforcement by applying block escalation to both tenant `cid` and IP.
- <kbd>RUNTIME</kbd> Registry file loader now tolerates UTF-8 BOM and returns more actionable parse/validation errors (including file path) in `--registry` mode.
- <kbd>RUNTIME</kbd> Circuit breaker tenant scoping now strips control characters from `tenantCid` selectors to prevent CRLF/control-char reflection.

## [20260416.14] — 10:06UTC

<!--
sourceCommit: 833b5d9f7e1659da28bd7c127f4ba0173c639b9f
queuedAtUtc: 
previousMirroredBuild: 20260416.13 (2026-04-16)
-->

### Changed
- <kbd>RUNTIME</kbd> Public mirror changelog introduction text clarified to be more user-facing.

## [20260416.13] — 01:42UTC

<!--
sourceCommit: 833b5d9f7e1659da28bd7c127f4ba0173c639b9f
queuedAtUtc: 
previousMirroredBuild: 20260416.12 (2026-04-16)
-->

### Fixed
- <kbd>RUNTIME</kbd> Mirror changelog headings now include build time in UTC.

## [20260416.12] - 2026-04-16

<!--
sourceCommit: 48d5b7f3b2b295655c1f674dfca14ddbd13e929e
previousMirroredBuild: 20260416.11 (2026-04-16)
-->

### Changed
- <kbd>RUNTIME</kbd> Public mirror changelog hides build traceability metadata (commit/build/submodule) in an HTML comment for a cleaner user-facing view.

## [20260416.11] - 2026-04-16

Source commit: 69a82d39f9fafe8c1930910201ea73126d268e3b  
Previous source commit: e6237869a7180690c1f91ded3cb2a1e12a026025  
Previous mirrored build: 20260416.10 (2026-04-16)  

Delta basis: runtime CHANGELOG.md [Unreleased] at e6237869a7180690c1f91ded3cb2a1e12a026025 -> 69a82d39f9fafe8c1930910201ea73126d268e3b  

### Fixed
- <kbd>RUNTIME</kbd> Public mirror changelog delta computation now ignores whitespace-only changes to avoid repeating existing entries across builds.

## [20260416.10] - 2026-04-16

Source commit: e6237869a7180690c1f91ded3cb2a1e12a026025  
Previous source commit: 8e546bea0eebb37e5d20decc9982dce51d4225ab  
Previous mirrored build: 20260416.9 (2026-04-16)  

Delta basis: runtime CHANGELOG.md [Unreleased] at 8e546bea0eebb37e5d20decc9982dce51d4225ab -> e6237869a7180690c1f91ded3cb2a1e12a026025  

### Changed
- <kbd>CONTRACTS</kbd> Expanded documentation for `DcdrRuntimeClient` (auth modes, error behavior, and version diagnostics).
- <kbd>RUNTIME</kbd> Public mirror changelog now preserves historical build sections and formats build metadata with stable Markdown line breaks.

## [20260416.9] - 2026-04-16

Source commit: 8e546bea0eebb37e5d20decc9982dce51d4225ab
Previous source commit: 2d912fdd0accec2398a1f9577d0d175990786df5
Previous mirrored build: 20260416.7 (2026-04-16)
Contracts submodule: c0b65a0e293c..06a7faa5e861

Delta basis: runtime CHANGELOG.md [Unreleased] at 2d912fdd0accec2398a1f9577d0d175990786df5 -> 8e546bea0eebb37e5d20decc9982dce51d4225ab

### Changed
- <kbd>CONTRACTS</kbd> Expanded documentation for `DcdrRuntimeClient` (auth modes, error behavior, and version diagnostics). 

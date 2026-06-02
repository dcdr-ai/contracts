# Changelog

This changelog is automatically generated from the runtime release process.
Entries show the changes introduced in each published build.
Labels indicate the affected area: <kbd>RUNTIME</kbd> or <kbd>CONTRACTS</kbd>.

## [20260602.1] — 13:11UTC

<!--
sourceCommit: 72333c6a4baba5b38dc88e37bfa76b7120533609
queuedAtUtc: 
previousMirroredBuild: 20260601.2 (2026-06-01)
contractsSubmodule: 752bb6ba8206..f2c873f0b756
-->

(No user-facing changes since previous build.)

## [20260601.2] — 22:38UTC

<!--
sourceCommit: 5725e6e758cb4aae03738ad0bad035aecfcc601b
queuedAtUtc: 
previousMirroredBuild: 20260601.13 (2026-06-01)
contractsSubmodule: 48c23603adbb..752bb6ba8206
-->

(No user-facing changes since previous build.)

## [20260601.13] — 22:06UTC

<!--
sourceCommit: 441a1dddea8d7e2f080238cb7eecd178ce055aa2
queuedAtUtc: 
previousMirroredBuild: 20260601.11 (2026-06-01)
contractsSubmodule: 8376d6f80e62..48c23603adbb
-->

### Added
- <kbd>RUNTIME</kbd> Added `sample_registry.json` to provide a minimal local `--registry` starting point (inline credentials placeholder).
- <kbd>CONTRACTS</kbd> Added `docs/SUPPORTED_MODELS.md` (CHAT-only) generated from `ProviderModelRegistry` (excludes DCDR virtual aliases).
### Changed
- <kbd>RUNTIME</kbd> Runtime now listens on port `8000` by default (was `5000`).
- <kbd>CONTRACTS</kbd> Contracts README version badge now tracks npm (`@dcdr/contracts`) instead of a hardcoded version.
### Fixed
- <kbd>RUNTIME</kbd> Docker image now forwards runtime CLI flags (e.g. `--demo`, `--registry`) instead of treating them as Node options.
- <kbd>CONTRACTS</kbd> Fixed docs example links/paths for `registry.hello_world*.json` so copy/paste works in the GitHub mirror.

## [20260601.11] — 18:32UTC

<!--
sourceCommit: 8467cba589b410336af31d134625c74f12cddd09
queuedAtUtc: 
previousMirroredBuild: 20260601.10 (2026-06-01)
contractsSubmodule: eb46c76c2127..8376d6f80e62
-->

### Changed
- <kbd>RUNTIME</kbd> Runtime Docker image publishing migrated to `dcdrai/runtime` on Docker Hub.
- <kbd>RUNTIME</kbd> Documentation and pipeline references updated to use `dcdrai/runtime` as the official Docker image.
- <kbd>RUNTIME</kbd> Hardened npm publish pipeline to publish `@dcdr/contracts` from `src/contracts` (prevents accidental publishing of the root `dcdr-runtime` package).

## [20260601.10] — 18:15UTC

<!--
sourceCommit: 715ea107a35e052aac9d847c78b43f481843363a
queuedAtUtc: 
previousMirroredBuild: 20260601.1 (2026-06-01)
contractsSubmodule: 7256316914ac..eb46c76c2127
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.6`.
- <kbd>RUNTIME</kbd> Runtime Docker image publishing migrated to `dcdrai/dcdr-runtime` on Docker Hub.
- <kbd>RUNTIME</kbd> Documentation and pipeline references updated to use `dcdrai/dcdr-runtime` as the official Docker image.

## [20260601.1] — 09:44UTC

<!--
sourceCommit: 8d87045540db30f4437e2aa1ea944c4a98e844db
queuedAtUtc: 
previousMirroredBuild: 20260528.1 (2026-05-28)
contractsSubmodule: ddce1349b70e..7256316914ac
-->

### Added
- <kbd>RUNTIME</kbd> Added Prometheus gauges to compare backend customers registry rollups vs internal registry loaded in memory (gap + freshness + key totals).
- <kbd>RUNTIME</kbd> Added `dcdr validate-registry <path>` CLI command to validate local registry files and report schema issues.
- <kbd>CONTRACTS</kbd> Added `ProviderModelDefinition.tokenUsageCovered` to track which models have verified token usage reporting (billing invariant).
### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.1`.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.2`.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.3`.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.4` (test bump).
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.5`.
- <kbd>CONTRACTS</kbd> Exported `ExecutionErrorCode` (and `isExecutionErrorCode`) and migrated runtime code to use the enum instead of hardcoded error-code string literals.
- <kbd>CONTRACTS</kbd> Made `ExecutionError.code` strictly typed as `ExecutionErrorCode` (no string literals).
### Fixed
- <kbd>RUNTIME</kbd> Structured output schema builder now treats `PromptVariable.type/itemsType` case-insensitively (prevents accidental `anyOf` schemas).
- <kbd>RUNTIME</kbd> Runtime `--registry` startup now validates intent input/output schemas and fails with an actionable issues report when invalid.
- <kbd>RUNTIME</kbd> OpenAI Responses API executions now always propagate token usage (including on parse/schema failures when usage is available).
- <kbd>RUNTIME</kbd> Gemini executions now preserve token usage on parse/schema failures when usage metadata is available.

## [20260528.1] — 14:24UTC

<!--
sourceCommit: 5b6039e7fbeef8986b92aec7d5b75c1061b814ab
queuedAtUtc: 
previousMirroredBuild: 20260525.3 (2026-05-25)
contractsSubmodule: 437ed598dd7d..ddce1349b70e
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.0`.
### Fixed
- <kbd>RUNTIME</kbd> Control-plane registry sync now computes `sha256` using stable JSON ordering to match backend semantic hashing.
- <kbd>RUNTIME</kbd> OpenAI Responses structured output now falls back to JSON-object + local validation when the provider rejects the generated schema (`invalid_json_schema`), avoiding hard 422 failures.
- <kbd>CONTRACTS</kbd> Added execution error code `TOKEN_BUDGET_TOO_LOW` for reasoning models that return no visible output under small token budgets (mapped to HTTP 400).
- <kbd>RUNTIME</kbd> Session intent-scope enforcement now supports `execute:*` and `execute:<INTENT>` (plus legacy intent-name scopes); forbidden responses include required scope hints.

## [20260525.3] — 17:05UTC

<!--
sourceCommit: 126bce84149a52e45c1e6d5057f259ff74d463e2
queuedAtUtc: 
previousMirroredBuild: 20260525.2 (2026-05-25)
-->

### Fixed
- <kbd>RUNTIME</kbd> Execution reports now include `outputHash` on successful executions (stable hash of normalized output).

## [20260525.2] — 16:32UTC

<!--
sourceCommit: 1f051222f4218c35477eede901e00d1978e5aaf4
queuedAtUtc: 
previousMirroredBuild: 20260525.1 (2026-05-25)
contractsSubmodule: a4a4308992a9..437ed598dd7d
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.8.3`.
- <kbd>CONTRACTS</kbd> Expanded managed public model curation to 3 models per category (added Gemini `gemini-3.1-pro-preview` as `BEST`, Gemini `gemini-3-flash-preview` as `FAST`, and OpenAI `gpt-5.4-nano` as `ECONOMY`).

## [20260525.1] — 07:44UTC

<!--
sourceCommit: d250b28908d7886d29497655aa4f23f666ec3809
queuedAtUtc: 
previousMirroredBuild: 20260524.2 (2026-05-24)
contractsSubmodule: 3099d7ab05f6..a4a4308992a9
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.8.2`.
- <kbd>CONTRACTS</kbd> Added `ProviderModelDefinition.publicForCustomers` (fail-closed), managed category metadata (`DcdrPublicModelCategory`, tiers, use cases, `publicName`/`badge`, explicit recommendation/default flags), and listing helpers (`ProviderModelRegistry.listProviderModels(..., { onlyPublicForCustomers })`, `listPublicCustomerModels*`) to support curated customer-facing model lists.

## [20260524.2] — 16:47UTC

<!--
sourceCommit: 6c9d514b54263ce3757aa3bdb6739f1124adabf8
queuedAtUtc: 
previousMirroredBuild: 20260524.1 (2026-05-24)
contractsSubmodule: 88c7b79fecba..3099d7ab05f6
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.8.1`.
- <kbd>CONTRACTS</kbd> Added `DcdrEntitlementsContract.dcdrVirtual` to allow backend to disable the paid DCDR virtual provider per tenant (fail-open when omitted).
- <kbd>CONTRACTS</kbd> Added execution error code `PAYMENT_REQUIRED`.
- <kbd>RUNTIME</kbd> Execution engine blocks `IntentProvider.DCDR` attempts when `entitlements.dcdrVirtual.enabled=false` (HTTP 402 + `PAYMENT_REQUIRED`) while still allowing BYOK fallbacks.

## [20260524.1] — 07:10UTC

<!--
sourceCommit: b418e7c9dd51f03c5f8467917655ea1cc750c6e0
queuedAtUtc: 
previousMirroredBuild: 20260504.3 (2026-05-04)
contractsSubmodule: 44f40761f11e..88c7b79fecba
-->

### Added
- <kbd>RUNTIME</kbd> Added cloud-only backend credential resolution via `CredentialsContract.resolution=BACKEND` (requires trusted registry signature; rejected in `--registry` mode).
- <kbd>RUNTIME</kbd> Enabled `IntentProvider.OPEN_AI_COMPATIBLE` execution via the OpenAI-compatible adapter to support customer-provided internal endpoints (e.g. vLLM-style gateways).
### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.8.0`.
- <kbd>CONTRACTS</kbd> Added virtual provider `IntentProvider.DCDR` with namespaced model IDs (`provider/model`) resolving to runtime-supported models across implemented providers.
- <kbd>CONTRACTS</kbd> Refreshed OpenAI and Gemini model catalogs with newly discovered model IDs (May 2026 sync) and updated Gemini runtime support metadata for `gemini-3.1-flash-lite` and `gemini-3.5-flash`.
- <kbd>CONTRACTS</kbd> Added official OpenAI pricing metadata for `gpt-image-*`, `gpt-audio*`, and `gpt-realtime*` model families (standard pricing snapshot).
### Fixed
- <kbd>RUNTIME</kbd> OpenAI structured output schema generation no longer emits empty JSON Schema nodes that OpenAI rejects (fixes `invalid_json_schema` 400s).
- <kbd>RUNTIME</kbd> OpenAI Responses structured mode now falls back to local JSON/Zod validation when the declared output schema contains freeform JSON/object shapes that OpenAI schema validation rejects.
- <kbd>CONTRACTS</kbd> Mark OpenAI `o1-mini` as account-gated (`model_not_found`) and skip it by default in provider E2E curation.
- <kbd>RUNTIME</kbd> Gemini adapter now disables thinking by default for `gemini-3.5-flash` under small token budgets and tolerates minor structured-output formatting (code fences/prefix text), fixing empty output and JSON parse failures in provider E2E.
- <kbd>RUNTIME</kbd> Anthropic adapter now preserves stable `ExecutionError` codes for structured schema failures and empty responses (was incorrectly mapped to `UPSTREAM_5XX`).

## [20260504.3] — 23:03UTC

<!--
sourceCommit: eeb7704f53b1a0f7ee5d390d79ac24be1c632014
queuedAtUtc: 
previousMirroredBuild: 20260504.2 (2026-05-04)
-->

(No user-facing changes since previous build.)

## [20260504.2] — 18:25UTC

<!--
sourceCommit: eeb7704f53b1a0f7ee5d390d79ac24be1c632014
queuedAtUtc: 
previousMirroredBuild: 20260504.1 (2026-05-04)
contractsSubmodule: 6fab9996df38..44f40761f11e
-->

### Added
- <kbd>RUNTIME</kbd> Added Anthropic (Claude) provider adapter for CHAT intents via `@anthropic-ai/sdk`, including structured outputs with local validation and optional streaming deltas.
- <kbd>RUNTIME</kbd> Added Gemini provider adapter for CHAT intents via `@google/genai`, including structured outputs (JSON schema + local validation) and optional streaming deltas.
### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.7.0`.
- <kbd>CONTRACTS</kbd> Provider model catalog now only enumerates implemented providers (OpenAI, OFFICE, Anthropic, Gemini); other provider model lists are kept empty until implemented.
- <kbd>CONTRACTS</kbd> Provider model catalog now includes a minimal Gemini CHAT starter model (`gemini-2.5-flash`) marked `SUPPORTED` after provider E2E validation.
- <kbd>CONTRACTS</kbd> Expanded Gemini model catalog to include all discovered `gemini-*` model IDs (CHAT + EMBEDDING) with initial runtime support metadata and E2E legacy overrides.
- <kbd>CONTRACTS</kbd> Curated Gemini CHAT runtime support statuses based on provider E2E (text + structured + streaming SSE).
- <kbd>CONTRACTS</kbd> Added official Gemini model token pricing metadata (per-million tokens + tiers) to the provider model catalog.
- <kbd>CONTRACTS</kbd> Versioned model IDs now inherit missing pricing from their base model (marked as `approx`) to avoid catalog pricing gaps.
- <kbd>CONTRACTS</kbd> Marked Anthropic `claude-opus-4-7` as `SUPPORTED` after provider E2E validation (run + streaming SSE).
### Fixed
- <kbd>RUNTIME</kbd> Gemini adapter now avoids sending `thinkingConfig` to models that reject it and uses a prompt-based structured fallback for models that do not support native `responseSchema`.
- <kbd>RUNTIME</kbd> Anthropic `claude-opus-4-7` calls now omit deprecated sampling parameters to avoid upstream 4xx errors.
- <kbd>RUNTIME</kbd> Gemini adapter now disables thinking by default (unless `enable_thinking=true`) to avoid empty outputs when token budgets are small.

## [20260504.1] — 09:47UTC

<!--
sourceCommit: da8690c664a8e6040c32a141461e22b80491a419
queuedAtUtc: 
previousMirroredBuild: 20260429.2 (2026-04-29)
contractsSubmodule: 1fb4b3610ba5..6fab9996df38
-->

### Added
- <kbd>RUNTIME</kbd> Added SSE streaming execution endpoint `POST /api/execution/stream/:intent` (meta/delta/final) and client helper `DcdrRuntimeClient.executeIntentStream()`.
### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.5.0`.
### Fixed
- <kbd>RUNTIME</kbd> SSE streaming now aborts upstream work more reliably when the client disconnects mid-stream.

## [20260429.2] — 11:42UTC

<!--
sourceCommit: d464a739471e112dbd52b4abceea3b09ded14d3c
queuedAtUtc: 
previousMirroredBuild: 20260429.1 (2026-04-29)
contractsSubmodule: 5c9c9c48c243..1fb4b3610ba5
-->

(No user-facing changes since previous build.)

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

# Changelog

This changelog is automatically generated from the runtime release process.
Entries show the changes introduced in each published build.
Labels indicate the affected area: <kbd>RUNTIME</kbd> or <kbd>CONTRACTS</kbd>.

## [20260714.2] — 15:56UTC

<!--
sourceCommit: ff78911326a9c8b05aec1b9d5d80e8b1e5844bd3
queuedAtUtc: 
previousMirroredBuild: 20260713.1 (2026-07-13)
contractsSubmodule: 22f2c820d394..dd450259b05b
-->

### Added
- <kbd>CONTRACTS</kbd> v2.8.0 — Added optional `ExecutionReport.serviceTokenId` so managed customer/service-token executions can expose the backend-issued token id as additive audit metadata without overloading `sessionId` or `context`.
### Changed
- <kbd>RUNTIME</kbd> Runtime now propagates `serviceTokenId` consistently into `ExecutionReport` and backend execution logs for customer-token executions, including standard intent runs, eval/stream/demo flows, gateway logs, and router-level fallback error responses.
- <kbd>CONTRACTS</kbd> v2.7.0 â€” Extended the shared backend log envelope so gateway `/v1/*` traffic can emit additive `executionMode=GATEWAY` metadata plus safe gateway request/response summaries without pretending to be a full intent execution report.
### Added
- <kbd>CONTRACTS</kbd> v2.8.0 — Added optional `ExecutionReport.serviceTokenId` so managed customer/service-token executions can persist the backend-issued token id as additive audit metadata without overloading `context` or `sessionId`.
- <kbd>RUNTIME</kbd> Runtime now propagates the backend-issued `serviceTokenId` into `ExecutionReport` for customer-token intent executions, eval/stream/demo variants, and OpenAI-compatible gateway logs.
- <kbd>RUNTIME</kbd> OpenAI-compatible gateway routes now enqueue backend execution logs through the same shared log pipeline used by intents, using an additive `executionMode=GATEWAY` envelope with safe `/v1/models`, `/v1/responses`, and `/v1/chat/completions` request/response summaries plus resolved provider/model/credential metadata.

## [20260713.1] — 02:41UTC

<!--
sourceCommit: 790d78839d4d24fa482e767fb66faaf84a5c54e4
queuedAtUtc: 
previousMirroredBuild: 20260712.1 (2026-07-12)
contractsSubmodule: 8763bd03c8a2..22f2c820d394
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.7.0 â€” Enriched intent-processing governance rules with typed policy trail metadata (`ProcessingPolicyOutcome`, `ProcessingPolicyReasonCode`) and contract-ready optional region filters on provider/model policy checks, using non-blocking `REGION_CONTEXT_MISSING` trail outcomes when runtime has no explicit region context to enforce.
- <kbd>CONTRACTS</kbd> v2.7.0 â€” Tightened intent-processing governance authoring with shared enum catalogs: provider allow/deny lists now validate against `IntentProvider`, `OUTPUT_POLICY_CHECK.policyRef` now uses `ProcessingOutputPolicyRef`, and `REVIEW_ROUTING.queue` now uses `ProcessingReviewQueue`.
- <kbd>CONTRACTS</kbd> v2.7.0 — Added the public intent-processing contract wave: `processing.contract`, optional `DcdrRegistry.processors` and `IntentContract.processors`, shared validation/default helpers, explicit rule-group metadata for UI grouping, a broader first-wave primitive catalog, enum-backed regex options, and shared condition-tree reuse (`ConditionOp` / `ConditionLogicOp`) so routing-condition builders and processing-rule builders can stay nearly identical in frontend.
### Added
- <kbd>RUNTIME</kbd> Intent processing now executes as a real stage-based engine instead of a no-op scaffold: runtime orders processors deterministically, evaluates optional shared condition trees before each rule, applies built-in switch-dispatched handlers, records bounded trail/evidence, logs the effective `PRE -> INTENT -> POST` pipeline, and handles rule failures explicitly via `FAIL_CLOSED` / `FAIL_OPEN` / `WARN_ONLY` instead of letting handler errors tear down execution opaquely.
- <kbd>RUNTIME</kbd> Intent processing now resolves both `DcdrRegistry.processors` and `IntentContract.processors` with explicit execution order, validates configured processors/conditions at registry-load time, and skips rules cleanly when their shared condition tree does not match.
- <kbd>CONTRACTS</kbd> v2.7.0 — Added a public `processing.contract` surface for the intent-only governed processing engine: shared enums/interfaces for `INPUT`/`OUTPUT` stages, built-in rule kinds, bounded processing/mutation trail reporting, cache-safety metadata, and pure `IntentProcessingSemantics` helpers so frontend/runtime can preview and test the same rule semantics.
- <kbd>RUNTIME</kbd> Added the first intent-processing scaffold: execution reports can now carry a bounded `report.processing` block, runtime preserves the original caller request separately from the processed execution request, and the new no-op `INPUT`/`OUTPUT` processing hooks establish the invariant that future `problemHash`/`runHash` are based on processed input while `outputHash` is based on final post-processed output.
- <kbd>RUNTIME</kbd> Added the first executable OpenAI governance gateway slice with a dedicated `/v1` router, backend-driven gateway token validation (`/dcdr/token/check`), an OpenAI-compatible `GET /v1/models` surface filtered by provider bindings and provider/model governance limits, and real SDK-backed passthrough proxying for `/v1/responses` and `/v1/chat/completions` on currently supported OpenAI-compatible providers (`OPEN_AI`, `GROK`, `MISTRAL`), including stable gateway-side normalization for backend/credentials/upstream failure paths.
- <kbd>RUNTIME</kbd> Extended the `/v1` governance gateway to accept runtime-configured `OPEN_AI_COMPATIBLE` upstreams through `DCDR_GATEWAY_OPENAI_COMPATIBLE_BASE_URL` plus `DCDR_GATEWAY_OPENAI_COMPATIBLE_MODEL_IDS`, and added explicit `openai-compatible/<modelId>` routing to avoid cross-provider model ambiguity without inventing a new backend token flow.

## [20260712.1] — 12:16UTC

<!--
sourceCommit: 5339a4fe8e689270c6b4b423dc3db8d720e0d656
queuedAtUtc: 
previousMirroredBuild: 20260706.1 (2026-07-06)
contractsSubmodule: 9d32bebc1a1f..8763bd03c8a2
-->

### Fixed
- <kbd>CONTRACTS</kbd> v2.5.3 — **Production-breaking bug fix**: `provider.contract.ts` defined the `IntentProvider` enum and, in the same file, re-exported (`export * from`) `provider.catalog.contract`, which imports `IntentProvider` back and uses it as an object key at module top level. Node's `require()` tolerated this self-referential cycle by textual evaluation order, but bundler CJS-interop (Rollup/Vite, esbuild, webpack) is not guaranteed to preserve that order, so production client bundles could crash at module-eval time with `Cannot read properties of undefined (reading 'DCDR')`. Fixed by moving the re-export into the root barrels only (one-directional DAG), added a dedicated `@dcdr/contracts/provider.catalog.contract` subpath export for catalog symbols, and added `tools/check-no-barrel-cycles.js` (gated on `check`/`test`/`test:ci`/`prepublishOnly`) to reject this file shape repo-wide going forward.
- <kbd>CONTRACTS</kbd> Fixed a stray-character typo in `provider.catalog.contract.ts` (accidentally introduced in the v2.5.3 fix above) that broke `tsc`/`npm run build`.
- <kbd>RUNTIME</kbd> Updated internal imports (`anthropic.provider.ts`, `gemini.provider.ts`, `openai.provider.ts`, `provider.executor.service.ts`, and related tests) that pulled catalog-only symbols (`ProviderModelRegistry`, `PROVIDER_MODEL_E2E_OVERRIDES`, etc.) through `@dcdr/contracts/provider.contract` to import them from the new `@dcdr/contracts/provider.catalog.contract` subpath instead, ahead of the contracts fix above.
- <kbd>RUNTIME</kbd> **Security fix**: `getManagedAsset`, `deleteManagedAsset`, and `getManagedAssetSignedUrl` now reject any client-supplied `assetPath` that falls outside the caller's own tenant-scoped `basePath`.
### Added
- <kbd>CONTRACTS</kbd> v2.6.0 — Added a public `provider-limits.contract` surface (`DcdrProviderLimitGate`, `DcdrProviderLimitEntry`, `DcdrProviderLimitsConfig`) so backend/runtime/UI can share one tenant-level provider/model governance contract for enablement, call windows, and budget windows.
- <kbd>CONTRACTS</kbd> Added the well-known service-token scope `gateway` plus optional `gatewayBindings` entries (`provider` + `credentialRef`) so a tenant service token can point each provider to one backend-managed credential reference for the future OpenAI-compatible proxy surface.

## [20260706.1] — 00:33UTC

<!--
sourceCommit: b27445c16f75a2223d85c9d610a2425dc28a6f9d
queuedAtUtc: 
previousMirroredBuild: 20260704.1 (2026-07-04)
contractsSubmodule: b1d38a90d440..9d32bebc1a1f
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.5.2 — Added optional `ExecutionReport.request.vars` so the original, pre-interpolation `ExecuteIntentRequest.vars` can be preserved end-to-end.
- <kbd>RUNTIME</kbd> Every execution log/event sent to the backend (success, error, retry, fallback, and eval sub-runs) now includes `request.vars` sourced directly from the original incoming request, never from rendered prompt text or derived template defaults, so backend `AICallLog.requestVars` persistence and dataset-evaluation replay use the exact logical input the caller sent. `context` behavior is unchanged and `vars` is not duplicated into `context`.

## [20260704.1] — 15:04UTC

<!--
sourceCommit: 1ce633bffbc15ff62607f3d99830b86f1afa5c0b
queuedAtUtc: 
previousMirroredBuild: 20260703.4 (2026-07-03)
contractsSubmodule: 745aa294da80..b1d38a90d440
-->

### Changed
- <kbd>CONTRACTS</kbd> Re-curated Anthropic `claude-sonnet-5` with the 1024-token baseline: it remains `SUPPORTED`, now publishes `IMAGE` and `DOCUMENT` across `INLINE`/`URL`/`ASSET`, and keeps `TEXT` out of the promoted rectangle because URL-based text still fails the canonical comprehension assertion.
- <kbd>CONTRACTS</kbd> Reclassified Anthropic `claude-fable-5` to `SUPPORTED` after rerunning `text + structured` with the 1024-token baseline, published a full `TEXT`/`IMAGE`/`DOCUMENT` x `INLINE`/`URL`/`ASSET` multimodal rectangle, and documented that very small text budgets can be consumed by thinking before any visible text is emitted.
### Added
- <kbd>CONTRACTS</kbd> Expanded the Gemini provider catalog with newly discovered `gemini-3.1-flash-lite-image`, `gemini-3.5-live-translate-preview`, and `gemini-omni-flash-preview`, classifying the image/video families as non-CHAT entries and documenting their current runtime limitations conservatively from provider E2E.
- <kbd>CONTRACTS</kbd> Expanded the Anthropic provider catalog with newly discovered `claude-sonnet-5` and `claude-fable-5` chat model IDs as uncured `IN_PROGRESS` entries, and marked the local-only compatibility alias `claude-haiku-4-5` as `LEGACY` for Anthropic provider E2E.
- <kbd>CONTRACTS</kbd> Expanded the Mistral provider catalog with newly discovered chat/code and embedding model IDs from `/v1/models`, leaving them conservatively uncured as `runtimeSupport=IN_PROGRESS` while continuing to exclude Mistral OCR/moderation families from the current runtime surface.
- <kbd>CONTRACTS</kbd> Added `IntentType.VIDEO_GENERATION` and cataloged the newly discovered xAI `grok-imagine-*` image/video generation model IDs as non-CHAT entries with conservative `runtimeSupport=IN_PROGRESS` pending adapter work and curation.

## [20260703.4] — 22:30UTC

<!--
sourceCommit: 6d37fab0234625a6cf6bf2298b8b767a311e5739
queuedAtUtc: 
previousMirroredBuild: 20260703.3 (2026-07-03)
contractsSubmodule: 69e3d070da5e..745aa294da80
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.5.0 — Added a public tracked-call rating matrix contract (`tracked-call-rating.contract`) with a versioned multimodal multiplier table, aggregate guardrails, and shared default v1 metadata so backend/UI can render and audit the same policy the runtime uses.
- <kbd>RUNTIME</kbd> Runtime now computes `ExecutionReport.trackedCallAccounting` from the shared tracked-call rating matrix instead of the old placeholder `multimodal_rating_not_applied`, including fractional multipliers, dominant bucket metadata, and aggregate non-text input-size guardrails.

## [20260703.3] — 20:07UTC

<!--
sourceCommit: 8606e96bcefd2258ddf023c5c77a80c12699a158
queuedAtUtc: 
previousMirroredBuild: 20260703.1 (2026-07-03)
contractsSubmodule: ac5cf2ac9689..69e3d070da5e
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.4.3 — Extended multimodal execution report evidence so URL-backed `inputParts` preserve `sourceKind=URL` plus the caller-provided `url`, and ASSET-backed references preserve `storageId` + `storageOwner` for QC/backend rehydration without exposing inline payload bytes.
### Added
- <kbd>RUNTIME</kbd> Execution reports now retain caller-supplied remote URLs for `inputParts` with `source.kind=URL`, and ASSET-backed references now carry `storageId` plus `storageOwner` so backend QC panels can reload evidence from system vs customer storage deterministically.
- <kbd>RUNTIME</kbd> Populate `ExecutionReport.inputParts` (as `ExecutionReportPart[]`) for every successful multimodal execution so backends can track which assets were used as input for QC and audit workflows. Each report part carries `type`, `mimeType`, `name`, `sizeBytes`, `sha256`, and the report-safe `asset` reference (`storageId`, `storageOwner`, `assetPath`) for ASSET-backed parts. Inline binary content is intentionally excluded.

## [20260703.1] — 16:56UTC

<!--
sourceCommit: e18cf3f4626919944c7c1ab4e0ef89aeb74e6494
queuedAtUtc: 
previousMirroredBuild: 20260701.1 (2026-07-01)
contractsSubmodule: cb9b46e0a40c..ac5cf2ac9689
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.5.0 — Extended `ExecutionReportPart` so URL-backed `inputParts` can preserve `sourceKind=URL` plus the caller-provided `url` in execution reports, while keeping inline payload bytes excluded.
### Added
- <kbd>RUNTIME</kbd> Execution reports now retain caller-supplied remote URLs for `inputParts` with `source.kind=URL`, alongside the source kind metadata, so backend QC/audit flows can distinguish URL-backed inputs from managed assets.

## [20260701.1] — 11:59UTC

<!--
sourceCommit: aa0855043206c050829e77b299b3e0701745eee8
queuedAtUtc: 
previousMirroredBuild: 20260630.1 (2026-06-30)
contractsSubmodule: eeca3f8a4783..cb9b46e0a40c
-->

### Added
- <kbd>RUNTIME</kbd> Populate `ExecutionReport.inputParts` (as `ExecutionReportPart[]`) for every successful multimodal execution so backends can track which assets were used as input for QC and audit workflows. Each report part carries `type`, `mimeType`, `name`, `sizeBytes`, `sha256`, and the full `asset` reference (`datasource` + `assetPath`) for ASSET-backed parts. Inline binary content is intentionally excluded.

## [20260630.1] — 19:17UTC

<!--
sourceCommit: c47c253a83de325a7517dd6a7ceb3773dc3cbcd7
queuedAtUtc: 
previousMirroredBuild: 20260629.6 (2026-06-29)
contractsSubmodule: 87e1a98b927b..eeca3f8a4783
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.4.0 — Added shared backend/runtime `storage.credentials.contract` exports for backend-managed asset-storage credential resolution, keeping `DcdrAssetStorageDescriptor` secret-free while formalizing Google Cloud today and future `S3`/`FTP`/`NAS` credential payloads through shared interfaces.
- <kbd>RUNTIME</kbd> Managed asset storage now resolves backend-managed storage credentials per tenant `storageId`/`datasource.id` with short in-memory caching, while preserving compatibility for the current shared cloud-managed storage through an explicit default `storageId`.

## [20260629.6] — 18:51UTC

<!--
sourceCommit: 62c0c85b70a4f2647745d0e5d5a9294f88663564
queuedAtUtc: 
previousMirroredBuild: 20260629.4 (2026-06-29)
contractsSubmodule: 5e097ffd48ad..87e1a98b927b
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.3.1 — Re-exported asset contract surface from the root `@dcdr/contracts` barrel: `DcdrAssetScope`, `DcdrAssetStorageDescriptor`, `DcdrAssetMetadata`, `DcdrAssetMetadataAttributes`, `DcdrAssetUploadRequest/Response`, `DcdrAssetGetRequest/Response`, `DcdrAssetDeleteRequest/Response`, `ASSET_TYPE_VALUES`, `ASSET_TYPE_LABELS`. Added `types` conditions to all `exports` entries and a full `typesVersions` map for compatibility with `moduleResolution: node` and `node16`/`bundler` consumers.

## [20260629.4] — 17:00UTC

<!--
sourceCommit: 61a9bd2ce73769737d6d496e920873cdceacce05
queuedAtUtc: 
previousMirroredBuild: 20260613.2 (2026-06-13)
contractsSubmodule: c8b48151182f..5e097ffd48ad
-->

### Fixed
- <kbd>RUNTIME</kbd> Fixed managed asset lifecycle tests (`/api/assets/upload`, `/api/assets`, `DELETE /api/assets`) and signed-URL tests failing in CI with HTTP 400 / `CONFIG_ERROR` because `storage/credentials/cloud.test.credentials.json` is gitignored and not available on CI agents. Added `setManagedStorageRuntimeConfigForTests()` to `execution.asset.storage.service` so tests can inject a mock storage config directly into the cache, bypassing disk reads entirely. Production behavior is unchanged.
### Added
- <kbd>CONTRACTS</kbd> Added optional `PromptParameters.preferred_api` (`CHAT_COMPLETIONS` | `RESPONSES`) so implementations can override the upstream OpenAI-compatible API surface explicitly through `runtimeConfig`.
- <kbd>RUNTIME</kbd> Added a shared provider-side multimodal materialization path for `INLINE` / `URL` / `ASSET` inputs so Gemini, Anthropic, and OpenAI can resolve remote and managed assets through one common helper instead of per-adapter ad hoc logic.
- <kbd>CONTRACTS</kbd> Added empty-ready `runtimeSupport.outputParts` catalog metadata so provider/model curation can track verified multimodal output-part families and source kinds separately from `inputParts`.
- <kbd>CONTRACTS</kbd> Added explicit managed asset lifecycle contracts (`DcdrAssetUploadRequest/Response`, `DcdrAssetGetRequest/Response`, `DcdrAssetDeleteRequest/Response`, `DcdrAssetStorageDescriptor`) plus `DcdrRuntimeClient.uploadAsset()`, `getAsset()`, and `deleteAsset()`.
- <kbd>CONTRACTS</kbd> Added client-side asset helpers `prepareAssetUploadRequest()` and `prepareAssetInputPart()` so TypeScript callers can upload with minimal fields and build asset-backed `inputParts` without handcrafting the wire shape.
- <kbd>CONTRACTS</kbd> Added `PromptVariableType.ASSET` plus `ExecutionInputPart.variableName` so intents can declare strong asset slots and callers can bind each input part to a named prompt variable instead of relying on file names.
- <kbd>CONTRACTS</kbd> Added semantic managed asset metadata (`title`, `description`, `alt`, `tags`, string `attributes`) and a shared default `buildDcdrAssetCacheKey()` helper for tenant-global cache identity.
- <kbd>RUNTIME</kbd> Added dedicated managed asset lifecycle routes under `/api/assets` for upload/get/delete, with tenant-default storage resolution, canonical asset cache paths, CRUD logging, mocked integration coverage, and opt-in real-bucket E2E coverage.
- <kbd>RUNTIME</kbd> Added cloud-only managed storage persistence for inline non-text execution `outputParts`, resolving the target bucket from `storage/config/<NODE_ENV>.json` and `storage/credentials/cloud.<NODE_ENV>.credentials.json`, while keeping freeware/runtime mode inline-only plus an opt-in real-bucket E2E suite (`npm run test:e2e:storage`).
### Changed
- <kbd>RUNTIME</kbd> Multimodal provider smoke tests and official curators now use `max_tokens=1024` as the default cross-provider baseline instead of the older `256`-token cap, reducing avoidable empty-response false negatives during paid comprehension curation.
- <kbd>RUNTIME</kbd> Gemini, Anthropic, and OpenAI provider adapters now use the shared multimodal input materializer and must fail explicitly when `URL` or `ASSET` inputs cannot be resolved, instead of silently discarding those parts before provider submission.
- <kbd>RUNTIME</kbd> OpenAI-compatible adapters now accept `implementation.runtimeConfig.preferred_api` (`CHAT_COMPLETIONS` or `RESPONSES`) as an explicit routing override, so provider-specific surfaces like Grok multimodal can force the correct upstream API without baking more vendor policy into the generic adapter.
- <kbd>CONTRACTS</kbd> Published the first conservative Grok multimodal rectangle for `grok-build-0.1`: `DOCUMENT` now clears the comprehension-grade curator across `INLINE`, `URL`, and `ASSET`, the entry explicitly prefers `RESPONSES` for multimodal execution, and broader `IMAGE`/`TEXT`/`AUDIO`/`VIDEO` claims remain deferred until the mixed matrix is resolved.
- <kbd>CONTRACTS</kbd> Curated `grok-4.3` with the comprehension-grade Grok curator via Responses API and published an `IMAGE`/`DOCUMENT` x `INLINE`/`URL`/`ASSET` multimodal rectangle: both asset families pass all three source kinds cleanly; `TEXT` passes `URL` only and cannot be included without overstating `INLINE`/`ASSET`; `AUDIO` and `VIDEO` echo filename metadata only across all source kinds.
- <kbd>CONTRACTS</kbd> Curated `grok-4.20-0309-non-reasoning` with the comprehension-grade Grok curator via Responses API and published a `TEXT`/`IMAGE`/`DOCUMENT` x `INLINE`/`URL`/`ASSET` multimodal rectangle: all three asset families pass all three source kinds. `AUDIO` echoes filename metadata only. `VIDEO` generates plausible-but-mutually-inconsistent scene hallucinations across source kinds (city sidewalk / riverside path / industrial plant for the same fixture), confirming no genuine video processing.
- <kbd>CONTRACTS</kbd> Curated `grok-4.20-0309-reasoning` with the comprehension-grade Grok curator via Responses API and published an `IMAGE`/`DOCUMENT` x `INLINE`/`URL`/`ASSET` multimodal rectangle: both asset families pass all three source kinds. `TEXT` passes `INLINE` and `URL` but fails `ASSET` (same metadata-suppression pattern as `grok-4.3`) and cannot be included without overstating the rectangle. `AUDIO` echoes filename metadata across all source kinds. `VIDEO` consistently echoes filename metadata across all source kinds with no actual video processing.
- <kbd>CONTRACTS</kbd> Re-curated Gemini `gemini-2.5-flash` with the canonical comprehension-grade multimodal harness and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated Gemini `gemini-3.5-flash` one model at a time with the canonical comprehension-grade multimodal harness and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated Gemini rolling alias `gemini-flash-latest` with the canonical comprehension-grade multimodal harness and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Published conservative partial Gemini multimodal rectangles for `gemini-3.1-flash-lite`, `gemini-3.1-flash-lite-preview`, and `gemini-flash-lite-latest` based on one-model-at-a-time comprehension runs instead of treating those mixed matrices as all-or-nothing support.
- <kbd>CONTRACTS</kbd> Published a conservative partial Gemini multimodal rectangle for `gemini-2.5-flash-lite`: `TEXT`/`IMAGE`/`VIDEO`/`DOCUMENT` pass across `INLINE`, `URL`, and `ASSET`, while `AUDIO` remains outside the current comprehension-grade support rectangle.
- <kbd>CONTRACTS</kbd> Corrected Gemini pro-family multimodal curation to stop forcing thinking off in structured entry probes: `gemini-3.1-pro-preview-customtools`, `gemini-3.1-pro-preview`, and rolling alias `gemini-pro-latest` no longer reproduce the old `TEXT/INLINE` `PARSE_FAIL`, while the earlier `gemini-3-flash-preview` upstream fetch failure also proved transient on rerun.
- <kbd>CONTRACTS</kbd> Published a conservative partial Gemini multimodal rectangle for rolling alias `gemini-pro-latest`: `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` now pass across `INLINE`, `URL`, and `ASSET`, while `IMAGE` remains outside the current comprehension-grade support rectangle.
- <kbd>CONTRACTS</kbd> Published a conservative partial Gemini multimodal rectangle for `gemini-3.1-pro-preview-customtools`: `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` pass across `INLINE`, `URL`, and `ASSET`, while `IMAGE` remains outside the current comprehension-grade support rectangle.
- <kbd>RUNTIME</kbd> Gemini text `inputParts` now lead the first user prompt turn instead of trailing the instruction text, fixing structured `PARSE_FAIL` cases where some pro-family models conflated remote text payloads with the user instruction.
- <kbd>CONTRACTS</kbd> Re-curated Gemini `gemini-3.1-pro-preview` after the dedicated-turn text fix and expanded its conservative partial multimodal rectangle to `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` across `INLINE`, `URL`, and `ASSET`; `IMAGE` remains outside the current comprehension-grade support rectangle.
- <kbd>CONTRACTS</kbd> Published a conservative partial Gemini multimodal rectangle for `gemini-3-flash-preview`: `TEXT`/`AUDIO`/`DOCUMENT` pass across `INLINE`, `URL`, and `ASSET`, while `IMAGE` fails the canonical image cue and `VIDEO` only clears the current comprehension threshold on `URL`.
- <kbd>CONTRACTS</kbd> Re-curated Gemini `gemini-2.5-pro` after hardening the text-only multimodal curation user turn: `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` now pass across `INLINE`, `URL`, and `ASSET`, while `IMAGE` remains outside the current comprehension-grade support rectangle.
- <kbd>CONTRACTS</kbd> Re-checked Gemini `gemini-3-pro-preview`, confirmed it still fails the multimodal `TEXT/INLINE` entry probe with upstream `MODEL_NOT_FOUND` (404), and marked it `LEGACY` for Gemini E2E curation so future runs stop burning probes on this account-gated ID.
- <kbd>CONTRACTS</kbd> Reframed Gemini multimodal status as conservative `IN_PROGRESS`: earlier `SUPPORTED` / `15/15` claims are treated as provisional until the model is re-curated with comprehension-grade evidence under the normalized transport contract.
- <kbd>RUNTIME</kbd> OpenAI Responses now hydrates managed asset-backed `inputParts` before provider execution and maps `TEXT` URL/asset inputs to provider-native `input_text` content, reducing mixed results that previously depended on metadata-only runtime context.
- <kbd>RUNTIME</kbd> OpenAI Responses now materializes signed Google Cloud Storage `image/document` input-part URLs inline before provider submission, while leaving ordinary public URLs remote, to avoid provider-side fetch failures on managed multimodal fixture URLs without forcing all URL inputs through local download.
- <kbd>CONTRACTS</kbd> Adjusted OpenAI mixed-matrix `runtimeSupport.inputParts` curation to publish conservative partial `SUPPORTED` rectangles through `supportedAssetTypes`/`supportedSourceKinds` instead of flattening those entries to all-or-nothing `FAILING` when only part of the matrix is verified.
- <kbd>CONTRACTS</kbd> Refreshed OpenAI multimodal `inputParts` evidence after targeted implementation investigations: `gpt-4o-2024-08-06` now completes a clean `15/15` matrix once managed-asset cache-key collisions are isolated, while `gpt-5.1-codex-max` and `o3` now publish tighter conservative rectangles based on reruns after the Responses JSON parsing hardening.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o1-pro-2025-03-19` `runtimeSupport.inputParts` in a clean non-debug rerun and confirmed a full `15/15` multimodal matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>RUNTIME</kbd> Added Anthropic multimodal `inputParts` provider handling for hydrated `TEXT`/`IMAGE`/`DOCUMENT` inputs plus matching Anthropic smoke/curation E2E harnesses, while keeping `AUDIO`/`VIDEO` explicitly outside the currently supported Anthropic input-part surface.
- <kbd>CONTRACTS</kbd> Re-curated Anthropic multimodal `runtimeSupport.inputParts` with the comprehension-grade curator and published conservative per-model support rectangles instead of one shared Claude claim: `claude-opus-4-8`, `claude-opus-4-6`, `claude-opus-4-5-20251101`, `claude-opus-4-1-20250805`, `claude-haiku-4-5`, and `claude-haiku-4-5-20251001` support `TEXT`/`IMAGE`/`DOCUMENT` across `INLINE`, `URL`, and `ASSET`.
- <kbd>CONTRACTS</kbd> Published narrower Anthropic multimodal rectangles where the current comprehension contract stayed mixed: `claude-opus-4-7` and `claude-sonnet-4-6` now publish only `IMAGE`/`DOCUMENT` across `INLINE`, `URL`, and `ASSET`, while `claude-sonnet-4-5-20250929` currently publishes only `DOCUMENT`; `AUDIO`/`VIDEO` remain outside every Anthropic Messages support rectangle because the runtime path rejects them deterministically with `MODEL_UNSUPPORTED`.
- <kbd>CONTRACTS</kbd> Refreshed the public supported-models generator/docs so provider sections now expose a concise `inputParts` summary per model from the latest curated OpenAI and Anthropic catalog metadata.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-mini` `runtimeSupport.inputParts` after asset hydration plus the Responses signed-URL workaround and kept it `SUPPORTED` for text/image/audio/video/document inputs across `INLINE`, `URL`, and `ASSET` sources after a clean `15/15` multimodal matrix.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-nano` `runtimeSupport.inputParts` after asset hydration plus the Responses signed-URL workaround and curator fixes: document `INLINE/URL/ASSET` and image `ASSET` now pass, but the model still remains `FAILING` overall due to mixed failures in `text URL/ASSET`, `audio URL/ASSET`, and `video ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5` `runtimeSupport.inputParts` with the corrected multimodal curator and downgraded that surface to mixed support: document `INLINE/URL/ASSET` now passes consistently, but all text sources and several image/audio/video combinations still fail on the Responses path.
- <kbd>CONTRACTS</kbd> Re-ran OpenAI `gpt-5` one-model multimodal curation on 2026-06-27 with the `URL` slice completed under signed-URL fallback parity: the entry remains conservatively published as `DOCUMENT` across `INLINE`/`URL`/`ASSET`, while the updated evidence now shows `IMAGE` passing on `INLINE`/`URL`, `VIDEO` passing on `INLINE`, and `TEXT`/`AUDIO` still failing across all three source kinds with `PROVIDER_EMPTY_RESPONSE`.
- <kbd>CONTRACTS</kbd> Hardened the OpenAI curator for the `gpt-5` family after investigating empty multimodal responses under the smaller structured probe: `gpt-5` now clears `AUDIO` as well as `DOCUMENT` across `INLINE`/`URL`/`ASSET`, while `TEXT INLINE`, `IMAGE URL`, and all `VIDEO` source kinds still remain outside the published support rectangle.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-2025-08-07` with the new `1024`-token multimodal baseline and expanded its published rectangle to `IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` across `INLINE`/`URL`/`ASSET`; only `TEXT URL` and `TEXT ASSET` still fail on the Responses path.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-chat-latest` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Completed batch comprehension-grade curation across all remaining OpenAI models with `inputParts.status = IN_PROGRESS` using the `1024`-token multimodal baseline: Responses-path models (`gpt-5.x` family, `o1`–`o4` reasoning series including `o1`, `o1-2024-12-17`, `o3`, `o3-2025-04-16`, `o3-pro`, `o3-pro-2025-06-10`, `o4-mini`, and `o1-pro` family) confirm a clean `15/15` matrix; Chat Completions-path models (`gpt-4.1`, `gpt-4o`, `gpt-4o-mini` families) publish `TEXT`/`IMAGE`/`DOCUMENT` × `INLINE`/`URL`/`ASSET` rectangles since audio and video fail with upstream 400 on that API surface; `o3-mini` and `o3-mini-2025-01-31` publish `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` since IMAGE consistently fails 400 on the Responses path; FAILING models (`gpt-4o-2024-05-13`, `gpt-4-turbo`, `gpt-4`, `gpt-3.5-turbo` families) remain `FAILING` — those pre-JSON-mode models cannot reliably return the structured comprehension response regardless of token budget.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-codex` with the `1024`-token multimodal baseline and expanded its published rectangle to `IMAGE`/`AUDIO`/`DOCUMENT` across `INLINE`/`URL`/`ASSET`; `TEXT INLINE` and `VIDEO URL/ASSET` remain outside the current comprehension-grade support rectangle.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-mini` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-mini-2025-08-07` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-nano` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-nano-2025-08-07` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-pro` with the `1024`-token multimodal baseline and expanded its published rectangle to `IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` across `INLINE`/`URL`/`ASSET`; `TEXT` still fails across all three source kinds on the Responses path.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-pro-2025-10-06` with the `1024`-token multimodal baseline and expanded its published rectangle to `IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` across `INLINE`/`URL`/`ASSET`; `TEXT` still fails across all three source kinds on the Responses path.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.1` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.1-2025-11-13` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.1-chat-latest` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.5` `runtimeSupport.inputParts` with the corrected multimodal curator and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources; the earlier failing note on that entry was stale copied metadata, not a real regression.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-2026-03-05` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated Anthropic `claude-opus-4-7`, `claude-sonnet-4-6`, and `claude-sonnet-4-5-20250929` multimodal rectangles with the `1024`-token baseline and confirmed the prior rectangles are accurate: `claude-opus-4-7` and `claude-sonnet-4-6` maintain `IMAGE`/`DOCUMENT` × `INLINE`/`URL`/`ASSET`; `claude-sonnet-4-5-20250929` maintains `DOCUMENT` × `INLINE`/`URL`/`ASSET`. `TEXT` returns 200 but does not confirm `sawProvidedInput=true` on any source kind (model behavior, not token budget). Rate-limit transients observed on a few cells are non-structural.
- <kbd>CONTRACTS</kbd> Re-curated Gemini `gemini-2.5-pro` with the `1024`-token baseline and expanded its published rectangle: `IMAGE` now clears the canonical comprehension cue on `INLINE` and `ASSET`, joining `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` in the support rectangle; `URL` fixtures were unavailable this run but were confirmed passing in the prior curation.
- <kbd>CONTRACTS</kbd> Re-curated Gemini pro-family rolling aliases `gemini-3.1-pro-preview` and `gemini-pro-latest` with the `1024`-token baseline: `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` rectangles are confirmed; occasional `PARSE_FAIL` on `TEXT` for one source kind per model was treated as transient (inconsistent intra-run pattern, contradicts prior June 18 confirmation); `IMAGE` still fails the canonical cue across all source kinds.
- <kbd>CONTRACTS</kbd> Re-curated Gemini flash models `gemini-3.1-flash-lite-preview`, `gemini-3.1-flash-lite`, `gemini-flash-lite-latest`, `gemini-3-flash-preview`, and `gemini-2.5-flash-lite` with the `1024`-token baseline: all published rectangles confirmed on `INLINE`/`ASSET` (URL fixtures unavailable this run); no previously excluded modality cleared the comprehension threshold; `URL` source-kind coverage carried forward from prior June 17–18 runs.
- <kbd>CONTRACTS</kbd> Re-curated Grok `grok-4.3` and `grok-4.20-0309-reasoning` with the `1024`-token baseline: both confirm `IMAGE`/`DOCUMENT` × `INLINE`/`URL`/`ASSET`; `TEXT` remains outside both rectangles (inconsistent `comprehensionEcho` pattern across source kinds); `AUDIO` and `VIDEO` fail canonical comprehension cues.
- <kbd>CONTRACTS</kbd> Re-curated Grok `grok-build-0.1` with the `1024`-token baseline and expanded its published rectangle: `IMAGE` now passes across `INLINE`/`URL`/`ASSET` (previously only `URL` and `ASSET` cleared), promoting the rectangle from `DOCUMENT` to `IMAGE`/`DOCUMENT` × `INLINE`/`URL`/`ASSET`; `TEXT` fails `comprehensionEcho` on all three source kinds and `AUDIO`/`VIDEO` fail canonical comprehension cues.
- <kbd>RUNTIME</kbd> Added Mistral multimodal `inputParts` provider handling: the Mistral adapter now accepts a content-array message shape (mirroring the OpenAI Chat Completions pattern) to inject `image_url` chunks alongside the standard prompt for `IMAGE` inputs, while `AUDIO`/`VIDEO`/`DOCUMENT` are silently skipped since the Mistral standard chat API does not support those modalities. Requires `NODE_OPTIONS=--experimental-vm-modules` due to `@mistralai/mistralai` v2.2.5 being ESM-only.
- <kbd>CONTRACTS</kbd> Curated Mistral multimodal `runtimeSupport.inputParts` with the comprehension-grade curator across all 10 catalog models and published conservative `IMAGE` × `INLINE`/`URL`/`ASSET` rectangles for the 7 vision-capable models: `mistral-large-latest`, `mistral-medium-latest`, `mistral-small-latest`, `ministral-14b-latest`, `ministral-8b-latest`, `ministral-3b-latest` (vision support on this edge model is not advertised but passes comprehension cues), and `mistral-vibe-cli-latest`. Text-only models `mistral-tiny-latest`, `codestral-latest`, and `mistral-code-latest` reject image input with upstream `400 PROVIDER_ERROR` and have no `inputParts` block.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-mini` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-mini-2026-03-17` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-nano` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-nano-2026-03-17` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-pro` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-pro-2026-03-05` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.3-chat-latest` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.3-codex` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-2025-12-11` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-chat-latest` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-codex` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-pro` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-pro-2025-12-11` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-mini` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-mini-2026-03-17` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-nano` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-nano-2026-03-17` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-pro` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-pro-2026-03-05` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.3-chat-latest` with the `1024`-token multimodal baseline and reconfirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET`.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.3-codex` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-2025-12-11` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.2-chat-latest` with the `1024`-token multimodal baseline and reconfirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET`.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-codex` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.1` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.1-2025-11-13` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.1-chat-latest` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.1-codex` with the `1024`-token multimodal baseline and promoted a conservative `SUPPORTED` rectangle for `IMAGE`/`AUDIO`/`DOCUMENT` across `INLINE`/`URL`/`ASSET`; the same rerun showed `TEXT` only passing via `ASSET`, `AUDIO URL` failing with empty output, and `VIDEO` failing across all three sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5` `runtimeSupport.inputParts` and kept that surface `FAILING`: all text/audio/video combinations still failed on the Responses path, `document INLINE/URL/ASSET` passed, `image ASSET` passed, `image INLINE` returned empty output, and `image URL` failed with `PARSE_FAIL`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-2025-08-07` `runtimeSupport.inputParts` and kept that surface `FAILING`: all text/audio/video combinations still failed on the Responses path, while `image INLINE/URL/ASSET` and `document INLINE/URL/ASSET` passed.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5-chat-latest` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-codex` `runtimeSupport.inputParts` and kept that surface `FAILING`: audio `INLINE` returned a malformed non-JSON response, audio `ASSET` failed with empty output, video `INLINE` failed with empty output, and video `URL/ASSET` returned malformed non-JSON responses while all text/image/document combinations plus audio `URL` passed.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5-mini-2025-08-07` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.5-pro` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.5-pro-2026-04-23` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-nano-2025-08-07` `runtimeSupport.inputParts` and kept that surface `FAILING`: all text combinations still failed, `image ASSET` failed with empty output, and `audio URL` failed with empty output, while `image INLINE/URL`, `audio INLINE/ASSET`, all video combinations, and all document combinations passed.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4.1` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4.1-2025-04-14` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4.1-mini-2025-04-14` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-pro` `runtimeSupport.inputParts` and kept that surface `FAILING`: all text/image/audio/video combinations failed with empty output on the Responses path, while `document INLINE/URL/ASSET` passed.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4.1-nano-2025-04-14` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-pro-2025-10-06` `runtimeSupport.inputParts` and kept that surface `FAILING`: all text/audio/video combinations failed with empty output, `image INLINE/URL` failed with empty output, `image ASSET` passed, and `document INLINE/URL/ASSET` passed.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4o` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-4o-2024-08-06` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: text/image/audio/video passed across `INLINE/URL/ASSET`, document `INLINE/URL` passed, and document `ASSET` failed with a provider-side missing-object error for the managed fixture path.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4o-2024-11-20` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4o-mini-2024-07-18` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-4o-2024-05-13` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/video/document combinations failed with `PARSE_FAIL` across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-4-turbo` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/video/document combinations failed with `PARSE_FAIL` across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-4-turbo-2024-04-09` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/video/document combinations failed with `PARSE_FAIL` across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-4` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all image/audio/video/document combinations plus text `INLINE/URL` failed with `PARSE_FAIL`, and text `ASSET` failed with a provider-side missing-object error for the managed fixture path.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-4-0613` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/document combinations plus video `INLINE/URL` failed with `PARSE_FAIL`, and video `ASSET` failed with a provider-side missing-object error for the managed fixture path.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-3.5-turbo` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/video/document combinations failed with `PARSE_FAIL` across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-3.5-turbo-0125` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/video/document combinations failed with `PARSE_FAIL` across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-3.5-turbo-1106` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio combinations plus video `INLINE/URL/ASSET` and document `INLINE/URL` failed with `PARSE_FAIL`, and document `ASSET` failed with a provider-side missing-object error for the managed fixture path.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-3.5-turbo-16k` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/video/document combinations failed with `PARSE_FAIL` across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `o4-mini` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `o4-mini-2025-04-16` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `o3-pro` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o3` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: text `URL` passed, text `INLINE` failed with `PARSE_FAIL`, text `ASSET` failed with empty responses output, and all image/audio/video/document combinations passed across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `o3-pro-2025-06-10` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o3-2025-04-16` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: text `INLINE` and audio `URL` failed with empty responses output, while text `URL`/`ASSET` and all image/video/document plus audio `INLINE`/`ASSET` combinations passed across the exercised sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o3-mini` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/audio/video/document combinations passed across `INLINE`, `URL`, and `ASSET` sources, while image `INLINE`/`URL`/`ASSET` each failed with upstream provider error `400`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o3-mini-2025-01-31` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/audio/video/document combinations passed across `INLINE`, `URL`, and `ASSET` sources, while image `INLINE`/`URL`/`ASSET` each failed with upstream provider error `400`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o1` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: text `INLINE`/`ASSET`, image `ASSET`, audio `ASSET`, and all document combinations passed, while text `URL`, image `INLINE`/`URL`, audio `INLINE`/`URL`, and all video `INLINE`/`URL`/`ASSET` combinations failed with empty responses output.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o1-2024-12-17` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text and all document combinations passed; image `INLINE` passed while image `URL`/`ASSET` failed with empty responses output; audio `INLINE`/`ASSET` failed with empty responses output and audio `URL` failed with `PARSE_FAIL`; video `URL`/`ASSET` passed while video `INLINE` failed with empty responses output.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o1-pro-2025-03-19` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: text `INLINE` failed with `PARSE_FAIL`, while text `URL`/`ASSET` and all image/audio/video/document combinations passed across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `o1-pro` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.1-codex-max` with the `1024`-token multimodal baseline and promoted a conservative `SUPPORTED` rectangle for `IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` across `INLINE`/`URL`/`ASSET`; the same rerun showed `TEXT` passing for `INLINE` and `ASSET` but still failing for `URL` with empty Responses output.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.1-codex-mini` `runtimeSupport.inputParts` directly on the exact versioned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5-mini` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Marked OpenAI `gpt-4.1-nano` `runtimeSupport.inputParts` as `SUPPORTED` for text/image/audio/video/document inputs across `INLINE`, `URL`, and `ASSET` sources after one-model multimodal E2E validation.
- <kbd>CONTRACTS</kbd> Marked OpenAI `gpt-4o-mini` `runtimeSupport.inputParts` as `SUPPORTED` for image/document inputs across `INLINE`, `URL`, and `ASSET` sources after real multimodal E2E validation.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.3.0` for the explicit managed-asset lifecycle surface and additive multimodal/storage contract groundwork, without treating this PR as the final multimodal multi-provider milestone.
- <kbd>RUNTIME</kbd> Managed asset uploads no longer require `intent`; tenant-global asset identity and canonical paths continue to ignore it by design, while uploads may still pass it as optional semantic context.
- <kbd>RUNTIME</kbd> Prompt interpolation now rejects asset variables in `vars`, and execution/dry-run preflight validates that multimodal `inputParts` bind only to declared `inputSchema` asset variables.
- <kbd>RUNTIME</kbd> Managed asset lifecycle is now exposed only through `/api/assets`; `/api/execution/assets` compatibility aliases are intentionally not retained so stale callers fail loudly.
- <kbd>RUNTIME</kbd> Successful execution reports now populate `trackedCallAccounting` with explicit baseline tracked-call metadata (`consumed/base/multiplier=1`) while unsupported multimodal requests continue to fail before any provider call or tracked-call consumption is recorded.
- <kbd>CONTRACTS</kbd> Re-curated Gemini CHAT runtime support after full E2E matrix runs with `@google/genai` `2.8.0`: promoted `gemini-2.5-pro` to a conservative multimodal rectangle covering `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` across `INLINE`, `URL`, and `ASSET`, while `gemini-3-pro-preview` remains `FAILING` due to upstream model-not-found (404) on this account/endpoint.
### Fixed
- <kbd>RUNTIME</kbd> Fixed OpenAI Responses inline `input_file` handling by sending MIME-qualified Base64 file payloads and by recovering structured JSON text from `output[]` when `output_text`/`output_parsed` are absent, which unblocks the real OpenAI document-extraction E2E path.

## [20260613.2] — 23:14UTC

<!--
sourceCommit: 4da67652fb5069ca63b2f9f6cab63ec355249bcf
queuedAtUtc: 
previousMirroredBuild: 20260607.2 (2026-06-07)
contractsSubmodule: 1ee42b5364fa..c8b48151182f
-->

### Added
- <kbd>CONTRACTS</kbd> Added optional top-level execution `workflow` metadata to `ExecuteIntentRequest`/`ExecutionReport`, keeping `context` open for caller business context and `CONDITION_ON_CONTEXT` features.
- <kbd>CONTRACTS</kbd> Added optional service-token `limits[]` metadata with `FIXED`, hourly, daily, and monthly execution-call windows plus optional multi-intent `scopes` matching.
- <kbd>RUNTIME</kbd> Added optional service-token execution-limit enforcement for customer bearer tokens using shared Redis/in-memory counters, returning `429` with `RATE_LIMIT` on exhaustion while leaving `/api/auth/check` non-consuming.
### Changed
- <kbd>RUNTIME</kbd> Updated the `dcdr` CLI execution commands to accept top-level workflow correlation flags (`--workflow-id`, `--run-id`, `--node-id`, `--step-id`, `--parent-execution-id`, `--idempotency-key`) plus `--workflow-json`, with explicit flags overriding JSON fields before forwarding the formal execution request shape.
- <kbd>RUNTIME</kbd> Hardened execution HTTP request validation so `workflow` is rejected with a stable 400/`VALIDATION_ERROR` when it is not a plain object, when typed workflow fields are not strings, or when unsupported workflow fields are supplied.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.1.2`.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.2.0`.
- <kbd>RUNTIME</kbd> Expanded streaming OpenAPI schemas to document typed SSE event envelopes (`meta`, `delta`, `final`, `error`) via reusable component refs instead of a single opaque string schema.
- <kbd>RUNTIME</kbd> Tightened OpenAPI execution schemas to reuse strongly typed component refs for workflow, messages, errors, status, report sections, and routing metadata instead of broad anonymous objects where the contract is already explicit.
### Fixed
- <kbd>RUNTIME</kbd> Unified tenant scope resolution across execution entrypoints and related middleware (`run`/`dry-run`/`eval`/`stream`, circuit-breaker endpoints, tenant middleware, and customer CID rate-limit keys) to remove drift between customer and internal path handling.

## [20260607.2] — 04:20UTC

<!--
sourceCommit: ac3e9a2a8baba7a0af298ccc751804458c16a759
queuedAtUtc: 
previousMirroredBuild: 20260607.1 (2026-06-07)
contractsSubmodule: 5f153edbf115..1ee42b5364fa
-->

### Fixed
- <kbd>CONTRACTS</kbd> `@dcdr/contracts` DCDR virtual model-id helpers now support GROK and MISTRAL prefixes (`grok/*`, `mistral/*`) and parse `xai/*` as GROK, restoring UI persistence for these provider cards.

## [20260607.1] — 03:36UTC

<!--
sourceCommit: df928d1ade9ab63c3b07b0e174410aa5dab5c5df
queuedAtUtc: 
previousMirroredBuild: 20260606.5 (2026-06-06)
contractsSubmodule: 9aaff9c55a6d..5f153edbf115
-->

### Added
- <kbd>RUNTIME</kbd> Added native Mistral CHAT provider execution via `@mistralai/mistralai` and enabled Grok CHAT via the OpenAI-compatible adapter path.
- <kbd>RUNTIME</kbd> Added Grok model sync tooling (`npm run grok-models:sync`) and Grok support in provider catalog diff tooling for official model curation workflows.
### Changed
- <kbd>RUNTIME</kbd> Completed a full dependency refresh wave across runtime and contracts toolchains, including runtime updates for `jest`, `ts-jest`, `mime`, `mime-types`, `@types/mime-types`, and `@types/node`, with non-E2E validation kept green.
- <kbd>CONTRACTS</kbd> Marked Anthropic `claude-opus-4-8` as `SUPPORTED` after provider E2E validation (text + structured) and documented model-specific sampling parameter constraints.
- <kbd>RUNTIME</kbd> Updated provider SDK dependency `@google/genai` to `^2.8.0` and validated Gemini provider adapter compatibility with focused provider tests.
- <kbd>CONTRACTS</kbd> Re-curated Gemini CHAT runtime support after full E2E matrix run with `@google/genai` `2.8.0`: kept `gemini-2.5-pro` as `FAILING` (requires thinking mode and structured path can return empty output) and marked `gemini-3-pro-preview` as `FAILING` due to upstream model-not-found (404) on this account/endpoint.
- <kbd>CONTRACTS</kbd> Selected new public candidate models/categories for Grok while keeping Mistral out of public DCDR categories for now.
- <kbd>CONTRACTS</kbd> Promoted Anthropic `claude-opus-4-8` as the public `BEST` candidate and backfilled pricing only when grounded by an existing priced model in the same family.
- <kbd>CONTRACTS</kbd> Normalized pricing sources to canonical public pricing pages (`docs.x.ai/developers/pricing`, `platform.claude.com/docs/en/about-claude/pricing`) and added Mistral pricing only where explicitly stated on `mistral.ai/pricing` (Mistral Large).
- <kbd>CONTRACTS</kbd> Refreshed Grok and Mistral model prices from official public API pricing pages (including xAI cached-input rate where published) without renaming backend provider identifiers.
- <kbd>CONTRACTS</kbd> Made Anthropic legacy/dated CHAT model prices explicit in raw catalog entries and corrected deprecated `claude-opus-4-1-20250805` to official Opus 4.1 pricing ($15 input / $75 output per MTok).
- <kbd>CONTRACTS</kbd> Added initial Grok CHAT model catalog entries (pricing + `runtimeSupport=IN_PROGRESS`) to start controlled E2E curation.
- <kbd>CONTRACTS</kbd> `SUPPORTED_MODELS.md` generation now includes Grok/Mistral provider sections and no longer relies on a stale 3-provider hardcoded list.
- <kbd>CONTRACTS</kbd> Curated Grok CHAT runtime support statuses from provider E2E: four models marked `SUPPORTED` and `grok-4.20-multi-agent-0309` marked `FAILING` with explicit upstream-400 reason.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.1.0` (intermediate minor for provider-surface expansion).
- <kbd>RUNTIME</kbd> Provider E2E matrices now treat GROK and MISTRAL as implemented adapters; canonical CHAT smoke set includes a Grok model and streaming suite supports Grok model overrides.
### Fixed
- <kbd>CONTRACTS</kbd> Updated contracts test toolchain dependencies (`jest-junit`, `typescript`, `jest`, `ts-jest`) and verified deterministic contracts CI stability (`npm --prefix src/contracts run test:ci`).
- <kbd>RUNTIME</kbd> Hardened customer-mode rate-limit key generation to be IPv6-safe using `express-rate-limit` v8 helpers, preventing `ERR_ERL_KEY_GEN_IPV6` validation errors and ensuring stable limiter behavior behind proxy/forwarded-IP setups.

## [20260606.5] — 23:46UTC

<!--
sourceCommit: 3cd78af9f1543faa8b71b6148ed99a448ef59de1
queuedAtUtc: 
previousMirroredBuild: 20260606.2 (2026-06-06)
contractsSubmodule: e2a7b0a539c1..9aaff9c55a6d
-->

### Fixed
- <kbd>RUNTIME</kbd> `POST /api/execution/dry-run/:intent` is now tenant-aware in customer mode (Bearer + `cid`) and resolves intents from the same tenant-scoped registry path used by `runIntent`; missing/inactive intents now surface as `404` (`NO_ACTIVE_MODEL`) instead of generic `500`.
- <kbd>RUNTIME</kbd> Consolidated duplicate onboarding asset tests into a single canonical test and fixed docker-compose registry path resolution with `${VAR:-fallback}` placeholder support for stable Linux/Ubuntu CI runs.

## [20260606.2] — 03:20UTC

<!--
sourceCommit: cb3d24cb7496a924282e41399c1bc256923a2c50
queuedAtUtc: 
previousMirroredBuild: 20260606.1 (2026-06-06)
contractsSubmodule: 77abd6dcd59b..e2a7b0a539c1
-->

(No user-facing changes since previous build.)

## [20260606.1] — 02:52UTC

<!--
sourceCommit: da0b152bbf02947224f3f8b0ea3039c2479ef5d6
queuedAtUtc: 
previousMirroredBuild: 20260606.3 (2026-06-06)
contractsSubmodule: 5f584ddf926c..77abd6dcd59b
-->

### Added
- <kbd>RUNTIME</kbd> Added 1-minute onboarding runtime-client examples with typed `ExecuteIntentRequest` scripts for nutrition, banking incident classification, support ticket classification, product format parsing, and supplier risk assessment.

## [20260606.3] — 01:45UTC

<!--
sourceCommit: 659514e9f79181dd6ab0aa49c4ccfbf8265464aa
queuedAtUtc: 
previousMirroredBuild: 20260605.1 (2026-06-05)
contractsSubmodule: 1b49cecf1c24..5f584ddf926c
-->

### Added
- <kbd>RUNTIME</kbd> Optional durable tenant-registry marker + marker lookaside (runtime-owned) to improve cross-node convergence when Pub/Sub messages are missed.
### Changed
- <kbd>CONTRACTS</kbd> Updated cache contract surface and exports for the Redis tenant-registry invalidation channel.
- <kbd>RUNTIME</kbd> Backend log sync now uses a no-drop strategy when in-memory queue reaches cap: overflow spills to a durable NDJSON disk spool (`LOGS_SPOOL_FILE_PATH`) and is retried on subsequent flush cycles.
- <kbd>RUNTIME</kbd> Tuned default log in-memory buffer cap back to `LOGS_MAX_BUFFER_SIZE=2000` now that durable disk spool overflow is enabled.
- <kbd>CONTRACTS</kbd> Updated `DcdrRuntimeClient.dryRun()` to accept `ExecuteIntentRequest` explicitly (no vars-only compatibility overload).
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.0.2`.
### Fixed
- <kbd>RUNTIME</kbd> Improved Jest test stability for Redis-related features by preventing timer/metrics open-handle leaks during test runs.

## [20260605.1] — 22:29UTC

<!--
sourceCommit: 2ab7eb7fc2aeddc6757aa449f178712b179d6e4c
queuedAtUtc: 
previousMirroredBuild: 20260604.2 (2026-06-04)
contractsSubmodule: 9914fd4a70c2..1b49cecf1c24
-->

### Added
- <kbd>RUNTIME</kbd> Optional Redis Pub/Sub tenant registry invalidation hints to reduce cross-node staleness in cluster deployments (cloud mode).
- <kbd>CONTRACTS</kbd> Exported `DCDR_TENANT_REGISTRY_INVALIDATION_CHANNEL` for cross-service Redis Pub/Sub coordination.
### Changed
- <kbd>RUNTIME</kbd> Reduced default tenant registry cache max age to 60s (from 5m) for customer-mode registry refresh.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.0.1`.

## [20260604.2] — 19:34UTC

<!--
sourceCommit: 9d63004e113bd025adf630e92e837805194e1a35
queuedAtUtc: 
previousMirroredBuild: 20260604.4 (2026-06-04)
contractsSubmodule: e978205a52c0..9914fd4a70c2
-->

(No user-facing changes since previous build.)

## [20260604.4] — 16:49UTC

<!--
sourceCommit: 5f8fa805a5d19f2ebf15b8f72947f8d30553f1c9
queuedAtUtc: 
previousMirroredBuild: 20260604.1 (2026-06-04)
contractsSubmodule: ef12b2e03847..e978205a52c0
-->

### Changed
- <kbd>RUNTIME</kbd> `POST /api/execution/eval/:intent` now uses the formal contracts request/response (`ExecuteIntentEvalRequest`/`ExecuteIntentEvalResponse`) and supports bounded parallel evaluation via `options.maxConcurrency`.
- <kbd>CONTRACTS</kbd> Clarified execution policy availability documentation (Cloud vs Cloud Pro) in `docs/EXECUTION_POLICY.md`.
- <kbd>CONTRACTS</kbd> Added formal eval execution contracts (`ExecuteIntentEvalRequest`/`ExecuteIntentEvalResponse`) and updated the TypeScript client `DcdrRuntimeClient.eval()` signature accordingly.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.0.0`.

## [20260604.1] — 09:20UTC

<!--
sourceCommit: a973fbd0bcc87c96a18f61bde08e814a7d779338
queuedAtUtc: 
previousMirroredBuild: 20260603.2 (2026-06-03)
contractsSubmodule: 9b2c651e38b6..ef12b2e03847
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.9`.
### Fixed
- <kbd>RUNTIME</kbd> `dcdr validate-registry` now validates conditioned-routing boolean condition trees (`AND`/`OR`/`NOT`) and fails with actionable configuration errors.

## [20260603.2] — 23:28UTC

<!--
sourceCommit: a572e64a4f3e3e1544d5a02051383d493bf83077
queuedAtUtc: 
previousMirroredBuild: 20260602.1 (2026-06-02)
contractsSubmodule: f2c873f0b756..9b2c651e38b6
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.8`.
- <kbd>CONTRACTS</kbd> Added conditioned execution policy types (`CONDITION_ON_CONTEXT`, `CONDITION_ON_INPUT`) and per-implementation routing conditions for explicit context/input-based eligibility.
- <kbd>RUNTIME</kbd> Added conditioned execution policy planning support (Cloud/Cloud Pro), failing explicitly with `NO_ELIGIBLE_IMPLEMENTATION` + `details.reason="condition_not_matched"` when no condition matches.
### Fixed
- <kbd>RUNTIME</kbd> Added integration test coverage for conditioned routing no-match (`NO_ELIGIBLE_IMPLEMENTATION` + `details.reason=condition_not_matched`) to prevent regressions.

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

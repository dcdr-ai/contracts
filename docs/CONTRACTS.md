# Contracts reference (Registry, Intent, Implementation)

This section focuses on the package-level contract types used to author registries and intent definitions.

## DCDR Registry (DcdrRegistry) reference

This is the canonical Registry object used by DCDR.

- Source type: [../src/control.contract.ts](../src/control.contract.ts#L8)

In Runtime (self-hosted), this object is typically serialized to a JSON file (often called `registry.json`) and passed to the runtime via `--registry`.

### Top-level fields

All fields below belong to `DcdrRegistry`:

- `sha256`
  - Purpose: fingerprint of the Registry payload for audit/reproducibility.
  - Behavior:
    - if omitted in Runtime (self-hosted) registries, the runtime computes it
    - if provided, the runtime may verify it
  - Notes: runtime computes the hash over a stable clone that excludes signature fields.

- `generatedAt`
  - Purpose: timestamp (ISO string) for when the Registry bundle was generated.
  - Common source: Cloud.

- `signature` (optional)
  - Purpose: cryptographic signature for the Registry bundle.
  - Used for: verifying registries issued by Cloud (Cloud Pro flows).

- `signatureKeyId` (optional)
  - Purpose: key identifier/version to support signature rotation.

- `intents`
  - Purpose: list of everything the runtime can execute.
  - Type: `IntentContract[]`.
  - Source type: [../src/intent.contract.ts](../src/intent.contract.ts#L98)

- `processors` (optional)
  - Purpose: registry-level governed processing processors that apply globally across intents.
  - Type: `ProcessingProcessor[]`.
  - Source type: [../src/processing.contract.ts](../src/processing.contract.ts#L93)
  - Notes:
    - intent-specific processors still live on `IntentContract.processors`
    - global-vs-intent merge/order semantics are runtime-defined

- `credentials` (optional)
  - Purpose: reusable auth material referenced by implementations.
  - Type: `CredentialsContract[]`.
  - Source type: [../src/credentials.contract.ts](../src/credentials.contract.ts#L8)
  - Referenced by: `ImplementationContract.credentialRef`.

### Related contract types (source links)

This section is intentionally link-heavy: the inline comments in code are the “always up to date” documentation.

Core Registry types:

- `DcdrRegistry`: [../src/control.contract.ts](../src/control.contract.ts#L8)
- `CredentialsContract`: [../src/credentials.contract.ts](../src/credentials.contract.ts#L8)
- `IntentContract` + `IntentType`: [../src/intent.contract.ts](../src/intent.contract.ts#L16) and [../src/intent.contract.ts](../src/intent.contract.ts#L98)

Prompting + schemas:

- `PromptTemplateInterpolationType`: [../src/prompts.contract.ts](../src/prompts.contract.ts#L7)
- `PromptVariableType`: [../src/prompts.contract.ts](../src/prompts.contract.ts#L23)
- `PromptVariable`: [../src/prompts.contract.ts](../src/prompts.contract.ts#L38)
- `PromptTemplate`: [../src/prompts.contract.ts](../src/prompts.contract.ts#L105)
- `PromptParameters`: [../src/policies.contract.ts](../src/policies.contract.ts#L109)

Routing + retries:

- `RetryPolicy`: [../src/policies.contract.ts](../src/policies.contract.ts#L12)
- `ExecutionPolicyType`: [../src/policies.contract.ts](../src/policies.contract.ts)
- `ExecutionPolicy`: [../src/policies.contract.ts](../src/policies.contract.ts)
- `ExplorationMode` / `ExplorationPolicy`: [../src/policies.contract.ts](../src/policies.contract.ts)

Provider execution:

- `ImplementationContract`: [../src/implementations.contract.ts](../src/implementations.contract.ts#L54)
- `HttpRequestParams`: [../src/http.contract.ts](../src/http.contract.ts#L13)
- `IntentProvider`: [../src/provider.contract.ts](../src/provider.contract.ts#L19)

### Provider model catalog (pricing + customer curation)

The contracts package includes a curated provider model catalog (pricing, metadata, and runtime support hints) via:

- `ProviderModelDefinition` + `ProviderModelRegistry`: [../src/provider.contract.ts](../src/provider.contract.ts)

Supported providers (runtime surface)

- Hosted providers with curated pricing + model IDs: OpenAI, Anthropic, Gemini.
- Local/internal provider IDs: OFFICE.
- OpenAI-compatible provider is supported at runtime as an execution provider, but the curated model catalog may be empty (model IDs are typically deployment-specific).

DCDR Managed layer (customer UI abstraction)

- The managed layer groups public customer models into stable DCDR categories (BEST/SMART/FAST/ECONOMY/PRIVATE).
- This is an abstraction above `provider + modelId`; it does not remove direct provider/model selection.
- Category names and badges must not encode pricing; pricing is always read from the model pricing metadata.

Customer-facing UI curation:

- `ProviderModelDefinition.publicForCustomers` (boolean)
  - Purpose: marks models that are eligible to be shown in **customer-facing UIs** (DCDR customer sessions).
  - Default: **false** (fail-closed). If a model does not explicitly opt in, it must not appear in customer UIs.
  - Notes: this flag does **not** change runtime execution behavior; it only affects listing/filtering.

Managed categories (simple UI mode):

- `DcdrPublicModelCategory` (enum)
  - Purpose: product-level grouping for customer UIs (BEST/SMART/FAST/ECONOMY/PRIVATE).
  - Notes: categories are product metadata; pricing still comes from `ProviderModelDefinition.pricing`.

For models where `publicForCustomers=true`, the catalog requires additional public metadata (used by simple/advanced UI modes):

- `publicName` — stable customer-facing family name that should not expose underlying provider/model IDs.
- `badge` — small variant label shown next to `publicName` (e.g. provider name or a short hint like "Fast").
- `primaryCategory` + `categories[]` — one primary group plus optional tags/badges.
- `qualityTier`, `speedTier`, `costTier` — numeric 1..5, where 5 is best.
- `recommendedUseCases[]` — non-empty list of suggested use cases.
- `isRecommended` — model is generally recommended to customers.
- `isGlobalDefault` — single global default when the user has not chosen any model/category.
- `isCategoryDefault` — default inside its `primaryCategory` when a category is selected.

Selection policy (guidance): keep the public set small and stable (target 3–5 models per provider max), chosen by “jobs-to-be-done”, not “everything available”:

1. 1 flagship (highest quality, stable)
2. 1 value (best quality/price)
3. 1 fast/cheap (latency/cost optimized)
4. Optional 1 specialized (e.g., long-context or reasoning) only when truly needed

Prefer models with stable availability (not preview-only), published pricing, predictable costs, and strong adoption/quality-per-euro. Avoid deprecated/legacy SKUs in the public set.

Runtime API shapes:

- `ExecuteIntentRequest`: [../src/execution.contract.ts](../src/execution.contract.ts#L10)
- `ExecutionWorkflowContext`: [../src/execution.contract.ts](../src/execution.contract.ts#L207)
- `ExecutionReport`: [../src/execution.contract.ts](../src/execution.contract.ts#L69)
  - includes optional `serviceTokenId` audit metadata for managed customer/service-token executions
- `ExecuteIntentResponse`: [../src/execution.contract.ts](../src/execution.contract.ts#L190)
- `Message`: [../src/messages.contract.ts](../src/messages.contract.ts#L13)
- `DcdrRuntimeClient`: [../src/runtime.client.ts](../src/runtime.client.ts#L110)

Intent-processing rule engine:

- `processing.contract` exports the shared intent-only rule engine surface used by runtime and frontend preview tooling.
- Core enums/interfaces include:
  - `ProcessingStage`
  - `ProcessingRuleKind`
  - `ProcessingRuleGroup`
  - `ProcessingRuleDefinition`
  - `ProcessingProcessor`
  - `ProcessingTrailEntry`
  - `ExecutionProcessingReport`
  - `IntentProcessingSemantics`
  - shared condition tree reuse from conditioned routing:
    - `ConditionOp`
    - `ConditionLogicOp`
    - `ImplementationCondition`
    - `LogicalImplementationCondition`
- Scope:
  - governed `INPUT` / `OUTPUT` processing around intent execution
  - not the OpenAI-compatible `/v1` gateway proxy
- Hashing semantics:
  - `problemHash` / `runHash` should reflect the processed input that actually reaches execution
  - `outputHash` should reflect the final post-processed output returned to the caller
- `ExecutionReport.processing` is a bounded metadata-first audit surface for that rule engine:
  - stage summaries
  - mutation/block/review flags
  - optional bounded trail entries
  - per-entry origin scope (`GLOBAL` vs `INTENT`)
  - no raw secrets or uncontrolled payload copies by default

Managed asset storage shapes:

- `DcdrAssetStorageDescriptor`: [../src/asset.contract.ts](../src/asset.contract.ts#L139)
- `ResolveAssetStorageCredentialsRequest`: [../src/storage.credentials.contract.ts](../src/storage.credentials.contract.ts#L84)
- `ResolveAssetStorageCredentialsResponse`: [../src/storage.credentials.contract.ts](../src/storage.credentials.contract.ts#L92)
- `AssetStorageCredentialsContract`: [../src/storage.credentials.contract.ts](../src/storage.credentials.contract.ts#L68)
- `TrackedCallRatingMatrix`: [../src/tracked-call-rating.contract.ts](../src/tracked-call-rating.contract.ts#L109)

Storage model:

- `DcdrAssetStorageDescriptor` is tenant-visible and must stay secret-free.
- Public asset upload/get/delete requests use `storageId` to select a logical tenant storage.
- `ExecutionAssetReference` can preserve `storageId` plus logical `storageOwner` (`SYSTEM` | `CUSTOMER`) so QC/backend flows can reload managed evidence without inferring the storage family from datasource ids.
- Concrete storage credentials are resolved only between backend and runtime through `storage.credentials.contract`.
- The shared credential contract is intentionally additive and can represent Google Cloud today plus future `S3`, `FTP`, and `NAS` backends without changing the public asset lifecycle routes.

Tracked-call rating model:

- `tracked-call-rating.contract` exports a versioned, declarative `TrackedCallRatingMatrix` so runtime, backend, and UI can share the same multimodal tracked-call policy.
- `DEFAULT_TRACKED_CALL_RATING_MATRIX_V1` is the current default policy snapshot used by runtime v1.
- `ExecutionReport.trackedCallAccounting` carries the final applied multiplier plus optional dominant-bucket and aggregate-guardrail metadata for auditability.

Provider/model governance limits:

- `provider-limits.contract` exports a tenant-level governance surface for managed/provider-aware policy configuration.
- `DcdrProviderLimitGate` represents one allow/deny + quota gate:
  - `enabled`
  - `maxCalls` + `maxCallsPeriod`
  - `maxBudget` + `maxBudgetPeriod`
- `DcdrProviderLimitEntry` extends that gate with optional per-model overrides via `models[modelId]`.
- `DcdrProviderLimitsConfig` groups those entries by `IntentProvider`.
- This contract is intentionally configuration-only: it does not prescribe where live counters are stored or decremented.

## IntentContract (deep dive)

If you understand intents, you understand the DCDR execution surface. An intent is a versionable, provider-agnostic unit that can be executed consistently.

In TypeScript, an intent is represented by `IntentContract` (see `@dcdr/contracts/intent.contract`).

This section explains the fields you can configure and why they exist.

### Intent identity & lifecycle

Key fields:

- `id` — stable identifier for the intent. In Cloud and Cloud Pro, this is usually a UUID. In Runtime (self-hosted) you can use simple IDs like `"hello_world"` as long as they are stable.
- `intent` — the public name you call over HTTP, e.g. `POST /api/execution/run/HELLO_WORLD`.
- `type` — intent category (CHAT, EMBEDDING, IMAGE_GENERATION, VIDEO_GENERATION, …). This is used for capability checks and for picking the right provider adapter.
- `active` — global on/off switch.
- `description`, `name`, `tags` — human-facing metadata for UIs, logs, and analytics.

### Governed processing rules

There are now two contract-level configuration hooks:

- `DcdrRegistry.processors` for global processors
- `IntentContract.processors` for intent-specific processors

Availability:

- Cloud / Cloud Pro: supported
- Runtime (self-hosted, `--registry`): rejected by capability gating today

Authoring model:

- configured processor instances live in the registry
- the static atomic rule catalog (`PROCESSING_RULE_SCHEMAS`) lives in `processing.contract`
- each atomic rule schema also carries `group` metadata so UI can group primitives without hardcoded frontend taxonomies
- processing rules may reuse the same `condition` tree contract already used by conditioned routing, which keeps rule-builder UI and preview logic largely shared
- configured `configuration` values are constrained by `ProcessingRuleConfigurationMap` and validated with shared pure helpers instead of backend-only ad hoc logic
- frontend/runtime should use that shared static catalog to render and validate atomic rule configuration consistently

`IntentContract.processors` is an optional ordered list of governed processing processors executed around normal intent execution.

- `INPUT` processors run before prompt rendering and before provider execution.
- `OUTPUT` processors run after provider execution and before the final caller-visible output/report is finalized.
- Each processor is a versioned ordered sequence of atomic rules from the shared catalog in `processing.contract`.
- This surface is for the intent pipeline only, not for the OpenAI-compatible `/v1` gateway proxy.

Current runtime posture:

- processor ordering is deterministic via `order` then `id`
- runtime records bounded trail/evidence into `ExecutionReport.processing`
- `problemHash` / `runHash` reflect processed input
- `outputHash` reflects final post-processed output

### Input/output schemas

Schemas are optional but strongly recommended if you want reliability.

- `inputSchema` — documents the inputs your intent expects.
- `outputSchema` — documents the outputs you want back.

In DCDR these schemas are expressed as a map of variables (`Record<string, PromptVariable>`). They are used for:

- UI form generation (Cloud)
- validation hints
- structured output enforcement (when combined with prompt params like `response_format`)

Example pattern:

- `inputSchema.name` as a required string
- `outputSchema.result` as a required string

### Prompts (templates)

The prompt lives in `defaultPrompt` (and optionally `canaryPrompt`).

Important fields:

- `variablesInterpolationType` — how `{{vars}}` are expanded.
  - Recommended: `MUSTACHE` → `{{name}}`
- `messages[]` — the chat prompt.
  - `system` sets behavior/constraints
  - `user` is the actual user input template
- `params` — runtime model parameters

Common `params` you will use:

- `temperature` (0..2)
- `top_p` (0..1)
- `top_k`
- `max_tokens`
- `enable_thinking` (best-effort hint; model/provider dependent)
- `response_format` (`text`, `json_object`, `json_schema`, …)
- `presence_penalty`, `frequency_penalty`
- `seed` (reproducibility)

Canary support:

- `canaryPrompt` and `canaryPromptWeight` allow controlled rollout between two prompts (Cloud and Cloud Pro dependent).

Hashes:

- `sha256` and `semanticHash` exist for audit/reproducibility. In Runtime (self-hosted) examples you can use placeholder values.

### Execution policy (routing)

`executionPolicy` defines how the runtime should plan candidates before retries/fallback happen.

Full reference (recommended): [EXECUTION_POLICY.md](EXECUTION_POLICY.md)

The simplest and most common policy is:

- `type: WEIGHTED` — use each implementation's `weight` for selection.

Optional exploration (Cloud/Cloud Pro)

- `executionPolicy.exploration` is an explicit opt-in mechanism to explore alternative candidates _after_ deterministic ordering.
- V1 rule: exploration is not supported with `type: WEIGHTED`.

Epsilon-greedy Top-K sampling

- `mode: EPSILON_GREEDY_TOP_K`
- `epsilon: 0..1` probability of exploring
- `topK: >= 1` number of top candidates to sample within

### Retry policy (retries & fallback)

`retryPolicy` defines what happens when providers fail.

Common knobs:

- `maxAttempts` — total attempts across all candidates
- `maxPerCandidate` — attempts per implementation before switching
- `attemptTimeoutMs`
- `allowFallback`
- `repairOnParseFail` — useful when you require strict JSON output
- `retryOn` — error classes that are retryable
- backoff/jitter (`retryBackoffMs`, `retryBackoffStrategy`, `retryJitterMs`, `retryBackoffCapMs`)

Recommended production pattern:

- Set `defaultPrompt.params.response_format = "json_schema"` (or `json_object` depending on your needs)
- Define an `outputSchema`
- Enable `retryPolicy.repairOnParseFail = true`
- Include `PARSE_FAIL` + `SCHEMA_FAIL` in `retryOn`

### Implementations (providers/models/endpoints)

Key fields:

- `provider` — e.g. `OPEN_AI`, `OFFICE`
- `model` — e.g. `gpt-4.1-mini`, `Qwen3-4B-Instruct-2507`
- `endpoint` — base URL. For OpenAI it should be `https://api.openai.com/v1`.
- `weight` — selection weight for `WEIGHTED` policy. Conventionally use 0..1 (e.g. 0.7 / 0.3), but any positive numbers work.
- `credentialRef` — reference a credential object by id (recommended; avoids duplicating secrets)
- `runtimeConfig.timeoutMs` — provider attempt timeout override

Advanced ops knobs (optional):

- `executionWindow` (days/hours masks)
- `cacheTTLSeconds`
- `trackingIOProbability`
- `costScore`, `latencyScore`, `qualityScore` (for policy-based routing)

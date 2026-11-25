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
  - shared condition tree (see `src/contracts/src/conditions.contract.ts`, 3.0.0):
    - `ConditionOperator` (3.x compat name: `ConditionOp`)
    - `ConditionLogicOp`
    - `ConditionLeaf` (3.x compat name: `ImplementationCondition`)
    - `ConditionGroup` (3.x compat name: `LogicalImplementationCondition`)
    - `CONDITION_OPERATOR_META`, `evaluateConditionTreeOnScope`, `validateConditionTree`
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

## Workflow contract (since 3.0.0)

`src/contracts/src/workflow.contract.ts` defines the declarative state machine that composes intents, HTTP calls, choices and transforms, its value-mapping DSL (`$ref` / `$fn` / `$template` shorthand parsed into `WorkflowValueNode` trees), a non-throwing validator (`validateWorkflowDefinition`) and the pure engine core shared by every host (`resolveWorkflowValue`, `evaluateLocalWorkflowState`, `resolveWorkflowTransition`, `computeWorkflowDefinitionSha256`). `CHOICE` cases reuse the shared condition tree. Full reference: [WORKFLOWS.md](WORKFLOWS.md). Workflows are not a registry section: the runtime executes intents only, and `WorkflowContract` is the published shape handed to the workflow runner and editors.

`src/contracts/src/workflow.runner.contract.ts` (runner protocol shapes and `DcdrWorkflowRunnerClient`) is an **internal** surface shared by the DCDR control plane and its workflow runner workers; customers do not call it and it is not documented here.

## Knowledge contract (3.20.0)

`src/contracts/src/knowledge.contract.ts` defines the wire shapes of the read-only tenant knowledge API (`/api/dcdr/knowledge/*` on the control plane): collections and documents (`DcdrKnowledgeCollectionSummary` / `Detail`, `DcdrKnowledgeDocumentSummary` / `Detail`, metadata only), search (`DcdrKnowledgeSearchRequest` → `DcdrKnowledgeSearchResponse` with `DcdrKnowledgePassage[]` and a retrieval report) and grounded answers (`DcdrKnowledgeAnswerRequest` → `DcdrKnowledgeAnswerResponse`, with the five `DcdrKnowledgeAnswerRefusal` values as results rather than errors, and the model call's `ExecutionReport`). Passage `locator` and `context` are open to extra optional fields. Errors are `{ code, message, details }` with `DcdrKnowledgeErrorCode`. The client is `DcdrKnowledgeClient` (`knowledge.client.ts`), composed into `DcdrClient`.

Access is two scopes together, published in `service-tokens.contract.ts`: an action (`knowledge:read`, `knowledge:run`; `knowledge:write` reserved) **and** a collection grant (`knowledge:collections:*`, or `knowledgeCollectionScope(key)` = `knowledge:collection:<key>`). `hasDcdrKnowledgeAccess(scopes, action, key)` and `grantedDcdrKnowledgeCollections(scopes)` implement the rule. The same search is the `knowledge.search` workflow capability (see [WORKFLOWS.md](WORKFLOWS.md#capability-catalogue-tool-states)). Full guide: [KNOWLEDGE.md](KNOWLEDGE.md).

## Telemetry contract (3.25.0)

`src/contracts/src/telemetry.contract.ts` defines how OpenTelemetry telemetry from external AI apps (LangChain, the OpenAI Agents SDK, the Vercel AI SDK, in-house code...) is represented once the runtime has received it on `POST /v1/traces` and `POST /v1/logs`. Each GenAI span becomes an `ExecutionLogEvent` with `executionMode: TELEMETRY` and a `TelemetryExecutionLogDetails` block: trace and span ids, the reporting service (`service.name`, environment, version), the normalized `TelemetryOperation` (chat, embeddings, tool call, agent, retrieval...), provider and models as reported, agent and tool identity, the end user, finish reasons, the `TelemetrySourceConvention` the span was mapped from (current OTel GenAI conventions and their older forms, OpenInference, OpenLLMetry, Langfuse, Vercel AI), and what happened to its content. Token usage, duration and status reuse the envelope's `usage`, `timing` and `status`.

Telemetry stores what the app reports and never infers: a value the mapping tables do not recognize stays empty (an unknown operation is `OTHER`), and the reported value is kept next to the normalized one.

Content (prompts, completions, tool arguments and results) is governed by the service's `TelemetryPayloadLevel`: `NONE` sends nothing, `METADATA` (the default) sends only a `TelemetryContentSummary` (counts, roles, tool names, keyed hashes), and `FULL` sends the content after the service's processors, bounded per field (`DCDR_TELEMETRY_CONTENT_MAX_CHARS`). `contentReceived` records whether the app sent content at all.

The end user id follows its own per-service setting, independent of the payload level (since 3.26.0): `DcdrTelemetryServiceSnapshotEntry.endUserIdMode` is `TelemetryEndUserIdMode.PSEUDONYMISED` (the default: a keyed pseudonym at every level, FULL included) or `AS_SENT` (as reported at every level, cut at 256 characters, only on the tenant's explicit choice). An entry without the field keeps the earlier rule (as reported under FULL, pseudonymised below). The pseudonym is `telemetryEndUserPseudonym(deps, key, value)` = `hex(HMAC-SHA256(tenant key, utf8(value)))` over the id exactly as reported (no trimming, no case folding, the full id), with the HMAC injected (`TelemetryHmacDeps`; Node's `crypto` fits as is) so the package never imports `crypto`; content summary hashes use the same function. `TelemetryEndUser.keyVersion` names the key version, so a rotation is told apart from a new user, and a lookup by id hashes it with every key version the tenant has had. `DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS` are reference inputs and results any other implementation must reproduce.

Sending telemetry needs the service-token scope `traces:write` (`DcdrServiceTokenScope.TRACES_WRITE`); `logs:write` does not grant it. The control-plane side (the per-tenant services snapshot, `DcdrTelemetryServicesSnapshot`, and the ingest batch, `DcdrTelemetryIngestRequest`) is an internal surface between the runtime and the DCDR control plane; `telemetrySpanIdempotencyKey`, `findDcdrTelemetryService` and `isDcdrTelemetryServiceAccepted` state the rules both sides apply. Gateway logs gain `traceId` / `parentSpanId` from the caller's W3C `traceparent`, used only to correlate a gateway call with the caller's spans inside one tenant.

## Captured content contract (3.27.0)

`src/contracts/src/captured-content.contract.ts` (subpath `@dcdr/contracts/captured-content.contract`) is the one shape for the prompts and answers of an AI call, whichever path captured them: an external app's telemetry span on a `FULL` service (`TelemetrySpanContent`, which extends `CapturedContent`) or an AI Gateway call on a `FULL` service token (`GatewayExecutionLogDetails.content`). `CapturedContent` carries three strings, `input`, `output` and `system`, after processors, plus `truncated` and `chat`.

The strings are the content as reported. Their encoding rules are contract: a telemetry string attribute stays as reported, a structured one becomes JSON text, several attributes feeding one field become one JSON object keyed by attribute, and content reported as log events becomes a JSON array of messages; gateway content is `JSON.stringify` of the surface's request member and response object. A field longer than `DCDR_CAPTURED_CONTENT_MAX_CHARS` (65536 UTF-16 code units, the same value as `DCDR_TELEMETRY_CONTENT_MAX_CHARS`) is cut to a plain prefix that never splits a surrogate pair; a cut field is not valid JSON and is always listed in `truncated`. Their inner shape is the SDK's or the wire's, so a consumer must not parse them by source convention: it reads messages from `chat` (`CapturedChatContent`: `messages` and `output`, each a `CapturedChatMessage` with a normalised `CapturedChatRole`, the text parts joined, `toolCalls`, `toolCallId` and the number of `omittedParts`). `chat` is present only when every source field parsed and none was cut.

On the gateway the content settings travel with the service token, mirroring a telemetry service: `payloadLevel`, `endUserIdMode`, `processors` and `applyGlobalProcessors` on `DcdrGatewayTokenCheckResponse` (and its `token` block; also on `DcdrServiceTokenSnapshotItem` for parity). The gateway log then carries `payloadLevel`, `contentReceived`, `contentSummary` (`METADATA` and `FULL`), `content` (`FULL`), `contentWithheld` (`CapturedContentWithheldReason`: global processors unavailable, or a processor withheld every field), `endUser` and `streamInterrupted`. A token check without `payloadLevel` leaves the gateway log as it was before 3.27.0. Processors act on the captured copy only, never on the traffic to the provider or the client. Hashes and end user pseudonyms use the tenant key from `DcdrServiceTokensSnapshotContract.contentSettings` (`DcdrServiceTokensContentSettings`), delivered on the per-tenant snapshot only, never on the token check; without a usable key nothing is hashed and no end user that should be pseudonymised is sent. A runtime that applies these settings announces `CapabilityKey.AI_GATEWAY_CONTENT_CAPTURE`.

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

Presentation hints (3.12.0):

- `group?: string` — the form section a field is drawn in. Fields without one render in a default first section; sections appear in the order their first field is declared.
- `order?: number` — position within the group. Fields without one keep their declared key order.
- Both are **presentation only**: they do not change what a caller must send, what is validated, or what a model receives (structured-output schemas ignore them, and the agent planner's tool catalog strips them). A form can be laid out in sections while the payload stays flat — no nested `object` needed just to group fields.
- Validation codes: `GROUP_STRING`, `GROUP_LEN` (blank, or longer than `PROMPT_VARIABLE_GROUP_MAX_LENGTH` = 128), `ORDER_NUMBER` (not a finite number). `canonicalizePromptVariableSchemaRecord` keeps both (trimming `group`); `stripPromptVariablePresentationHints` removes them at every depth.

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
- `allowFallback` — also lets an execution move on to the next implementation after errors that refuse one
  candidate rather than the request, even when they are not in `retryOn`: an unsupported or retired model
  (`MODEL_UNSUPPORTED`, `MODEL_NOT_FOUND`), a provider or service-token limit (`PROVIDER_LIMIT_EXCEEDED`,
  `SERVICE_TOKEN_LIMIT_EXCEEDED`) and, since 2026-11, an empty answer (`PROVIDER_EMPTY_RESPONSE`, typically a
  reasoning model that spent its whole output budget). Each failed attempt stays in the report with its usage.
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

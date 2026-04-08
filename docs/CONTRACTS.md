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
- `ExecutionPolicyType`: [../src/policies.contract.ts](../src/policies.contract.ts#L183)
- `ExecutionPolicy`: [../src/policies.contract.ts](../src/policies.contract.ts#L258)

Provider execution:

- `ImplementationContract`: [../src/implementations.contract.ts](../src/implementations.contract.ts#L54)
- `HttpRequestParams`: [../src/http.contract.ts](../src/http.contract.ts#L13)
- `IntentProvider`: [../src/provider.contract.ts](../src/provider.contract.ts#L19)

Runtime API shapes:

- `ExecuteIntentRequest`: [../src/execution.contract.ts](../src/execution.contract.ts#L10)
- `ExecutionReport`: [../src/execution.contract.ts](../src/execution.contract.ts#L69)
- `ExecuteIntentResponse`: [../src/execution.contract.ts](../src/execution.contract.ts#L190)
- `Message`: [../src/messages.contract.ts](../src/messages.contract.ts#L13)
- `DcdrRuntimeClient`: [../src/runtime.client.ts](../src/runtime.client.ts#L110)

## IntentContract (deep dive)

If you understand intents, you understand the DCDR execution surface. An intent is a versionable, provider-agnostic unit that can be executed consistently.

In TypeScript, an intent is represented by `IntentContract` (see `@dcdr/contracts/intent.contract`).

This section explains the fields you can configure and why they exist.

### Intent identity & lifecycle

Key fields:

- `id` — stable identifier for the intent. In Cloud and Cloud Pro, this is usually a UUID. In Runtime (self-hosted) you can use simple IDs like `"hello_world"` as long as they are stable.
- `intent` — the public name you call over HTTP, e.g. `POST /api/execution/run/HELLO_WORLD`.
- `type` — intent category (CHAT, EMBEDDING, IMAGE_GENERATION, …). This is used for capability checks and for picking the right provider adapter.
- `active` — global on/off switch.
- `description`, `name`, `tags` — human-facing metadata for UIs, logs, and analytics.

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

The simplest and most common policy is:

- `type: WEIGHTED` — use each implementation's `weight` for selection.

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
- `weight` — selection weight for `WEIGHTED` policy. Conventionally use 0..1 (e.g. 0.7 / 0.3).
- `credentialRef` — reference a credential object by id (recommended; avoids duplicating secrets)
- `runtimeConfig.timeoutMs` — provider attempt timeout override

Advanced ops knobs (optional):

- `executionWindow` (days/hours masks)
- `cacheTTLSeconds`
- `trackingIOProbability`
- `costScore`, `latencyScore`, `qualityScore` (for policy-based routing)

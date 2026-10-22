# TypeScript client (`DcdrRuntimeClient`)

This is the full reference for the TypeScript client. The README keeps only the quickstart.

## Core operations (methods)

`DcdrRuntimeClient` is a small, strongly-typed wrapper over the runtime HTTP API.

Quick map (method → HTTP surface):

| Method                                               | HTTP                                        | Auth                        | When to use                              |
| ---------------------------------------------------- | ------------------------------------------- | --------------------------- | ---------------------------------------- |
| `healthcheck()`                                      | `GET /api/system/healthcheck`               | none by default             | Load balancers / basic diagnostics       |
| `metrics()`                                          | `GET /api/system/metrics`                   | none by default             | Prometheus scraping                      |
| `version()`                                          | `GET /api/system/version`                   | none by default             | Build number, git sha, uptime            |
| `authCheck()`                                        | `GET /api/auth/check`                       | required                    | Verify a token without executing         |
| `executeIntent(intent, request)`                     | `POST /api/execution/run/:intent`           | required                    | Normal intent execution                  |
| `executeIntentStream(intent, request)`               | `POST /api/execution/stream/:intent`        | required                    | Streaming execution (SSE)                |
| `demo(intent, request)`                              | `POST /api/execution/demo/:intent`          | required (except demo mode) | Demo-specific intent execution           |
| `dryRun(intent, request)`                            | `POST /api/execution/dry-run/:intent`       | required                    | Debug prompt rendering & resolved config |
| `eval(intent, request)`                              | `POST /api/execution/eval/:intent`          | required                    | Cloud and Cloud Pro evaluation workflows |
| `uploadAsset(request)`                               | `POST /api/assets/upload`                   | required                    | Create or reuse a managed asset          |
| `getAsset(request)`                                  | `GET /api/assets`                           | required                    | Read a managed asset payload             |
| `deleteAsset(request)`                               | `DELETE /api/assets`                        | required                    | Delete a managed asset                   |
| `circuitBreakerStatus(provider, model?, tenantCid?)` | `GET /api/execution/circuit-breakers`       | required                    | Observe breaker state (tenant-scoped)    |
| `resetCircuitBreaker(provider, model?, tenantCid?)`  | `PUT /api/execution/circuit-breakers/reset` | internal only               | Reset breaker state (ops)                |

What “auth required” means:

- **Customer mode (Cloud and Cloud Pro)**: set `bearerToken` (sends `Authorization: Bearer <token>`)
  - The token is a `DcdrSessionToken` or a managed **service token**, both created in the DCDR Cloud UI.
  - A service token is limited by its scopes: `execute:*` (or individual intents) to execute, `assets:read` / `assets:write` / `assets:delete` for managed assets. The same token, with `workflows:*` or `knowledge:*` scopes, also reaches the control plane: `DcdrClient` uses one token for both (see [Workflows and knowledge](#workflows-and-knowledge-control-plane)).
- **Internal/dev mode (Runtime (self-hosted))**: set `apiToken` (sends `token: <token>`)
  - Note: `/api/execution/*` endpoints require a session. For dev/testing you can set `sessionBypassToken` (sends `x-session-bypass`) when the runtime is configured with `SESSION_BYPASS_TOKEN`.

## Workflows and knowledge (control plane)

Workflows and knowledge are not served by the runtime but by the **control plane** (`https://dcdr.ai`),
with a managed **service token**. `DcdrClient` composes all three clients, so one object covers
intents, workflows and knowledge; each client is built on first use.

```ts
import { DcdrClient } from "@dcdr/contracts";

const dcdr = new DcdrClient({ bearerToken: process.env.DCDR_SERVICE_TOKEN });

await dcdr.executeIntent("CLASSIFY", { vars: { text } });                                // runtime
await dcdr.runWorkflowAndWait("SUPPORT_TRIAGE", { input });                              // control plane
const { passages } = await dcdr.searchKnowledge({ collections: ["product-sheets"], query }); // control plane
```

| Client | Methods | Scopes | Reference |
| --- | --- | --- | --- |
| `DcdrWorkflowClient` (`dcdr.workflows`) | `listWorkflows`, `getWorkflow`, `runWorkflow`, `runWorkflowAndWait`, `listWorkflowRuns`, `resumeWorkflowRun`, … | `workflows:read`, `workflows:run` | [WORKFLOW_CLIENT.md](WORKFLOW_CLIENT.md) |
| `DcdrKnowledgeClient` (`dcdr.knowledge`, 3.20.0) | see below | `knowledge:read`, `knowledge:run`, **plus** a collection grant | [KNOWLEDGE.md](KNOWLEDGE.md) |

Knowledge methods (read-only; collections and documents are managed in the DCDR web UI):

| Method | HTTP | Scope | When to use |
| --- | --- | --- | --- |
| `listKnowledgeCollections({ limit?, cursor? })` | `GET /api/dcdr/knowledge/collections` | `knowledge:read` | Collections this token is granted |
| `getKnowledgeCollection(idOrKey)` | `GET /api/dcdr/knowledge/collections/:idOrKey` | `knowledge:read` | Index status, document counts, search modes |
| `listKnowledgeDocuments(idOrKey, { status?, limit?, cursor? })` | `GET …/collections/:idOrKey/documents` | `knowledge:read` | Document metadata (never content) |
| `getKnowledgeDocument(idOrKey, documentId)` | `GET …/collections/:idOrKey/documents/:documentId` | `knowledge:read` | One document's metadata |
| `searchKnowledge(request, options?)` | `POST /api/dcdr/knowledge/search` | `knowledge:run` | Passages that match, nothing generated |
| `answerFromKnowledge(request, options?)` | `POST /api/dcdr/knowledge/answer` | `knowledge:run` | A grounded answer with citations, or a refusal |
| `answerFromKnowledgeStream(request, options?)` | `POST /api/dcdr/knowledge/answer/stream` (SSE) | `knowledge:run` | The same, streamed; `final` is authoritative |

Every knowledge scope needs a collection grant as well: `knowledge:collections:*` or
`knowledge:collection:<key>`. A refusal (`NO_PASSAGES`, `NOT_IN_CORPUS`, …) is a normal response, not
an error; failures throw `DcdrKnowledgeError`. The CLI equivalents are the `kn-*` commands
([CLI.md](CLI.md)).

## Errors

Every failure — HTTP, transport, timeout, misconfiguration — is a `DcdrRuntimeError` (since 3.15.0),
an `Error` subclass carrying **two** codes. `code` is why the call failed as far as the transport can
tell, and `executionCode` is the runtime's own [`ExecutionErrorCode`](EXECUTION_ERROR_CODES.md), read
out of the response body: that second one is what to show a person. Branch on the codes, never on the
message:

```ts
try {
  await client.executeIntent("SUPPORT_TICKET_CLASSIFY", { vars });
} catch (e) {
  if (!isDcdrRuntimeError(e)) throw e;

  switch (e.executionCode) {
    case ExecutionErrorCode.SERVICE_TOKEN_LIMIT_EXCEEDED:
      return tellTheUserTheQuotaIsSpent();        // e.retryAfterSeconds, when the runtime sent one
    case ExecutionErrorCode.MODEL_NOT_ALLOWED_FOR_TOKEN:
      return askAnAdminToWidenTheAllowlist();
    default:
      break;
  }

  if (e.code === DcdrRuntimeErrorCode.TIMEOUT || e.code === DcdrRuntimeErrorCode.NETWORK) return retryLater();
  throw e;
}
```

| `code` | Cause |
| --- | --- |
| `UNAUTHORIZED` | No token, an invalid one, or one without the scope this call needs. |
| `FORBIDDEN` | Authenticated, but not allowed to do this. |
| `NOT_FOUND` | No such intent, asset or route — or none this token may see. |
| `VALIDATION` | The request was refused as malformed; `details` carries what the runtime said. |
| `PAYMENT_REQUIRED` | The tenant's plan does not cover this call. |
| `RATE_LIMITED` | A provider, tenant or service-token limit refused it; retry later. |
| `SERVER_ERROR` | The runtime, or a provider behind it, failed. |
| `TIMEOUT` | The client's own timeout fired before a response arrived. |
| `CANCELLED` | Your `AbortSignal` fired. |
| `NETWORK` | The transport failed before a response arrived; the original is on `cause`. |
| `UNEXPECTED_RESPONSE` | A response the client could not read as the documented shape. |
| `CONFIGURATION` | The client is misconfigured (no base URL, no `fetch`, two auth modes at once). |

Also on the error: `status`, `method`, `path`, `details` (the parsed error body), `bodyPreview` and
`retryAfterSeconds`. `executionCode` is `null` when the body carried none the contracts know — a
proxy's HTML, a 404 from outside the runtime, or any client-side failure.

Use `isDcdrRuntimeError(e)` rather than `e instanceof DcdrRuntimeError`: it also recognises an error
thrown by a second copy of `@dcdr/contracts` in the same dependency tree, where `instanceof` fails
although the error is one in every way that matters.

**Upgrading from 3.14.0 or earlier.** The messages are unchanged character for character, so code
matching on them keeps working, as does `catch (e) { if (e instanceof Error) ... }`. Two differences
are worth knowing: `err.name` is now `"DcdrRuntimeError"`, and a timeout or a dead socket arrives as a
`DcdrRuntimeError` with the transport's own error on `cause`, where before the transport's error
(often an `AbortError`) propagated as it was.

Runtime error codes

See: [EXECUTION_ERROR_CODES.md](EXECUTION_ERROR_CODES.md)

### `healthcheck()`

- Returns a minimal `DcdrRuntimeHealthcheckResponse` so you can probe readiness/liveness.
- Does not require auth by default (runtime mounts `/api/system/*` without auth middleware).

### `metrics()`

- Returns raw Prometheus text (same output as `curl /api/system/metrics`).
- See: [PROMETHEUS_METRICS.md](PROMETHEUS_METRICS.md)

### `version()`

- Endpoint: `GET /api/system/version`
- Returns `DcdrRuntimeVersionResponse`: build number and date and git sha; Node version and uptime only in Runtime (self-hosted). The runtime may add fields; ignore the ones you do not know.

### `authCheck()`

- Endpoint: `GET /api/auth/check`
- Runs the same authentication as an execution call without executing an intent: the cheapest way to tell whether a token is accepted. Returns `DcdrRuntimeAuthCheckResponse` (`valid`, `authMode`, and the session for customer tokens).

### `executeIntent(intent, request)`

- The core call your application makes in production.
- Endpoint: `POST /api/execution/run/:intent`
- Input contract: `ExecuteIntentRequest`
- Output contract: `ExecuteIntentResponse` (includes `report` for deep diagnostics)

### `executeIntentStream(intent, request)`

- Endpoint: `POST /api/execution/stream/:intent`
- Transport: Server-Sent Events (SSE), `Content-Type: text/event-stream`
- Output: a stream of events (`meta`, optional `delta`, then `final`)
- Structured intents (since 3.19.0): `meta.structured` is `true` and each `delta` carries decoded field text with its `path`; every `delta` names its `attempt`

See: [STREAMING_EXECUTION_SSE.md](STREAMING_EXECUTION_SSE.md)

### `demo(intent, request)`

- Same shape as `executeIntent`, but targets the demo route: `POST /api/execution/demo/:intent`.
- Intended for curated demo intents (e.g. `DCDR_LOCAL_DEMO`).
- When the runtime is started in demo mode (for example `dcdr-runtime:latest --demo`), demo intents are intended to be callable without auth.

### `dryRun(intent, request)`

- Endpoint: `POST /api/execution/dry-run/:intent`
- Purpose: validate and render prompt inputs without executing a provider/model call.
- Input contract: `ExecuteIntentRequest`

### `eval(intent, request)`

- Endpoint: `POST /api/execution/eval/:intent`
- Cloud and Cloud Pro only: this endpoint is disabled in Runtime (self-hosted) and can return a `403`.
- Input contract: `ExecuteIntentEvalRequest`
- Output contract: `ExecuteIntentEvalResponse`

`ExecuteIntentEvalRequest` wraps a normal execution request:

- `request: ExecuteIntentRequest` — the same payload used by `/run/:intent` (including `request.context`)
- `targets?: Array<{ implementationId, runtimeOverride? }>` — optional explicit list of implementation ids; if omitted, runtime evaluates all active implementations
- `options?: { evalId?, mode?, includeOutput?, maxConcurrency? }`
  - `evalId` can be provided for correlation (returned as `evaluationId`)
  - `maxConcurrency` bounds parallel execution in BEST_EFFORT mode

### `uploadAsset(request)`

- Endpoint: `POST /api/assets/upload`
- Purpose: create or reuse a managed tenant asset and receive a stable `ExecutionAssetReference`.
- Input contract: `DcdrAssetUploadRequest`
- Output contract: `DcdrAssetUploadResponse`

Notes:

- Customer tokens need `assets:write` or `*`.
- This is intended for cloud-managed storage flows; runtime/freeware mode can reject managed asset lifecycle operations.
- `storageId` selects one tenant-visible managed storage exposed through entitlements. Callers do not send raw storage credentials in asset requests.
- Repeated uploads of the same canonical asset can return `created=false` when the object is reused from storage.
- `request.metadata` can carry semantic fields such as `title`, `description`, `alt`, `tags`, and string `attributes`.
- `intent` is optional for managed uploads; tenant-global cache identity no longer depends on it.
- The TypeScript client infers common `mimeType` and `partType` values from `name` when omitted.

Managed storage credential model:

- Public asset routes stay secret-free.
- `DcdrAssetStorageDescriptor` identifies the tenant-visible storage and carries routing metadata such as `id`, `datasource`, `container`, `region`, or `basePath`.
- `ExecutionAssetReference` returned by runtime asset routes can preserve `storageId` and logical `storageOwner` (`SYSTEM` | `CUSTOMER`) so QC/backend flows know which storage family to resolve later.
- Concrete storage secrets are resolved only between backend and runtime through the shared `storage.credentials.contract` interfaces.
- This keeps the public asset lifecycle stable while leaving room for Google Cloud today and future `S3`, `FTP`, and `NAS` storage backends.

Example:

```ts
import { DcdrRuntimeClient, prepareAssetInputPart } from "@dcdr/contracts";

const client = new DcdrRuntimeClient({
  bearerToken: process.env.DCDR_SESSION_TOKEN,
});

const upload = await client.uploadAsset({
  name: "handbook.pdf",
  dataBase64: handbookBuffer.toString("base64"),
  metadata: {
    title: "Employee handbook",
    description: "Primary onboarding PDF",
    tags: ["hr", "onboarding"],
    attributes: {
      language: "en",
    },
  },
});

const inputPart = prepareAssetInputPart({
  ...upload,
  variableName: "handbookPdf",
});

const request = {
  vars: { question: "Resume este documento" },
  inputParts: [inputPart],
};

// Multimodal inputParts run in Cloud and Cloud Pro; Runtime (self-hosted, --registry) refuses
// them with UNSUPPORTED_OPERATION. Which models accept which inputs (image, document) over
// INLINE / URL / ASSET is listed in SUPPORTED_MODELS.md.
// When the intent declares PromptVariableType.ASSET slots, bind each inputPart through
// inputParts[].variableName and keep the actual asset out of vars.
```

### `getAsset(request)`

- Endpoint: `GET /api/assets?assetPath=...&storageId=...`
- Purpose: fetch a previously stored managed asset payload as base64.
- Input contract: `DcdrAssetGetRequest`
- Output contract: `DcdrAssetGetResponse`

Notes:

- Customer tokens need `assets:read` or `*`.
- `storageId` is optional; when omitted, the runtime resolves the tenant default storage.
- `storageId` is a tenant-visible logical storage selector, not a raw datasource credential handle.

### `deleteAsset(request)`

- Endpoint: `DELETE /api/assets?assetPath=...&storageId=...`
- Purpose: delete a previously stored managed asset.
- Input contract: `DcdrAssetDeleteRequest`
- Output contract: `DcdrAssetDeleteResponse`

Notes:

- Customer tokens need `assets:delete` or `*`.
- Delete is explicit and no compatibility alias is maintained under `/api/execution/assets`.
- As with upload/get, callers address logical tenant storages through `storageId`; secret resolution remains backend/runtime-only.

### `circuitBreakerStatus(provider, model?, tenantCid?)`

- Endpoint: `GET /api/execution/circuit-breakers?provider=...&model=...`

### `resetCircuitBreaker(provider, model?, tenantCid?)`

- Endpoint: `PUT /api/execution/circuit-breakers/reset`

## Request/response shapes

The most common payload is `ExecuteIntentRequest`:

- `workflow?: { ... }` — optional top-level workflow/agent orchestration metadata (correlation, run/node/step ids, idempotency)
- `vars?: Record<string, unknown>` — template variables (e.g. `{ name: "Ada" }`)
- `inputParts?: ExecutionInputPart[]` — multimodal parts; when the intent declares asset prompt variables, each part should bind via `variableName`
- `context?: Record<string, any>` — open caller/business context (and the input surface used by `CONDITION_ON_CONTEXT` features)
- `routing?: { ... }` — optional routing hints (force provider/implementation, tune retries)

Important boundary for multimodal requests:

- assets do not belong inside `vars`
- `vars` remain prompt/template data only
- asset-backed parts travel through `inputParts`
- strong intent contracts should declare those slots in `inputSchema` with `PromptVariableType.ASSET`

### Workflow metadata

`ExecuteIntentRequest.workflow` is intended for **higher-level orchestration/programming layers** that use the runtime as one atomic step inside a larger system.

Typical examples:

- agent runners
- graph/state-machine orchestration
- multi-step workflow engines
- idempotent job/execution coordination

Recommended use:

- correlation ids across multi-step runs
- workflow/run/node/step identity
- parent-child execution linkage
- idempotency/replay safety keys

Important boundary:

- `workflow` is **not** a replacement for `context`
- `workflow` is orchestration metadata, not business/customer context
- `workflow` is a closed typed surface; unsupported keys should be treated as invalid request metadata
- `context` remains the open caller-controlled bag used for functional/business metadata and features such as `CONDITION_ON_CONTEXT`

The response is `ExecuteIntentResponse`:

- `status: "OK" | "ERROR"`
- `output?: any` — parsed result (when OK). Shape depends on the intent's output schema.
- `error?: ExecutionError` — error details (when ERROR)
- `report: ExecutionReport` — full attempt-by-attempt report (attempts, timings, retry/fallback choices)

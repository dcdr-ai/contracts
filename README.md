# @dcdr/contracts

> The official TypeScript client and public contracts for **DCDR**: governed AI operations for production apps.

[![version](https://img.shields.io/npm/v/@dcdr/contracts?label=version&color=blue)](https://www.npmjs.com/package/@dcdr/contracts)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![typescript](https://img.shields.io/badge/language-TypeScript-blue.svg)](https://www.typescriptlang.org/)

DCDR puts the AI your product uses behind one governed layer. Your code calls a named **intent**, starts a
**workflow** or asks a **knowledge** collection. DCDR renders the versioned prompt, picks the provider and model,
validates the output, retries or falls back, and records what ran and what it cost. Service tokens, scopes and limits
decide who may call what. You change prompts, models and limits in DCDR, and your application does not need a
redeploy. This package contains the client you call it with and the types of everything on the wire.

```ts
import { DcdrClient } from "@dcdr/contracts";

const dcdrClient = new DcdrClient({ bearerToken: process.env.DCDR_SERVICE_TOKEN });

await dcdrClient.executeIntent("SUPPORT_TICKET_CLASSIFY", { vars: { subject, body } });   // one governed AI call
await dcdrClient.runWorkflowAndWait("SUPPORT_TRIAGE", { input: { ticketId } });          // a multi-step process
await dcdrClient.answerFromKnowledge({ collections: ["product-sheets"], question });     // an answer with citations
```

Learn more at <https://dcdr.ai>.

## What DCDR gives you

- **Intents.** An intent is a named AI capability with a typed input and output contract. Its prompts are
  versioned, and it can route and fall back across providers and models. Structured output is validated and
  repaired, responses can be cached, and every call returns a report with its attempts, tokens and cost.
- **Streaming.** You can stream the same intent over SSE. A structured intent streams the decoded text of each
  field together with the field's path.
- **Workflows.** A workflow is a versioned graph of intents, HTTP calls, tools (`web.search`, `web.fetch`,
  `knowledge.search`, `mail.send`, `db.query`, …), choices, human tasks and bounded agents. It can be started
  manually, over HTTP or on a CRON schedule. Each run records its steps, evidence and cost.
- **Knowledge.** You keep document collections in the DCDR web UI. Your code searches them for passages, or asks
  for an answer that cites those passages and refuses when they do not cover the question.
- **AI Gateway.** An OpenAI- and Anthropic-compatible `/v1` endpoint. If you point Claude Code, Codex, Cursor or an
  SDK at it, that traffic uses the same credentials, limits and logs.
- **Governance.** Service tokens carry scopes, limit rules (calls or budget per hour, day, week or month), model
  allowlists and organization-wide provider limits. Execution logs record usage and cost.
- **Self-hosted runtime.** The execution engine is a Docker image. It runs on its own from a `registry.json`, or
  connected to DCDR Cloud.

Intents and streaming run everywhere. Workflows, knowledge, the gateway and the control plane need DCDR Cloud or
Cloud Pro: see [the tier matrix](docs/TIERS_FEATURE_MATRIX.md) and [the platform overview](docs/PLATFORM_OVERVIEW.md).

**Use DCDR** when AI calls are part of your product: you need stable interfaces, prompts kept outside your code,
fallback across vendors, structured output you can rely on, and an answer to "who called which model, and what did
it cost". **Skip it** for one-off scripts that make a single model call and need none of that. DCDR does not replace
the model providers. It governs how your product uses them.

## Install

```bash
npm i @dcdr/contracts
```

The package needs Node.js 18 or later for the global `fetch`. On older runtimes, pass `fetchFn`. It has one runtime
dependency (`class-validator`). Every module is also available as a subpath, for example
`@dcdr/contracts/knowledge.client`.

## Quick start

```ts
import { DcdrClient } from "@dcdr/contracts";

type SupportTicketClassifyVars = { subject: string; body: string; locale: "en" | "es" };

interface SupportTicketClassification {
  category: "BILLING" | "ACCESS" | "BUG" | "OTHER";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  summary: string;
}

const dcdrClient = new DcdrClient({ bearerToken: process.env.DCDR_SERVICE_TOKEN });

const vars: SupportTicketClassifyVars = { subject: "Can't log in", body: "The reset link expired twice.", locale: "en" };
const { output, report } = await dcdrClient.executeIntent("SUPPORT_TICKET_CLASSIFY", { vars });
const ticket = output as SupportTicketClassification;

console.log(ticket.priority, report.finalImplementation.model, report.cached);
```

- Declare `vars` with a `type`, not an `interface`. The request field is `Record<string, unknown>`, and TypeScript
  will not assign an interface to that type because an interface has no index signature.
- `DcdrClient` talks to two services. The **runtime** (`https://runtime.dcdr.ai`, override with `runtimeUrl`) runs
  intents and assets. The **control plane** (`https://dcdr.ai`, override with `controlUrl`) serves workflows and
  knowledge. One service token can reach both. The client builds each half on first use, so if you only run
  workflows you never need a runtime URL.
- The standalone clients are `dcdrClient.runtime` (`DcdrRuntimeClient`), `dcdrClient.workflows`
  (`DcdrWorkflowClient`) and `dcdrClient.knowledge` (`DcdrKnowledgeClient`). Their method names are the same as on
  `DcdrClient`.

To use your own runtime ([see below](#run-the-runtime-yourself)), configure the client like this:

```ts
const dcdrClient = new DcdrClient({
  runtimeUrl: "http://localhost:8000",
  runtime: { apiToken: "dev-token", sessionBypassToken: "dev-session-bypass" },
});
```

## Intents

`executeIntent(key, request)` is the call your application makes in production. The request has these fields:

- `vars`: the prompt variables, checked against the intent's `inputSchema`.
- `inputParts`: files and other multimodal input ([see Assets](#assets-and-multimodal-input)).
- `context`: open business context, such as channel or customer tier. Conditioned routing can read it.
- `workflow`: correlation ids when you call the intent as one step of your own orchestration.
- `routing`: per-call hints, such as preferring a provider or forcing an implementation.

The response holds `output`, which is validated against the intent's `outputSchema`, and `report`, which lists
attempts, the final provider and model, usage, latency and `cached`. If the execution fails, the call throws a
typed error ([see Errors](#errors)).

`dryRun(key, request)` renders the prompt and resolves the configuration without calling a provider. Use it to debug
`vars`.

More detail: [CLIENT.md](docs/CLIENT.md) is the full client reference. [CONTRACTS.md](docs/CONTRACTS.md) covers
intents, prompts and implementations. [EXECUTION_POLICY.md](docs/EXECUTION_POLICY.md) covers routing.

## Streaming

```ts
import { ExecutionStreamEventType } from "@dcdr/contracts";

for await (const event of dcdrClient.executeIntentStream("STAFF_ASSISTANT", { vars: { question, locale: "en" } })) {
  switch (event.type) {
    case ExecutionStreamEventType.DELTA:
      appendToScreen(event.data.text, event.data.path);   // for display only
      break;
    case ExecutionStreamEventType.FINAL:
      saveAnswer(event.data.response.output);             // the authoritative result
      break;
    case ExecutionStreamEventType.ERROR:
      showError(event.data.error.message);
      break;
  }
}
```

The stream sends `meta` first, then any number of `delta` events, then `final` or `error`. **Act on `final`**: it
carries the same `ExecuteIntentResponse` that `executeIntent` returns. A structured intent streams decoded text
for each string field, together with that field's `path`, such as `answer` or `citations[0].quote`. A structured
execution can retry after it has started streaming. When a delta arrives with a higher `attempt`, discard the text
you have shown so far. See [STREAMING_EXECUTION_SSE.md](docs/STREAMING_EXECUTION_SSE.md).

## Workflows

```ts
import { WorkflowWaitOutcome } from "@dcdr/contracts";

const result = await dcdrClient.runWorkflowAndWait("SUPPORT_TRIAGE", {
  input: { ticketId: "T-4821" },
  correlationId: "T-4821",
});

switch (result.outcome) {
  case WorkflowWaitOutcome.FINISHED:
    if (result.succeeded) closeTicket(result.output);
    else reportFailure(result.error);
    break;
  case WorkflowWaitOutcome.WAITING:      // paused on a human task or an approval
    notifyApprover(result.runId);
    break;
  case WorkflowWaitOutcome.TIMED_OUT:    // you stopped waiting; the run continues
    checkLater(result.runId);
    break;
}
```

To start a run without waiting, call `runWorkflow(key, { input }, { idempotencyKey })`. A retried webhook then
opens a single run. When a run pauses on a person, answer it like this:

```ts
const { items } = await dcdrClient.listWorkflowTasks({ groupKey: "finance" });

for (const task of items) {
  await dcdrClient.resumeWorkflowRun(task.runId, { frameId: task.frameId, payload: { approved: true, comment: "Checked." } });
}
```

- You author and publish workflows in the DCDR web UI. Code can run a workflow only after a person has published it
  and given it an active HTTP trigger.
- To validate a definition in CI, run `validateWorkflowDefinition` locally, then `validateWorkflow(definition)`
  against your tenant. Neither saves anything.
- To read what a run did, use `getWorkflowRun`, `listWorkflowRunSteps`, `listWorkflowRunEvidence` and
  `getWorkflowRunReport`.

More detail: [WORKFLOW_CLIENT.md](docs/WORKFLOW_CLIENT.md) explains how to drive workflows from code.
[WORKFLOWS.md](docs/WORKFLOWS.md) covers the definition format, states, tools and validation.

## Knowledge

```ts
const answer = await dcdrClient.answerFromKnowledge({
  collections: ["product-sheets"],
  question: "What is the shelf life once the bag is opened?",
});

if (answer.refusal) {
  showNoAnswer(answer.refusal);       // a result, not an error
} else {
  showAnswer(answer.text, answer.passages.filter((p) => answer.citedChunkIds.includes(p.chunkId)));
}
```

- `searchKnowledge({ collections, query, topK })` returns ranked passages that you can cite: text, document, page
  and score.
- `answerFromKnowledgeStream(request)` streams the answer. **`final` is authoritative.** A refusal can arrive after
  text has already streamed. In that case, clear the text you showed.
- A refusal is `NO_PASSAGES`, `NOT_IN_CORPUS`, `NO_CITATIONS`, `MODEL_FAILED` or `ANSWER_TOO_LONG`. It comes back
  as HTTP `200` with `text: ""`, never as an error.
- `listKnowledgeCollections`, `getKnowledgeCollection`, `listKnowledgeDocuments` and `getKnowledgeDocument` return
  metadata only. The API is read-only: you manage collections in the DCDR web UI.
- Workflows run the same search through the `knowledge.search` tool.

More detail: [KNOWLEDGE.md](docs/KNOWLEDGE.md).

## Assets and multimodal input

```ts
import { readFile } from "node:fs/promises";
import { prepareAssetInputPart } from "@dcdr/contracts";

const pdf = await readFile("invoice-0042.pdf");
const { asset } = await dcdrClient.uploadAsset({ name: "invoice-0042.pdf", dataBase64: pdf.toString("base64") });

const { output } = await dcdrClient.executeIntent("INVOICE_EXTRACT", {
  vars: { locale: "en" },
  inputParts: [prepareAssetInputPart({ asset, variableName: "invoice" })],
});
```

Files go in `inputParts`, never in `vars`. The intent declares the slot as an `asset` variable in its
`inputSchema`, and `variableName` binds the file to that slot. Managed asset storage is a DCDR Cloud feature, and
uploading needs the `assets:write` scope. A part can also carry `INLINE` data or a `URL`. To see which models have
been validated for image and document input, check [SUPPORTED_MODELS.md](docs/SUPPORTED_MODELS.md).

## AI Gateway

If a tool or SDK already speaks the OpenAI or Anthropic API, you only need to change its base URL and its API key.
The key is a DCDR service token with the `gateway` scope:

```bash
# OpenAI SDKs and OpenAI-compatible tools (Cursor, LangChain, n8n, ...)
OPENAI_BASE_URL=https://gateway.dcdr.ai/v1
OPENAI_API_KEY=<DCDR service token>

# Anthropic SDKs and Claude Code
ANTHROPIC_BASE_URL=https://gateway.dcdr.ai
ANTHROPIC_API_KEY=<DCDR service token>
```

The gateway serves `/v1/chat/completions`, `/v1/responses`, `/v1/embeddings`, `/v1/messages` and `/v1/models`. It
forwards each request with the provider credential your organization bound to the token, so the provider key never
leaves DCDR. It applies your limits and logs metadata only: prompts and responses are not stored. For Codex
setup, model prefixes, limits and error codes, see [GATEWAY.md](docs/GATEWAY.md).

## Service tokens and scopes

You create service tokens in the DCDR web UI. Each call needs the matching scope:

| Scope | Allows |
| --- | --- |
| `execute:*`, or an intent key | Execute any intent, or that intent only |
| `assets:read` / `assets:write` / `assets:delete` | Managed assets |
| `gateway` | The `/v1` AI Gateway |
| `workflows:read` | Workflow catalogue, runs, steps, evidence, reports and tasks |
| `workflows:run` | Run, cancel and resume workflows |
| `knowledge:read` | List and read collections and documents |
| `knowledge:run` | Search and answer. Each call spends: it embeds the query, and an answer also runs a model |
| `knowledge:write` | Reserved. No endpoint uses it yet |
| `knowledge:collections:*` | Grant: every knowledge collection, including ones created later |
| `knowledge:collection:<key>` | Grant: one knowledge collection |
| `*` | Everything |

A knowledge call needs an action scope **and** a collection grant: either one alone allows nothing. Scopes are
matched exactly, never by prefix. The same rules are published as functions:

```ts
import { DcdrServiceTokenScope, hasDcdrKnowledgeAccess, hasDcdrServiceTokenScope, knowledgeCollectionScope } from "@dcdr/contracts";

hasDcdrServiceTokenScope(token.scopes, DcdrServiceTokenScope.WORKFLOWS_RUN);   // exact match, or "*"
hasDcdrKnowledgeAccess(token.scopes, "run", "product-sheets");                // action scope AND collection grant
knowledgeCollectionScope("product-sheets");                                   // "knowledge:collection:product-sheets"
```

A token can also carry **limit rules** (`DcdrServiceTokenLimitRule`). Each rule caps calls or budget per hour, day,
week or month, and can be scoped to intents, providers or models. A token can also carry a **model allowlist**.
When a limit rule refuses a call, the call fails with `SERVICE_TOKEN_LIMIT_EXCEEDED` and a `Retry-After`.

## Errors

Each half of the client throws its own typed error. Every typed error carries a stable `code`, plus `status`,
`method`, `path` and `details`. Branch on the code, never on the message:

```ts
import { ExecutionErrorCode, isDcdrRuntimeError } from "@dcdr/contracts";

try {
  await dcdrClient.executeIntent("SUPPORT_TICKET_CLASSIFY", { vars });
} catch (e) {
  if (isDcdrRuntimeError(e) && e.executionCode === ExecutionErrorCode.SERVICE_TOKEN_LIMIT_EXCEEDED) {
    retryIn(e.retryAfterSeconds);
  } else {
    throw e;
  }
}
```

| Surface | Error / guard | What to read |
| --- | --- | --- |
| Intents, streaming, assets | `DcdrRuntimeError` / `isDcdrRuntimeError` | `code` is the transport cause, such as `TIMEOUT` or `RATE_LIMITED`. `executionCode` is the runtime's [`ExecutionErrorCode`](docs/EXECUTION_ERROR_CODES.md). `retryAfterSeconds` is set when the runtime sent one |
| Workflows | `DcdrWorkflowError` / `isDcdrWorkflowError` | `code`, such as `LIMIT_REACHED`, `INVALID_STATE` or `NOT_FOUND`. `limit` carries the counters |
| Knowledge | `DcdrKnowledgeError` / `isDcdrKnowledgeError` | `code`, such as `NOT_FOUND`, `INVALID_STATE` (index not ready) or `LIMIT_REACHED`. Refusals are not errors |

Use the `is…Error` guards instead of `instanceof`: the guards still work when two copies of the package are
installed. A stream that fails after it has started ends with an `error` event. A stream that fails before it
starts throws.

## Run the runtime yourself

**Try it in 30 seconds.** No API key or registry needed:

```bash
docker run --rm -p 8000:8000 dcdrai/runtime:latest --demo

curl -sS -H 'Content-Type: application/json' \
  -X POST http://localhost:8000/api/execution/demo/DCDR_LOCAL_DEMO -d '{"vars":{"name":"Ada"}}'
```

**Run it from a `registry.json`.** The registry holds your intents, prompts and implementations:

1. Copy [`examples/registry.hello_world.json`](examples/registry.hello_world.json) to `registry.json`, and replace
   `REPLACE_ME_OPENAI_API_KEY` with your OpenAI key. The example has one `HELLO_WORLD` intent with two OpenAI
   implementations under a `WEIGHTED` policy.
2. Start the runtime:

   ```bash
   docker run --rm -p 8000:8000 \
     -e API_TOKEN='dev-token' \
     -e SESSION_BYPASS_TOKEN='dev-session-bypass' \
     -v "$PWD/registry.json:/data/registry.json:ro" \
     dcdrai/runtime:latest --registry /data/registry.json
   ```

   In PowerShell, end lines with a backtick instead of `\`, and use `${PWD}`.
3. Call it with `curl`, or with the client configured for your own runtime ([see Quick start](#quick-start)):

   ```bash
   curl -sS -H 'Content-Type: application/json' -H 'token: dev-token' -H 'x-session-bypass: dev-session-bypass' \
     -X POST http://localhost:8000/api/execution/run/HELLO_WORLD -d '{"vars":{"name":"Ada"}}'
   ```

Swagger UI is at `http://localhost:8000/api/docs`, and the OpenAPI JSON at `http://localhost:8000/api/openapi.json`.
`/api/execution/*` requires auth and a session. The bypass token is for development only. For a Docker Compose setup
with more example registries, see [`examples/runtime-selfhosted/`](examples/runtime-selfhosted/README.md). For
HTTPS, networking, logs and metrics settings, see [RUNTIME_ADVANCED_CONFIG.md](docs/RUNTIME_ADVANCED_CONFIG.md).

## CLI

The `dcdr` CLI ships with the DCDR runtime source, not with this package. Its commands mirror the client:

```bash
npm run dcdr -- run HELLO_WORLD --base-url http://localhost:8000 --api-token dev-token --vars-json '{"name":"Ada"}'
npm run dcdr -- stream HELLO_WORLD --base-url http://localhost:8000 --api-token dev-token --vars-json '{"name":"Ada"}'
npm run dcdr -- wf-run SUPPORT_TRIAGE --control-url https://dcdr.ai --service-token $DCDR_SERVICE_TOKEN \
  --input-json '{"ticketId":"T-4821"}' --wait
```

The commands come in three families. Runtime commands are `health`, `run`, `stream`, `demo`, `dry-run`, `eval` and
`circuit-breaker`. Workflow commands start with `wf-`, and knowledge commands with `kn-`. See [CLI.md](docs/CLI.md).

## Documentation

### Using DCDR from code

- [CLIENT.md](docs/CLIENT.md): `DcdrRuntimeClient` reference, covering intents, streaming, dry run, eval, assets and errors.
- [STREAMING_EXECUTION_SSE.md](docs/STREAMING_EXECUTION_SSE.md): the SSE event format, structured streaming and retries mid-stream.
- [WORKFLOW_CLIENT.md](docs/WORKFLOW_CLIENT.md): running and following workflows, human tasks, evidence and the run lifecycle.
- [KNOWLEDGE.md](docs/KNOWLEDGE.md): collections, search, grounded answers, refusals, scopes and `knowledge.search`.
- [GATEWAY.md](docs/GATEWAY.md): the `/v1` AI Gateway, covering endpoints, models, streaming, limits, errors and tool setup.
- [EXECUTION_ERROR_CODES.md](docs/EXECUTION_ERROR_CODES.md): stable `ExecutionErrorCode` values and what they mean.
- [CLI.md](docs/CLI.md): the `dcdr` command line.
- [EXAMPLES.md](docs/EXAMPLES.md): example registries, a workflow definition and runnable client scripts.
- [OPENAPI_SDKS.md](docs/OPENAPI_SDKS.md): generating Python, C# or Java SDKs from the OpenAPI spec.

### Defining intents and workflows

- [CONTRACTS.md](docs/CONTRACTS.md): the registry, intents, prompts, implementations and the provider model catalog.
- [WORKFLOWS.md](docs/WORKFLOWS.md): the workflow definition, states, the value DSL, frames, agents and validation.
- [EXECUTION_POLICY.md](docs/EXECUTION_POLICY.md): routing policies (`WEIGHTED`, `FALLBACK_CHAIN`, `CHEAPEST_FIRST`, …) and conditioned routing.
- [PROCESSING_RULES.md](docs/PROCESSING_RULES.md): `INPUT` and `OUTPUT` processors (cleanup, PII governance, review routing).
- [SUPPORTED_MODELS.md](docs/SUPPORTED_MODELS.md): the provider models DCDR supports, with validated multimodal input.

### Operating DCDR

- [PLATFORM_OVERVIEW.md](docs/PLATFORM_OVERVIEW.md): self-hosted runtime, Cloud and Cloud Pro, and who runs what.
- [TIERS_FEATURE_MATRIX.md](docs/TIERS_FEATURE_MATRIX.md): features by tier.
- [RUNTIME_ADVANCED_CONFIG.md](docs/RUNTIME_ADVANCED_CONFIG.md): self-hosted environment variables.
- [PROMETHEUS_METRICS.md](docs/PROMETHEUS_METRICS.md): the metrics endpoint and what to monitor.
- [CHANGELOG.md](CHANGELOG.md): release notes.

## License

[Apache-2.0](LICENSE)

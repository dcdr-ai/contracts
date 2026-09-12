# Workflow client (`DcdrWorkflowClient`)

> Status: contracts 3.9.0. Workflows are a DCDR Cloud / Cloud Pro capability.

The typed client for the **tenant workflow API**: find out what you may run, run it, follow the run,
read what it did, and answer it when it stops to ask a person something.

If [`WORKFLOWS.md`](WORKFLOWS.md) is *what a workflow is*, this is *how your code drives one*.

---

## Start here

```ts
import { DcdrWorkflowClient } from "@dcdr/contracts";

const workflows = new DcdrWorkflowClient({
  baseUrl: "https://dcdr.ai",
  bearerToken: process.env.DCDR_SERVICE_TOKEN,
});

const result = await workflows.runWorkflowAndWait("SUPPORT_TRIAGE", {
  input: { ticketId: "T-4821" },
});

if (result.succeeded) console.log(result.output);
```

Runnable versions of everything below: [`examples/workflow-client/`](../examples/workflow-client/README.md).

---

## Which client, which URL, which token

Worth reading twice, because getting it wrong produces a `401` that looks like a credential problem
and is not.

| | `DcdrRuntimeClient` | `DcdrWorkflowClient` |
| --- | --- | --- |
| Endpoints | `/api/execution/*`, `/api/assets/*` | `/api/dcdr/workflows/*` |
| Served by | the **runtime** gateway (`runtime.dcdr.ai`, or your container) | the **control plane** (`dcdr.ai`) |
| Unit of work | one intent execution | a workflow: many states, seconds or days |
| Credential | `DcdrSessionToken` bearer, or a runtime API token | a managed **service token** |

A workflow run *does* execute intents on the runtime — the workflow runner calls it for every
`INTENT` state — but your code never makes that call. You talk to the control plane; it schedules,
governs and records.

[`DcdrClient`](#one-client-for-both) composes the two when a single token reaches both.

### Scopes

| Scope | Buys you |
| --- | --- |
| `workflows:read` | the catalogue, runs, steps, evidence, reports, tasks |
| `workflows:run` | running, cancelling, resuming |
| `*` | both |

They are separate because a monitoring integration that watches runs should not be able to start
them, and a webhook receiver that fires one workflow has no business reading every run of the tenant.

### What this API deliberately cannot do

**Author.** There is no create, publish or roll back. A workflow definition names intents,
connections, allowed hosts and allowed shell commands, so a token that could write one would reach
everything the tenant's connections reach. Running is bounded by what a person published. Authoring
stays in the DCDR web UI.

`validateWorkflow` *is* offered, because it persists nothing — see [Validating in CI](#validating-in-ci).

---

## Running a workflow

### Run and wait

```ts
const result = await workflows.runWorkflowAndWait("SUPPORT_TRIAGE", {
  input: { ticketId: "T-4821" },
  correlationId: "T-4821",
});
```

Under the hood: `POST /run/:key` (which answers `202` immediately) then polling
`GET /runs/:runId`. There is no synchronous run endpoint on purpose — a run can take a second or a
week, so **the caller decides how long it waits** and the run carries on either way.

Polling backs off geometrically, because a fixed interval is either too slow for the run that
finishes in two seconds or abusive for the one that parks overnight:

```ts
await workflows.runWorkflowAndWait("SUPPORT_TRIAGE", { input }, {
  initialDelayMs: 1_000,   // first gap
  backoffFactor: 1.6,      // growth per poll
  maxDelayMs: 15_000,      // ceiling
  timeoutMs: 900_000,      // give up waiting after 15 min (the run keeps going)
  stopWhenWaiting: true,   // default: return as soon as it parks on a person
  signal: controller.signal,
  onPoll: (run, polls) => console.log(polls, run.status, run.progress),
});
```

Those are the defaults. The wait never sleeps past its own deadline: the last poll lands on it.

### How a wait ends

`result.outcome` is one of three things, and they are not interchangeable:

| `outcome` | What happened | What to do |
| --- | --- | --- |
| `FINISHED` | The run reached a terminal status. | Read `succeeded`, then `output` or `error`. |
| `WAITING` | It parked on a `WAIT` — a human task, an approval gate, an external event. | Nobody is coming unless you tell them. See [Human tasks](#human-tasks-and-approvals). |
| `TIMED_OUT` | *You* stopped waiting. The run is still executing. | Keep `runId`; call `waitForWorkflowRun(runId)` later. |

```ts
switch (result.outcome) {
  case WorkflowWaitOutcome.FINISHED:
    if (result.succeeded) handle(result.output);
    else reportFailure(result.error);           // { code, message, stateId }
    break;
  case WorkflowWaitOutcome.WAITING:
    notifyApprover(result.runId, result.run.waits);
    break;
  case WorkflowWaitOutcome.TIMED_OUT:
    enqueueFollowUp(result.runId);
    break;
}
```

`succeeded` is `true` only for a `FINISHED` run whose status is `COMPLETED` or
`COMPLETED_WITH_ERRORS`. The second counts as success because the workflow **reached its end**,
having applied an error policy on the way; for the strict reading compare `result.status` against
`WorkflowRunStatus.COMPLETED` yourself.

`stopWhenWaiting` defaults to `true` deliberately. A run parked on an approval can sit for days, and
a process that keeps polling holds itself open for a decision nobody told it about. Set it to `false`
when the wait is a `DELAY` you expect to pass on its own.

### Fire and forget

```ts
const started = await workflows.runWorkflow("SUPPORT_TRIAGE", {
  input,
  correlationId: ticketId,
}, { idempotencyKey: ticketId });

console.log(started.runId, started.status, started.deduplicated);
```

**Send an idempotency key.** It is what makes a retry safe: a redelivered webhook opens one run, and
the second call comes back with the first one and `deduplicated: true`.

### Getting the result in one HTTP call

`waitForResultMs` asks the *server* to hold the response until the run finishes:

```ts
const fired = await workflows.runWorkflow("SUPPORT_TRIAGE", {
  input,
  waitForResultMs: 30_000,     // capped at DCDR_WORKFLOW_MAX_WAIT_FOR_RESULT_MS (2 min)
});

if (fired.completed) console.log(fired.run.output);
```

Past the hold you get `202` and a run id. Use this when your caller cannot come back later (a
webhook that wants an answer); use `runWorkflowAndWait` when it can.

### The workflow has to be runnable

A workflow is callable from outside only when the tenant gave it an **active HTTP trigger** — that is
how they opt one in. `listWorkflows()` reports it per row as `runnable`, so you can check before
trying rather than reading a `NOT_FOUND` and guessing.

---

## Finding out what you can run

```ts
const catalogue = await workflows.listWorkflows();
// [{ key, name, description, active, tags, version, sha256, publishedAt, runnable }]

const detail = await workflows.getWorkflow("SUPPORT_TRIAGE");
console.log(detail.inputSchema);   // what the run input must look like
console.log(detail.outputSchema);  // what the output will look like
```

The **definition is never served** — only its input and output schemas. The definition names the
tenant's intents, connections and allowed hosts, which describes their infrastructure rather than
this workflow's interface.

```ts
const versions = await workflows.listWorkflowVersions("SUPPORT_TRIAGE");
// [{ version, sha256, published, publishedAt, notes }] — metadata only
```

---

## Human tasks and approvals

A run parks (`WAITING`) on three kinds of wait, and `resumeWorkflowRun` continues it. The payload is
validated server-side against whatever it is parked on:

| Parked on | Payload | Checked against |
| --- | --- | --- |
| Approval gate | `{ approved: boolean, comment?: string }` | the fixed approval form |
| `WAIT` / `HUMAN_TASK` | whatever the state's `form` declares | that form |
| `WAIT` / `EXTERNAL_EVENT` | your event payload | must carry the awaited `eventKey` |

### One run can hold several tasks (3.10.0)

A run is no longer the unit a task belongs to. A `FOREACH` over three suppliers whose body asks a
person opens **three tasks on one run**, and answering one is not answering the others. So every
inbox row and every entry of `run.waits` carries a `frameId` — the scope it belongs to — and a
readable `path` (`root/each:2/fan:signoff`) for when two rows of the same run would otherwise look
identical.

```ts
const tasks = await workflows.listWorkflowTasks({ groupKey: "finance" });

for (const task of tasks.items) {
  await workflows.resumeWorkflowRun(task.runId, {
    frameId: task.frameId,                    // which of that run's tasks you are answering
    payload: task.approval
      ? { approved: true, comment: "Looks right." }
      : { refundAmount: 42.5, reason: "duplicate charge" },
  });
}
```

`frameId` is **optional**, and the bare payload form still works:

```ts
await workflows.resumeWorkflowRun(runId, { approved: true });
```

The server resolves the frame itself when exactly one is parked, which is every single-track
workflow — so nothing written before 3.10.0 has to change. A run holding several parked frames
answers `409` listing the candidates rather than guessing which you meant; take the id from
`listWorkflowTasks` or from `run.waits`.

`listWorkflowTasks` lists **only** scopes waiting on a person. A run sitting on a delay or an
external event is not somebody's task, and putting it in a queue is how a queue stops being read.
The same distinction is on each entry of `run.waits` as `human`.

A rejection is **not** an error: it fails the gated state, so that state's own `onError` policy
decides what the run does next.

### Cancelling

```ts
const run = await workflows.cancelWorkflowRun(runId);
```

Cooperative: the flag is raised and the runner stops at its next checkpoint, so the run you get back
is usually still `RUNNING`. Poll it if you need to know when it actually stopped.

---

## Reading what a run did

```ts
const run      = await workflows.getWorkflowRun(runId);
const steps    = await workflows.listWorkflowRunSteps(runId);
const evidence = await workflows.listWorkflowRunEvidence(runId);
const report   = await workflows.getWorkflowRunReport(runId);   // all of the above, summarized
```

**Evidence carries its own trustworthiness**, which is the point of recording it:

| `assurance` | Meaning |
| --- | --- |
| `ENFORCED` | The runner executed the action itself. The record cannot be wrong or missing. |
| `OBSERVED` | Seen at a network boundary. The action happened; the intent is unknown. |
| `REPORTED` | A model, SDK or provider said so. Recorded, not verified. |
| `NONE` | Black box. |

Step inputs and outputs are **not** served: they are bounded by the tenant's own payload-logging
policy and can hold anything a state touched. The run `output` is the contract the definition
declared, and that is what you read.

### Listing runs

```ts
const page = await workflows.listWorkflowRuns({
  workflow: "SUPPORT_TRIAGE",
  status: WorkflowRunStatus.FAILED,
  correlationId: "T-4821",
  since: "2026-09-01T00:00:00Z",
  limit: 50,
});

const next = await workflows.listWorkflowRuns({ cursor: page.nextCursor });
```

Keyset-paged, newest first. Runs are append-only and a tenant may have millions, so offset paging
over a table that grows while you read it skips and repeats rows; pass the `nextCursor` you were
given and nothing shifts under you. The cursor is opaque — do not build one.

---

## Validating in CI

`validateWorkflow` checks a definition against the tenant's intents, connections and caps and
**persists nothing**, which is what makes it safe on a read scope:

```ts
import { parseWorkflowDefinitionShorthand, validateWorkflowDefinition } from "@dcdr/contracts";

const definition = parseWorkflowDefinitionShorthand(JSON.parse(fileContents));

// Free and instant: structure, reachability, references, the value DSL. No network.
const local = validateWorkflowDefinition(definition);
if (!local.valid) return local.issues;

// Only this one can check what depends on the tenant.
const remote = await workflows.validateWorkflow(definition);
console.log(remote.valid, remote.issues, remote.registrySha256);
```

Run the local one first and the cheap failures stay cheap.

---

## Errors

Every failure — HTTP, transport, timeout, misconfiguration — is a `DcdrWorkflowError` with a stable
`code`. Branch on the code, never on the message:

```ts
try {
  await workflows.runWorkflowAndWait("SUPPORT_TRIAGE", { input });
} catch (e) {
  if (!isDcdrWorkflowError(e)) throw e;

  switch (e.code) {
    case DcdrWorkflowErrorCode.LIMIT_REACHED:
      return backOffUntilTomorrow(e.limit);   // { limitKey, current, max, tier? }
    case DcdrWorkflowErrorCode.VALIDATION:
      return showIssues(e.details);
    case DcdrWorkflowErrorCode.TIMEOUT:
    case DcdrWorkflowErrorCode.NETWORK:
      return retryLater();
    default:
      throw e;
  }
}
```

| Code | Cause |
| --- | --- |
| `NOT_FOUND` | No such workflow or run — or none this token may see. The two are indistinguishable by design. |
| `FORBIDDEN` | The operation is not allowed. |
| `VALIDATION` | Bad body or parameter; `details` carries the issues. |
| `CONFLICT` | A concurrent change lost the race. |
| `INVALID_STATE` | The run is not in a state this operation accepts. |
| `LIMIT_REACHED` | A tenant business limit; `limit` carries the counters. |
| `DISABLED` | Workflows are off for this tenant or deployment. |
| `UNAUTHORIZED` | No token, an invalid one, or one without the scope. |
| `RATE_LIMITED` | A rate limiter refused the call. |
| `SERVER_ERROR` | The server failed. |
| `TIMEOUT` | The request, or the wait, exceeded its timeout. |
| `CANCELLED` | Your `AbortSignal` fired. |
| `NETWORK` | The transport failed before a response arrived. |
| `UNEXPECTED_RESPONSE` | A 2xx the client could not read as the documented shape. |
| `CONFIGURATION` | The client is misconfigured (no URL, no token, no `fetch`). |

The first seven are the control plane's **own** codes, passed through rather than inferred. That
matters: `INVALID_STATE` and `LIMIT_REACHED` both arrive as HTTP `409`, and "this run already
finished" is not "you ran out of runs today".

Every error also carries `status`, `method`, `path`, `details` and a bounded `bodyPreview`, so one
log line has everything needed to reproduce the call.

**Authentication failures are always `401` with no detail**, whether the token is missing, invalid,
revoked or merely lacks the scope. Saying which would tell a caller whether a token exists.

---

## One client for both

```ts
import { DcdrClient } from "@dcdr/contracts";

const dcdr = new DcdrClient({ bearerToken: process.env.DCDR_TOKEN });

await dcdr.executeIntent("CLASSIFY", { vars: { text } });       // runtime
await dcdr.runWorkflowAndWait("SUPPORT_TRIAGE", { input });     // control plane

dcdr.runtime;    // the DcdrRuntimeClient, if you want it raw
dcdr.workflows;  // the DcdrWorkflowClient
```

Each half is built on first use, so an integration that only runs workflows never needs a runtime
URL. Method names are identical to the underlying clients with no aliases, so moving a call between
the wrapper and a bare client is a rename of the receiver and nothing else.

Per-half overrides when the two need different settings:

```ts
const dcdr = new DcdrClient({
  bearerToken: sharedToken,
  runtimeUrl: "http://localhost:8000",
  controlUrl: "https://dcdr.ai",
  runtime: { apiToken: "internal-token" },  // runtime in internal mode, control plane still bearer
});
```

---

## Method reference

| Method | HTTP | Scope |
| --- | --- | --- |
| `listWorkflows(options?)` | `GET /api/dcdr/workflows` | read |
| `getWorkflow(key)` | `GET /api/dcdr/workflows/:key` | read |
| `listWorkflowVersions(key, options?)` | `GET /:key/versions` | read |
| `validateWorkflow(definition)` | `POST /validate` | read |
| `runWorkflow(key, request?, options?)` | `POST /run/:key` | run |
| `runWorkflowAndWait(key, request?, options?)` | run + poll | run |
| `waitForWorkflowRun(runId, options?)` | poll only | read |
| `listWorkflowRuns(query?)` | `GET /runs` | read |
| `getWorkflowRun(runId)` | `GET /runs/:runId` | read |
| `cancelWorkflowRun(runId)` | `POST /runs/:runId/cancel` | run |
| `resumeWorkflowRun(runId, payload)` | `POST /runs/:runId/resume` | run |
| `listWorkflowRunSteps(runId)` | `GET /runs/:runId/steps` | read |
| `listWorkflowRunEvidence(runId)` | `GET /runs/:runId/evidence` | read |
| `getWorkflowRunReport(runId)` | `GET /runs/:runId/report` | read |
| `listWorkflowTasks(query?)` | `GET /tasks` | read |

`POST /trigger/:key` is the same endpoint as `POST /run/:key`, under the name the DCDR web UI uses
for a workflow's entry point. The client calls `run`.

Helpers: `buildDcdrWorkflowRoutes()`, `isDcdrWorkflowError()`, `isWorkflowRunTerminal()`,
`isWorkflowRunSuccessful()`.

---

## Run lifecycle

```
                 ┌──────────── resumeWorkflowRun ◄─── a person / an event
                 ▼                     │
QUEUED ──► RUNNING ──► WAITING ────────┘
   │          │
   │          ├──► COMPLETED               succeeded
   │          ├──► COMPLETED_WITH_ERRORS   succeeded (an onError policy applied on the way)
   │          ├──► FAILED
   │          └──► TIMEOUT                 the run deadline passed
   └─────────────► CANCELLED               cancelWorkflowRun, honoured at the next checkpoint
```

The bottom five are terminal (`WORKFLOW_RUN_TERMINAL_STATUSES`). `isWorkflowRunTerminal` and
`isWorkflowRunSuccessful` are the predicates, so nobody has to keep the list in their head.

---

## From the CLI

```bash
npm run dcdr -- wf-run SUPPORT_TRIAGE \
  --control-url https://dcdr.ai --service-token $DCDR_SERVICE_TOKEN \
  --input-file ./input.json --wait

npm run dcdr -- wf-report <runId> --control-url https://dcdr.ai --service-token $DCDR_SERVICE_TOKEN --json
```

Full command list: [CLI.md](CLI.md).

---

## See also

- [WORKFLOWS.md](WORKFLOWS.md) — the definition format, the value DSL and the validator.
- [CLIENT.md](CLIENT.md) — `DcdrRuntimeClient`, for executing intents directly.
- [`examples/workflow-client/`](../examples/workflow-client/README.md) — runnable scripts.
- [TIERS_FEATURE_MATRIX.md](TIERS_FEATURE_MATRIX.md) — which tier has workflows.

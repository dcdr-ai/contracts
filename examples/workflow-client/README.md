# Workflow client examples (TypeScript)

Runnable scripts that drive the DCDR **tenant workflow API** with the official client
(`DcdrWorkflowClient`): discover what you may run, run it and wait, answer human tasks, and validate
a definition in CI.

> These call the **control plane** (`https://dcdr.ai`), not a runtime gateway, and they authenticate
> with a **service token**, not a session token. Getting that pair wrong produces a `401` that looks
> like a bad credential and is not — see [Which URL, which token](#which-url-which-token).

## Prerequisites

- Node.js `22.x` (global `fetch`, which the client uses).
- A DCDR Cloud / Cloud Pro tenant with workflows enabled.
- A managed **service token** carrying `workflows:read` (and `workflows:run` for the two scripts that
  start or answer runs).

## Install

```powershell
npm install
```

## Which URL, which token

| | `DcdrRuntimeClient` | `DcdrWorkflowClient` |
| --- | --- | --- |
| Talks to | the runtime gateway (`runtime.dcdr.ai`, or your container) | the control plane (`dcdr.ai`) |
| Does | executes one intent | runs and follows workflows |
| Credential | `DcdrSessionToken` bearer, or a runtime API token | a managed service token |

They are separate clients because they are separate origins with separate credentials. A workflow run
*does* reach the runtime — the runner executes every `INTENT` state there — but your code never makes
that call. `DcdrClient` composes both when one token reaches both.

## Available examples

### `npm run start:catalogue`

What this token may run, and what each workflow takes. Prints `runnable` per row — a workflow is
callable from outside only when the tenant gave it an active HTTP trigger — and then the `inputSchema`
and `outputSchema` of each runnable one.

Start here. It answers the two questions people otherwise find out the hard way.

### `npm run start:run-and-wait`

The 80% case.

```ts
const result = await workflows.runWorkflowAndWait("SUPPORT_TRIAGE", { input, idempotencyKey: ticketId });
if (result.succeeded) console.log(result.output);
```

Shows typed input/output, progress through `onPoll`, the three honest ways a wait ends (`FINISHED`,
`WAITING` on a person, `TIMED_OUT` while the run carries on), and error handling switched on
`DcdrWorkflowErrorCode` rather than on message text.

### `npm run start:tasks`

Human-in-the-loop: read the runs parked on a person, answer an approval gate, follow the resumed run,
then print its evidence trail with the assurance level of every item.

### `npm run start:validate`

CI gate: parse a definition file, validate it **locally** (free, instant, no network), then validate
it **against the tenant** (the only check that knows your intents, connections and caps). Neither
saves anything, so it is safe on a read-only token and on every commit.

It deliberately does not publish: authoring is not part of this API.

## Configure

| Variable | Default | Used by |
| --- | --- | --- |
| `DCDR_CONTROL_URL` | `https://dcdr.ai` | all |
| `DCDR_SERVICE_TOKEN` | *(required)* | all |
| `DCDR_WORKFLOW_KEY` | `SUPPORT_TRIAGE` | run-and-wait |
| `DCDR_GROUP_KEY` | *(none)* | tasks |
| `DCDR_APPROVE` | `true` | tasks |
| `DCDR_WORKFLOW_DEFINITION` | `../workflow.support_ticket_triage.json` | validate |

```powershell
$env:DCDR_CONTROL_URL   = "https://dcdr.ai"
$env:DCDR_SERVICE_TOKEN = "<your service token>"
$env:DCDR_WORKFLOW_KEY  = "SUPPORT_TRIAGE"

npm run start:catalogue
npm run start:run-and-wait
```

## The same thing from the CLI

Usually the faster way to try something once:

```powershell
npm run dcdr -- wf-list --control-url https://dcdr.ai --service-token $env:DCDR_SERVICE_TOKEN
npm run dcdr -- wf-run SUPPORT_TRIAGE --control-url https://dcdr.ai --service-token $env:DCDR_SERVICE_TOKEN --input-file ./input.json --wait
npm run dcdr -- wf-report <runId> --control-url https://dcdr.ai --service-token $env:DCDR_SERVICE_TOKEN --json
```

See [docs/CLI.md](../../docs/CLI.md) for the full list.

## Where the definition comes from

`start:validate` reads [`../workflow.support_ticket_triage.json`](../workflow.support_ticket_triage.json),
the example documented in [docs/WORKFLOWS.md](../../docs/WORKFLOWS.md). It is written in the
author-facing shorthand (`$ref` / `$fn` / `$template`), so the script parses it with
`parseWorkflowDefinitionShorthand` before anything else.

Full client reference: [docs/WORKFLOW_CLIENT.md](../../docs/WORKFLOW_CLIENT.md).

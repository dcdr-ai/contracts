# CLI (`dcdr`)

`dcdr` is a small command-line client maintained alongside the DCDR runtime. It is **not yet published**
as a package or a standalone binary, so it is available only to those with access to the runtime
repository.

Every command is a thin wrapper over a method of the `@dcdr/contracts` clients, so anything on this
page can be done from your own code: intents with `DcdrRuntimeClient` ([CLIENT.md](CLIENT.md)),
workflows with `DcdrWorkflowClient` ([WORKFLOW_CLIENT.md](WORKFLOW_CLIENT.md)) and knowledge with
`DcdrKnowledgeClient` ([KNOWLEDGE.md](KNOWLEDGE.md)), or all three through `DcdrClient`.

With access to the runtime repository, run it from its root:

```bash
npm ci
npm run dcdr -- --help
```

## Common commands

```bash
# Healthcheck
npm run dcdr -- health --base-url http://localhost:8000 --api-token dev-token

# Execute an intent
npm run dcdr -- run HELLO_WORLD --base-url http://localhost:8000 --api-token dev-token --vars-json '{"name":"Ada"}'

# Stream an intent (SSE). A structured intent prints each field as `path: text` while it streams,
# marks a retry that replaced earlier text, and prints the validated result at the end.
npm run dcdr -- stream HELLO_WORLD --base-url http://localhost:8000 --api-token dev-token --vars-json '{"name":"Ada"}'

# Demo
npm run dcdr -- demo DCDR_LOCAL_DEMO --base-url http://localhost:8000 --api-token dev-token --vars-file ./vars.json

# Dry-run (validate prompt rendering without provider calls)
npm run dcdr -- dry-run HELLO_WORLD --base-url http://localhost:8000 --api-token dev-token --vars-json '{"name":"Ada"}'

# Eval (cloud-only): run an intent across implementations
# Note: this endpoint is disabled in freeware runtime mode (--registry) and may return 403.
npm run dcdr -- eval HELLO_WORLD --base-url https://runtime.dcdr.ai --bearer <TOKEN> --vars-json '{"name":"Ada"}'

# Circuit breaker status
npm run dcdr -- circuit-breaker openai --base-url http://localhost:8000 --api-token dev-token

# Circuit breaker reset (internal-only)
npm run dcdr -- circuit-breaker-reset openai --base-url http://localhost:8000 --api-token dev-token
```

## Workflow commands (`wf-*`)

These talk to the **control plane** (`https://dcdr.ai`), not to a runtime gateway, and authenticate
with a **service token** carrying `workflows:read` / `workflows:run`. Workflows are addressed by key.

```bash
# What may this token run?
npm run dcdr -- wf-list --control-url https://dcdr.ai --service-token $DCDR_SERVICE_TOKEN

# One workflow, with the input it expects
npm run dcdr -- wf-get SUPPORT_TRIAGE --control-url https://dcdr.ai --service-token $SVC

# Run it and wait (exit code 1 when the run did not succeed)
npm run dcdr -- wf-run SUPPORT_TRIAGE --control-url https://dcdr.ai --service-token $SVC   --input-file ./input.json --idempotency-key T-4821 --wait

# Start it and return immediately
npm run dcdr -- wf-run SUPPORT_TRIAGE --control-url https://dcdr.ai --service-token $SVC --input-file ./input.json

# Follow a run that is already going
npm run dcdr -- wf-run-get <runId> --control-url https://dcdr.ai --service-token $SVC --wait

# What a run did
npm run dcdr -- wf-report <runId>   --control-url https://dcdr.ai --service-token $SVC --json
npm run dcdr -- wf-evidence <runId> --control-url https://dcdr.ai --service-token $SVC --json

# Human work: what is parked, then answer one
npm run dcdr -- wf-tasks  --control-url https://dcdr.ai --service-token $SVC
npm run dcdr -- wf-resume <runId> --control-url https://dcdr.ai --service-token $SVC   --payload-json '{"approved":true,"comment":"ok"}'

# One run can hold several tasks (a FOREACH asking a person per item): --frame-id says which one
# you are answering. Every row of wf-tasks prints its frameId and a readable path.
npm run dcdr -- wf-resume <runId> --control-url https://dcdr.ai --service-token $SVC   --frame-id 'root/each:2/fan:signoff' --payload-json '{"approved":true}'

# CI gate: does this definition still compile against our tenant?
npm run dcdr -- wf-validate --control-url https://dcdr.ai --service-token $SVC --definition-file ./workflow.json
```

Full list: `wf-list`, `wf-get`, `wf-versions`, `wf-validate`, `wf-run`, `wf-runs`, `wf-run-get`,
`wf-cancel`, `wf-resume`, `wf-steps`, `wf-evidence`, `wf-report`, `wf-tasks`.

Waiting options for `--wait`: `--poll-ms`, `--poll-max-ms`, `--wait-timeout-ms`, and
`--wait-through-human-tasks` to keep polling a run that parked on a human decision instead of
returning when it does. `--wait-ms` is different: it asks the *server* to hold the response, capped
at two minutes.

Client reference: [WORKFLOW_CLIENT.md](WORKFLOW_CLIENT.md).

## Knowledge commands (`kn-*`)

Since contracts 3.20.0. Like the workflow commands, these talk to the **control plane**
(`--control-url`) with a **service token** (`--service-token`). The API is read-only: collections and
documents are managed in the DCDR web UI. The token needs an action scope **and** a collection grant:

- `knowledge:read` to list and read, `knowledge:run` to search and answer;
- `knowledge:collections:*` for every collection, or `knowledge:collection:<key>` for one.

Collections are named by **key or id** (a UUID is read as an id).

```bash
# What may this token see?
npm run dcdr -- kn-collections --control-url https://dcdr.ai --service-token $SVC

# One collection (index status, search modes), then its documents (metadata only)
npm run dcdr -- kn-collection product-sheets --control-url https://dcdr.ai --service-token $SVC
npm run dcdr -- kn-documents product-sheets --control-url https://dcdr.ai --service-token $SVC --status READY --limit 20
npm run dcdr -- kn-document product-sheets <documentId> --control-url https://dcdr.ai --service-token $SVC

# Passages that match, nothing generated
npm run dcdr -- kn-search --control-url https://dcdr.ai --service-token $SVC   --collections product-sheets,safety-sheets --query "shelf life of T-55" --top-k 8 --mode EXACT_LOOKUP

# A grounded answer, or a refusal (exit code 1 when refused; the response is still printed)
npm run dcdr -- kn-answer --control-url https://dcdr.ai --service-token $SVC   --collections product-sheets --question "How long does T-55 keep once opened?" --locale en

# Answer over exactly the passages a previous search returned (nothing is searched again)
npm run dcdr -- kn-answer --control-url https://dcdr.ai --service-token $SVC   --collections product-sheets --question "How long does T-55 keep?" --chunk-ids <chunkId1>,<chunkId2>

# Stream it: the text is printed as the model writes it
npm run dcdr -- kn-answer --control-url https://dcdr.ai --service-token $SVC   --collections product-sheets --question "How long does T-55 keep?" --stream
```

Full list: `kn-collections`, `kn-collection`, `kn-documents`, `kn-document`, `kn-search`, `kn-answer`.

Options: `--collections` (comma-separated, 1 to 10), `--query`, `--question`, `--top-k`,
`--context-window` (0-3), `--mode`, `--locale`, `--chunk-ids`, `--status`, `--limit`, `--cursor`,
`--stream`. A malformed `--top-k`, `--context-window` or `--status` is refused before anything is sent.

**With `--stream`, the final event decides.** A refusal can arrive after text has already streamed:
the CLI then prints `[refused: <REASON> - the text above is discarded]` and the refusal, and exits 1.
With `--json` it prints `{ events, final, fatalError }`, where `final` is the authoritative answer.
`--timeout-ms` bounds each call, including a whole answer stream (defaults: 15 s, 120 s for an answer).

Client reference: [KNOWLEDGE.md](KNOWLEDGE.md).

## Output options

- `--json` → machine-readable output
- `--color auto|always|never` → ANSI colors

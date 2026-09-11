# CLI (`dcdr`)

The runtime repository includes a small CLI called `dcdr`.

Where it lives:

- It ships with the runtime repository source (it is not a standalone published binary yet).

Run it from the `dcdr-runtime` repository root:

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

# Stream an intent (SSE)
npm run dcdr -- stream HELLO_WORLD --base-url http://localhost:8000 --api-token dev-token --vars-json '{"name":"Ada"}'

# Demo
npm run dcdr -- demo DCDR_LOCAL_DEMO --base-url http://localhost:8000 --api-token dev-token --vars-file ./vars.json

# Dry-run (validate prompt rendering without provider calls)
npm run dcdr -- dry-run HELLO_WORLD --base-url http://localhost:8000 --api-token dev-token --vars-json '{"name":"Ada"}'

# Eval (cloud-only): run an intent across implementations
# Note: this endpoint is disabled in freeware runtime mode (--registry) and may return 403.
npm run dcdr -- eval HELLO_WORLD --base-url https://runtime.dcdr.ai --bearer-token <TOKEN> --vars-json '{"name":"Ada"}'

# Circuit breaker status
npm run dcdr -- circuit-breaker openai --base-url http://localhost:8000 --api-token dev-token

# Circuit breaker reset (internal-only)
npm run dcdr -- circuit-breaker-reset openai --base-url http://localhost:8000 --api-token dev-token
```

## Workflow commands (`wf-*`)

Workflow commands talk to the **control plane** (`https://dcdr.ai`), not to a runtime gateway, so
they take `--control-url` and their own credentials. Everywhere a workflow is named you may pass its
**id or its key**; a non-UUID is looked up by key.

```bash
# List workflows
npm run dcdr -- wf-list --control-url https://dcdr.ai --session-token $DCDR_SESSION_TOKEN

# Run one and wait for the result (exit code 1 when the run did not succeed)
npm run dcdr -- wf-run SUPPORT_TRIAGE --control-url https://dcdr.ai --session-token $DCDR_SESSION_TOKEN   --input-json '{"ticketId":"T-4821"}' --wait

# Start it and return immediately
npm run dcdr -- wf-run SUPPORT_TRIAGE --control-url https://dcdr.ai --session-token $DCDR_SESSION_TOKEN   --input-file ./input.json

# Follow a run that is already going
npm run dcdr -- wf-run-get <runId> --control-url https://dcdr.ai --session-token $DCDR_SESSION_TOKEN --wait

# Validate a definition file against the tenant (intents, connections, caps)
npm run dcdr -- wf-validate SUPPORT_TRIAGE --control-url https://dcdr.ai --session-token $DCDR_SESSION_TOKEN   --definition-file ./workflow.json

# Publish a draft version
npm run dcdr -- wf-publish SUPPORT_TRIAGE --control-url https://dcdr.ai --session-token $DCDR_SESSION_TOKEN   --version-id <versionId> --notes "v1" --reason "Initial rollout"

# Human work: inbox, then answer an approval gate
npm run dcdr -- wf-inbox --control-url https://dcdr.ai --session-token $DCDR_SESSION_TOKEN --scope MINE
npm run dcdr -- wf-resume <runId> --control-url https://dcdr.ai --session-token $DCDR_SESSION_TOKEN   --payload-json '{"approved":true,"comment":"ok"}'

# What a run did
npm run dcdr -- wf-report <runId> --control-url https://dcdr.ai --session-token $DCDR_SESSION_TOKEN --json
npm run dcdr -- wf-evidence <runId> --control-url https://dcdr.ai --session-token $DCDR_SESSION_TOKEN --json

# Machine caller: a service token with `workflows:run`, no user session
npm run dcdr -- wf-trigger SUPPORT_TRIAGE --control-url https://dcdr.ai --service-token $DCDR_SERVICE_TOKEN   --input-json '{"ticketId":"T-4821"}' --idempotency-key T-4821 --wait-ms 30000
```

Full list: `wf-list`, `wf-get`, `wf-versions`, `wf-version`, `wf-validate`, `wf-publish`,
`wf-rollback`, `wf-run`, `wf-runs`, `wf-run-get`, `wf-cancel`, `wf-resume`, `wf-steps`,
`wf-evidence`, `wf-report`, `wf-inbox`, `wf-trigger`, `wf-connections`, `wf-connection-test`.

Waiting options (`--wait`): `--poll-ms`, `--poll-max-ms`, `--wait-timeout-ms`, and
`--wait-through-human-tasks` to keep polling a run that parked on a human decision instead of
returning when it does.

Client reference: [WORKFLOW_CLIENT.md](WORKFLOW_CLIENT.md).

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

## Output options

- `--json` → machine-readable output
- `--color auto|always|never` → ANSI colors

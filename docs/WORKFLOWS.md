# Workflow contract (`workflow.contract.ts`)

> Status: contracts 3.10.0. Workflow execution is a DCDR Cloud / Cloud Pro capability; this document covers the definition format, the execution model a run follows, and the helpers the package ships for tools that consume definitions.

A **workflow** is a declarative state machine that composes intents, HTTP calls, tool capabilities, agentic loops, human decisions and other workflows. The contract defines the shape (`WorkflowDefinition`), the value-mapping DSL used to feed states, a validator with addressed issues, and pure helpers for reference resolution, template rendering, choice selection and transition resolution that any host or editor can reuse.

Two things it deliberately is *not*: it never says **where** a run executes (always the dedicated workflow runner) and it never says **whether a caller waits** (a property of the trigger). To drive one from an application, see [WORKFLOW_CLIENT.md](WORKFLOW_CLIENT.md).

---

## Definition

```jsonc
{
  "schemaVersion": 1,
  "key": "SUPPORT_TRIAGE",              // ^[A-Z][A-Z0-9_-]*$ (same rule as intents)
  "name": "Support ticket triage",
  "inputSchema": { "ticket": { "type": "object", "required": true }, "customerId": { "type": "string", "required": true } },
  "outputSchema": { "category": { "type": "string", "required": true }, "reply": { "type": "string" } },
  "output": { "category": { "$ref": "states.classify.output.category" }, "reply": { "$ref": "states.respond.output.reply", "default": null } },
  "constants": { "slaHours": 24, "team": "support" },
  "settings": { "timeoutMs": 600000, "maxTransitionsPerRun": 20 },
  "startAt": "fetch_customer",
  "states": { /* id -> WorkflowState */ }
}
```

- A workflow has the same contract shape as an intent: a typed `inputSchema` and a typed `outputSchema` (both `PromptVariable` records, so the same editor and validators apply). `output` is the mapping that produces a value of that shape; it is checked against `outputSchema` at publish time (unknown keys, missing required keys), `END.output` overrides are checked the same way, and the resolved run output is validated against the schema when the run finishes. `asset` variables carry file references (`ExecutionAssetReference`), never blobs.
- `constants` are definition-level scalars exposed to references as `constants.*` (SLA hours, team names, thresholds).
- `settings.maxTransitionsPerRun` is the loop guard and it counts **the whole run**, summed across every scope — see [Limits](#limits-and-what-they-actually-bound). `settings.onError` is the default error policy for states that declare none (`FAIL_RUN` when omitted; `GOTO` a cleanup state is the usual choice).
- `states` is a map; every state names its successor(s). Editor layout goes in `display` and is excluded from the hash.

---

## States

One `WorkflowState` shape discriminated by `type`, with exactly one config block matching the type.

| Type | Config block | Notes |
| --- | --- | --- |
| `INTENT` | `intent { intent, vars, inputParts?, routing?, context? }` | `vars` validated against the intent `inputSchema`; `inputParts` only when the intent declares an `asset` variable |
| `HTTP` | `http { connection, method, path, query?, headers?, body?, responseType, expectStatus? }` | the connection owns the base URL and credentials; `Authorization`/`Cookie`-style headers are rejected |
| `TOOL` | `tool { capability, args }` | one capability of the published catalog (`web.fetch`, `ssh.exec`, …); a `CONNECTION`-brokered capability names a tenant connection, a `PLATFORM` one is granted per run |
| `CHOICE` | `choice { choices[{ id, condition, next }], default }` | first matching case wins; `default` is mandatory, so there are no dead ends |
| `TRANSFORM` | `transform { output }` | pure value mapping |
| `END` | `end { outcome, output?, errorCode?, errorMessage? }` | `SUCCEED` / `FAIL`; `output` overrides the definition output |
| `WAIT` | `wait { kind, delayMs?, eventKey?, correlation?, form?, assignees?, instructions?, assignmentGroupKey?, notifyRequester?, timeoutMs }` | `DELAY`, `EXTERNAL_EVENT`, `HUMAN_TASK`; the only state type allowed inside a cycle |
| `PARALLEL` | `parallel { branches[{ id, startAt, states }], failFast? }` | branches are sub-graphs run at once; output `{ branches: { <id>: <branch output> } }` (`WorkflowParallelOutput`) |
| `FOREACH` | `foreach { items, maxItems, concurrency, startAt, states, failFast? }` | body sees `item.value` / `item.index`; output `{ items: [...], count, failed }` (`WorkflowForeachOutput`), **in input order** whatever the concurrency does |
| `SUBWORKFLOW` | `subworkflow { workflowKey, version?, input }` | another published workflow, run **inline in the same run** with its own input, its own snapshots and its own identity; `version` is the masked label (`"1.4.0"`), a string |
| `AGENT` | `agent { plannerIntent, goal, tools[], maxIterations, maxTrackedCalls?, maxToolErrors?, maxDurationMs?, maxEstimatedCost?, historyWindow?, summarizerIntent?, finishOnBound?, context? }` | bounded plan-act loop over a closed tool set; output `WorkflowAgentOutput` |

Common fields: `next` (required unless `CHOICE` / `END`), `onError { action: FAIL_RUN | CONTINUE | GOTO, next? }`, `retry { maxAttempts, backoff, backoffMs, backoffCapMs?, safe? }`, `timeoutMs`, `outputSchema`, `display`, `approval`.

`PARALLEL`, `FOREACH`, `WAIT`, `SUBWORKFLOW` and `AGENT` are advanced states (`WORKFLOW_ADVANCED_STATE_TYPES`), gated by `WorkflowValidationCaps.allowAdvancedStates`.

### Approval gate

Any state but `END` may carry `approval { timeoutMs, assignmentGroupKey?, assignees?, instructions?, notifyRequester? }`. The run parks right before the state executes (a `WAITING` step with `HUMAN_TASK` semantics and `approval: true` in the wait details); the resume payload is the fixed `WORKFLOW_APPROVAL_FORM` (`approved`, optional `comment`). An approval executes the state normally; a rejection fails it with `WORKFLOW_APPROVAL_REJECTED_CODE` so the state's `onError` policy decides; a timeout applies `onError` like any other wait. Approvals are not a state type: a gated state keeps its own transitions and output.

---

## How a run executes: frames

This is the part that changed most in 3.10.0, and it is worth understanding before writing anything with a `PARALLEL`, a `FOREACH` or a human decision in it.

A run does not have *a* position. It has one **frame** per execution scope:

| Frame kind | Opened by |
| --- | --- |
| `ROOT` | the run itself |
| `PARALLEL_BRANCH` | one per branch of a `PARALLEL` |
| `FOREACH_ITEM` | one per item of a `FOREACH` |
| `SUBWORKFLOW` | the child a `SUBWORKFLOW` state calls |
| `AGENT` | an agent loop |

Frames form a tree through `parentFrameId`, and each is addressed by a readable `path` — `root/sweep:0/fan:signoff` is "the `signoff` branch of the `PARALLEL` called `fan`, inside item 0 of the `FOREACH` called `sweep`". Each frame carries its own current state, its own `states.*` snapshots, its own transition count, and its own wait if it is parked.

### What that buys: several scopes can be parked at once

Before 3.10.0 a run carried one open wait, so a `WAIT` inside a `PARALLEL` branch or a `FOREACH` body was refused at publish time. It is now legal and it is the point of the model:

```jsonc
"sweep": {
  "type": "FOREACH", "next": "file",
  "foreach": {
    "items": { "$ref": "input.hosts" }, "maxItems": 10, "concurrency": 3, "startAt": "fan",
    "states": {
      "fan": {
        "type": "PARALLEL", "next": "item_out",
        "parallel": { "branches": [
          { "id": "probe",  "startAt": "fetch", "states": { /* a TOOL call, no person involved */ } },
          { "id": "signoff", "startAt": "ask", "states": {
              "ask": { "type": "WAIT", "next": "asked", "wait": {
                "kind": "HUMAN_TASK", "timeoutMs": 1800000, "assignmentGroupKey": "ops",
                "instructions": { "$fn": "CONCAT", "args": ["Sign off ", { "$ref": "item.value.id" }] },
                "correlation": { "hostId": { "$ref": "item.value.id" } },
                "form": { "approved": { "type": "boolean", "required": true } }
              } },
              "asked": { "type": "END", "end": { "outcome": "SUCCEED", "output": { "$ref": "states.ask.output" } } }
          } }
        ] }
      },
      "item_out": { "type": "END", "end": { "outcome": "SUCCEED", "output": {
        "id": { "$ref": "item.value.id" },
        "approved": { "$ref": "states.fan.output.branches.signoff.approved", "default": false }
      } } }
    }
  }
}
```

Three hosts open **three tasks at once**, in three inboxes, each addressed by its own frame. Answering one does not answer the others; the `FOREACH` joins only when the last one lands.

Four consequences worth knowing:

1. **A finished scope is read, not re-run.** The `probe` branch above completes on the first dispatch. When somebody answers `signoff`, the item is re-entered to reach it — and `probe` is read back from its frame. A capability call, an email, a payment is performed once however many times its siblings are answered.
2. **`correlation` is what tells two identical tasks apart.** Three rows off the same `ask` state differ only by their frame path, which says *where* a task is, not what it is about. A resolved `correlation` (`{ hostId, index }`) is what an inbox row can actually show a person. Resolved for every wait kind since 3.10.0.
3. **A frame that is waiting with no wait of its own is blocked, not assigned.** The `FOREACH` item and the `PARALLEL` above a parked branch are stopped too, but the task belongs to the branch. Only frames carrying a wait are inbox rows.
4. **An `AGENT` may not sit inside a `PARALLEL` branch or a `FOREACH` body** (`NESTED_AGENT_NOT_ALLOWED`). It parks on a cursor of its own — iteration, history, the tool call in flight — which a child frame does not carry. A `WAIT` there is fine; an agent is not.

### Answering a parked run

A run reports every scope it is parked on. Through the client that is `run.waits[]` and `listWorkflowTasks()`, each row carrying `frameId` and `path`; `resumeWorkflowRun(runId, { frameId, payload })` answers one of them. `frameId` is optional and the server resolves it when exactly one frame is parked — which is every single-track workflow — so nothing written before frames has to change. A run with several parked frames answers `409` listing the candidates rather than guessing.

---

## `AGENT`: bounded agentic loop

The workflow stays the cage; the model only chooses *which tool* to call next, from a catalog the author declared:

```jsonc
"research": {
  "type": "AGENT", "next": "done",
  "agent": {
    "plannerIntent": "RESEARCH_PLANNER",                 // must return a WorkflowAgentDecision
    "goal": { "$template": "Assess supplier {{input.supplier}}" },
    "tools": [
      { "id": "search_news", "kind": "INTENT", "intent": "NEWS_SEARCH", "description": "Search recent news about a company." },
      { "id": "fetch_registry", "kind": "STATE", "state": "registry_lookup", "description": "Official registry lookup." },
      { "id": "registry", "kind": "MCP", "connection": "company_mcp", "tools": ["lookup"], "description": "The official company registry server." }
    ],
    "maxIterations": 6, "maxTrackedCalls": 20, "maxToolErrors": 1
  }
}
```

- Loop: the planner receives the goal, the tool catalog, `agent.history` and `context` → `{ action: CALL_TOOL, tool, args }` runs the tool and appends `{ tool, args, output | error }` to the history; `{ action: FINISH, result }` ends the state with `WorkflowAgentOutput { result, stopReason, iterations, trackedCalls, trace }`.
- Tools are intents (`INTENT`, called with the planner's `args`), MCP servers (`MCP`, see below) or states of the same scope (`STATE`: `INTENT`, `HTTP`, `TOOL`, `TRANSFORM`, `SUBWORKFLOW`, `WAIT`) whose mappings read `agent.args.*`, `agent.iteration`, `agent.history[]`, `agent.goal`, `agent.notes[]`, `agent.summary`; `agent.*` is rejected anywhere else. A `WAIT` tool lets the planner ask a human or wait for an event: the run parks and resumes **inside** the loop. A tool state is reached through the agent, so it may omit `next` and it counts as dominated by the agent for reference visibility.
- Bounds are mandatory (`maxIterations`, capped by `WorkflowValidationCaps.maxAgentIterations`, default **25**) and optional (`maxTrackedCalls`, `maxToolErrors`, `maxDurationMs` capped by `maxAgentDurationMs`, `maxEstimatedCost`); hitting one stops the loop with a `WorkflowAgentStopReason` (`MAX_ITERATIONS`, `BUDGET_EXHAUSTED`, `TOO_MANY_TOOL_ERRORS`, `TIMEOUT`, `CANCELED`, `PLANNER_ERROR`) and fails the state unless `finishOnBound` is set.
- Long loops keep their context bounded: `historyWindow` limits the trace entries handed to the planner and `summarizerIntent` compacts the rest into `agent.summary`. Compaction is **incremental** — `WorkflowRunnerAgentCursor.summarizedEntries` records how much the summary already accounts for, so a long run does not re-summarise the same entries every turn. The planner may leave a `notes` scratchpad entry per iteration (`agent.notes[]`).
- `MCP` tools name a connection whose protocol is `MCP`, never an intent or a state, and never declare an `inputSchema`: the catalog is discovered at run time (`tools/list`), so one declared entry becomes as many planner-visible tools as the server advertises. Two allowlists apply and they are **intersected**: `WorkflowMcpConnectionSettings.allowedTools` is the tenant's grant on the connection, and the tool's own `tools` can only narrow further inside it — a workflow author can never reach a tool the tenant did not approve. `listWorkflowMcpConnections(definition)` lists the servers a definition reaches, which `listWorkflowConnections` cannot: it walks the states, and an MCP server is named inside an agent's catalog.
- Evidence: every tool execution is performed by the host, so what was fetched, called or stored is recorded per iteration as `WorkflowEvidence` (`URL`, `ARTIFACT`, `CALL_LOG`, `NOTE`); the planner may add citations in `decision.evidence`, and hosts may refuse a `FINISH` whose citations do not match the trace.
- Cost: a run reports `trackedCalls` and an `estimatedCost` derived from the catalogue's token pricing (`ProviderModelRegistry.estimateTokenCost`). The estimate is **absent rather than zero** for a model the catalogue does not price, so `maxEstimatedCost` can tell "free" from "unknown".
- Deterministic composition still applies around it: a `CHOICE` after the agent routes on `states.research.output.result`.

---

## Values (the mapping DSL)

Every value fed to a state is a `WorkflowValueNode` tree. Authors write the JSON shorthand; `parseWorkflowValueShorthand` / `parseWorkflowDefinitionShorthand` turn it into typed nodes at the boundary and `format…Shorthand` produce it back.

| Shorthand | Node kind | Semantics |
| --- | --- | --- |
| `"text"`, `12`, `true`, `null` | `LITERAL` | as is |
| `{ "$ref": "states.classify.output.severity", "default"?: scalar }` | `REF` | resolved from the run context; `default` when missing, else `null` |
| `{ "$fn": "COALESCE", "args": [ … ] }` | `FN` | closed function catalog (`WorkflowMappingFunction`), arity in `WORKFLOW_MAPPING_FUNCTION_META`; functions are total and return `null` on bad inputs |
| `{ "$template": "Ticket {{input.ticket.id}}" }` | `TEMPLATE` | Mustache-style `{{path}}` interpolation only (no sections/partials); values are stringified, objects as stable JSON |
| `{ … }` / `[ … ]` | `OBJECT` / `ARRAY` | rebuilt recursively |

Reference roots: `input.*`, `states.<id>.output.*`, `states.<id>.status`, `run.*` (`id`, `startedAt`, `attempt`, `requester.*`), `workflow.*` (`key`, `version`), `constants.*`, `item.value.*` / `item.index` (inside `FOREACH`), `agent.*` (inside an `AGENT` and its tools). Grammar: dot segments with optional `[index]` and the wildcard `[*]`, which maps the rest of the path over every element (`input.ticket.attachments[*].id` → array of ids). Array indexes use brackets — `states.sweep.output.items[0].status`, never `items.0.status`. Limits in `DEFAULT_WORKFLOW_VALUE_LIMITS`.

Scope matters: inside a `PARALLEL` branch, `states.*` sees the states that dominate the composite plus the branch's own — never a sibling branch's, because they run at once and reading one would be a race dressed up as a mapping. A child workflow sees its **own** `input`, `constants` and `workflow.key`, not the caller's.

Functions (`WorkflowMappingFunction`, arity in `WORKFLOW_MAPPING_FUNCTION_META`):

- Text: `CONCAT`, `TO_UPPER`, `TO_LOWER`, `TRIM`, `REPLACE`, `SUBSTRING`, `PAD_START`, `PAD_END`, `SPLIT`, `JOIN`, `LENGTH`.
- Conversion: `TO_NUMBER`, `TO_STRING`, `TO_BOOLEAN`, `JSON_STRINGIFY`, `JSON_PARSE`, `BASE64_ENCODE`, `BASE64_DECODE`, `URL_ENCODE`, `URL_DECODE`.
- Arithmetic: `ADD`, `SUBTRACT`, `MULTIPLY`, `DIVIDE`, `MODULO`, `MIN`, `MAX`, `ABS`, `FLOOR`, `CEIL`, `ROUND`, `SUM`, `AVERAGE`, `COUNT`.
- Logic (usable by `IF`): `IF`, `EQ`, `NEQ`, `GT`, `GTE`, `LT`, `LTE`, `AND`, `OR`, `NOT`, `IS_NULL`, `IS_EMPTY`, `INCLUDES`, `COALESCE`.
- Collections: `PLUCK`, `MERGE`, `KEYS`, `VALUES`, `GET`, `PICK`, `OMIT`, `FIRST`, `LAST`, `SLICE`, `UNIQUE`, `FLATTEN`, `SORT`, `REVERSE`, `FILTER_BY`, `FIND_BY`, `RANGE`.
- Dates (ISO-8601, UTC): `NOW_ISO`, `DATE_ADD`, `DATE_DIFF` (units `WorkflowDateUnit`), `FORMAT_DATE` (`YYYY MM DD HH mm ss SSS`), `PARSE_DATE`.

Truthiness (`IF`/`AND`/`OR`/`NOT`): `false`, `null`, `0`, `""`, empty arrays and empty objects are false. Equality (`EQ`/`INCLUDES`/`FILTER_BY`): scalars by value with number/string coercion, objects by stable JSON. A counter in a loop is `{ "$fn": "ADD", "args": [ { "$ref": "states.counter.output.n", "default": 0 }, 1 ] }`.

---

## Conditions

`CHOICE` cases use the shared condition tree from `conditions.contract.ts` (`ConditionLeaf` / `ConditionGroup`), evaluated against the same roots as references. Leaves may compare two paths (`value1Ref` / `value2Ref` / `value3Ref` instead of literals), use `[index]` in paths, and the array (`ARRAY_CONTAINS`, `ARRAY_EMPTY`, `ARRAY_LENGTH_MIN`…) and bounded `MATCHES_REGEX` operators. AI-backed operators are not allowed.

---

## Validation

`validateWorkflowDefinition(definition, { intents?, workflows?, connections?, caps?, valueLimits? })` never throws and returns `{ valid, issues[{ path, code, message }], stateCount, nestingDepth }`. It checks:

- **shape**: schema version, key, settings within caps, `startAt`, state ids (`^[a-z][a-z0-9_]*$`), one config block per type, advanced states gated;
- **graph**: transitions target existing states of the same scope, every state reachable, an `END` reachable, `next` present/absent as required, cycles only through `WAIT` (`CYCLE_WITHOUT_WAIT`);
- **values**: node kinds and payloads, function arity, reference grammar and roots, `item.*` only inside `FOREACH`, `agent.*` only inside an `AGENT` or its tools, `states.<id>` references only to states that run before the referencing state **on every path** (dominators) unless a `default` is given, templates without sections, size limits;
- **nesting**: composites may nest to `caps.maxNestingDepth` (default **3**); an `AGENT` inside a `PARALLEL`/`FOREACH` is refused (`NESTED_AGENT_NOT_ALLOWED`);
- **output contract**: `output` / `END.output` mappings checked against `outputSchema`, and a declared schema must be covered by a mapping;
- **capabilities**: a `TOOL` state's `capability` must be in the package's own catalogue and implemented by the runner (`CAPABILITY_UNKNOWN`, `CAPABILITY_NOT_IMPLEMENTED`), and its `args` are checked against that capability's declared arguments (`CAPABILITY_ARG_UNKNOWN`, `CAPABILITY_ARG_MISSING`) — the catalogue ships with the contract, so this needs no context;
- **cross-checks when context is given**: intent exists, `vars` ⊆ `inputSchema`, required vars mapped, `inputParts` only for intents with asset variables, connection exists, forbidden credential headers, `SUBWORKFLOW` target published with its `input` mapping checked against the child's `inputSchema` (a workflow cannot call itself).

Run it before publishing, always — the validator is the contract's own opinion of a definition and every host applies the same rules.

---

## Limits, and what they actually bound

| Limit | Where | What it bounds |
| --- | --- | --- |
| `settings.maxTransitionsPerRun` | definition, capped by `caps.maxTransitionsPerRun` (default 200) | state executions **in the whole run, summed across every frame** — per run and not per frame, because a runaway does not care which scope it is in |
| `foreach.maxItems` | per `FOREACH` | how many items the state may process; a longer list is **truncated, not failed** |
| `foreach.concurrency` | per `FOREACH` | how many items run at once |
| `caps.maxNestingDepth` | validation (default 3) | how far composites may nest |
| `caps.maxStates` | validation (default 100) | states in one definition |
| `settings.timeoutMs` | definition, capped by `caps.maxTimeoutMs` | whole-run wall clock |
| `agent.maxIterations` | per `AGENT`, capped by `caps.maxAgentIterations` (default 25) | planner turns |

A wide fan-out spends the transition budget quickly: a `FOREACH` of 200 items at 10 transitions each is 2 000 transitions whoever counts them. Size the ceiling for the work, not for the graph. Note also that fan-out multiplies **step records**, which are bounded separately by the tenant's tier.

---

## Helpers

- `resolveWorkflowValue(node, ctx)`, `resolveWorkflowValueRecord(record, ctx)`, `renderWorkflowTemplate(text, ctx)`, `resolveWorkflowRef(path, ctx)`.
- `evaluateLocalWorkflowState(state, ctx)` for `CHOICE` / `TRANSFORM` / `END`; `isHostExecutedWorkflowState(type)` for the rest.
- `resolveWorkflowTransition(definition, stateId, outcome, ctx)` → `{ kind: CONTINUE | END | ERROR_HANDLED | FAIL, next?, snapshot, endOutcome?, runOutput?, error?, caseId? }`.
- `computeWorkflowDefinitionSha256(definition, { sha256Hex })` over the canonical form (`display` stripped, keys sorted); `canonicalizeWorkflowDefinition` / `canonicalWorkflowDefinitionJson`.
- `listWorkflowIntents`, `listWorkflowConnections`, `listWorkflowMcpConnections`, `listWorkflowSubworkflows`, `workflowUsesAdvancedStates`, `workflowCanPark` (whether a definition contains anything that stops a run — a `WAIT`, an approval gate, at any depth), `inferWorkflowStateOutputSchema`, `validateWorkflowValueAgainstSchema`, `toWorkflowValidationIntents`.

A complete example definition with replay cases lives in `tests/fixtures/workflows/support_ticket_triage.golden.json`.

---

## Published shape

`WorkflowContract { id, key, version, sha256, active, definition }` is the shape hosts receive for a published workflow. Workflows are not part of `DcdrRegistry`: the runtime keeps executing intents one at a time and never sees a workflow definition.

---

## Driving one from code

This document is the *definition* format. To create, publish and **run** workflows from an application, use the typed client: [WORKFLOW_CLIENT.md](WORKFLOW_CLIENT.md) — `DcdrWorkflowClient`, with `runWorkflowAndWait` as the one call most integrations need, `listWorkflowTasks` for the inbox and `resumeWorkflowRun` to answer a parked scope. The same commands are available from the CLI: see [CLI.md](CLI.md).

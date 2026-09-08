# Workflow contract (`workflow.contract.ts`)

> Status: contracts 3.0.0. Workflow execution is a DCDR Cloud / Cloud Pro capability; this document covers the definition format and the helpers available in the package.

A **workflow** is a declarative state machine that composes intents, HTTP calls, choices and transforms. The contract defines the shape (`WorkflowDefinition`), the value-mapping DSL used to feed states, a validator with addressed issues, and pure helpers for reference resolution, template rendering, choice selection and transition resolution that any tool consuming definitions can reuse.

## Definition

```jsonc
{
  "schemaVersion": 1,
  "key": "SUPPORT_TRIAGE",              // ^[A-Z][A-Z0-9_-]*$ (same rule as intents)
  "name": "Support ticket triage",
  "input": { "ticket": { "type": "object", "required": true }, "customerId": { "type": "string", "required": true } },
  "outputSchema": { "category": { "type": "string", "required": true }, "reply": { "type": "string" } },
  "output": { "category": { "$ref": "states.classify.output.category" }, "reply": { "$ref": "states.respond.output.reply", "default": null } },
  "settings": { "timeoutMs": 600000, "maxTransitionsPerRun": 20 },
  "startAt": "fetch_customer",
  "states": { /* id -> WorkflowState */ }
}
```

- A workflow has the same contract shape as an intent: a typed `input` and a typed `outputSchema` (both `PromptVariable` records, so the same editor and validators apply). `output` is the mapping that produces a value of that shape; it is checked against `outputSchema` at publish time (unknown keys, missing required keys), `END.output` overrides are checked the same way, and the resolved run output is validated against the schema when the run finishes. `asset` variables carry file references (`ExecutionAssetReference`), never blobs.
- `constants` are definition-level scalars exposed to references as `constants.*` (SLA hours, team names, thresholds).
- A definition never says how it runs: every run executes in the dedicated workflow runner, and whether the caller waits for the result is a property of the trigger, not of the workflow. `settings.maxTransitionsPerRun` is the loop guard; `settings.onError` is the default error policy for states that declare none (`FAIL_RUN` when omitted, `GOTO` a cleanup state is the usual choice).
- `states` is a map; every state names its successor(s). Editor layout goes in `display` and is excluded from the hash.

## States

One `WorkflowState` shape discriminated by `type`, with exactly one config block matching the type (`intent`, `http`, `choice`, `transform`, `end`, `wait`, `parallel`, `foreach`, `subworkflow`).

| Type | Config block | Notes |
| --- | --- | --- |
| `INTENT` | `intent { intent, vars, inputParts?, routing?, context? }` | `vars` validated against the intent `inputSchema`; `inputParts` only when the intent declares an `asset` variable |
| `HTTP` | `http { connection, method, path, query?, headers?, body?, responseType, expectStatus? }` | the connection owns the base URL and credentials; `Authorization`/`Cookie`-style headers are rejected |
| `CHOICE` | `choice { choices[{ id, condition, next }], default }` | first matching case wins; `default` is mandatory |
| `TRANSFORM` | `transform { output }` | pure value mapping |
| `END` | `end { outcome, output?, errorCode?, errorMessage? }` | `SUCCEED` / `FAIL`; `output` overrides the definition output |
| `WAIT` | `wait { kind, delayMs?, eventKey?, correlation?, form?, assignees?, instructions?, assignmentGroupKey?, notifyRequester?, timeoutMs }` | `DELAY`, `EXTERNAL_EVENT` (with optional `correlation` values the event payload must match), `HUMAN_TASK` (typed `form`, assignees/instructions mappings); the only state type allowed inside a cycle |
| `PARALLEL` | `parallel { branches[{ id, startAt, states }], failFast? }` | branches are sub-graphs; output `{ branches: { <id>: <branch output> } }` (`WorkflowParallelOutput`) |
| `FOREACH` | `foreach { items, maxItems, concurrency, startAt, states, failFast? }` | body sees `item.value` / `item.index`; output `{ items: [...], count, failed }` (`WorkflowForeachOutput`) |
| `SUBWORKFLOW` | `subworkflow { workflowKey, version?, input }` | |
| `AGENT` | `agent { plannerIntent, goal, tools[], maxIterations, maxTrackedCalls?, maxToolErrors?, maxDurationMs?, maxEstimatedCost?, historyWindow?, summarizerIntent?, finishOnBound?, context? }` | bounded plan-act loop over a closed tool set; output `WorkflowAgentOutput` |

Common fields: `next` (required unless `CHOICE` / `END`), `onError { action: FAIL_RUN | CONTINUE | GOTO, next? }`, `retry { maxAttempts, backoff, backoffMs, backoffCapMs?, safe? }`, `timeoutMs`, `outputSchema`, `display`, `approval`.

### Approval gate

Any state but `END` may carry `approval { timeoutMs, assignmentGroupKey?, assignees?, instructions?, notifyRequester? }`. The run parks right before the state executes (a `WAITING` step with `HUMAN_TASK` semantics and `approval: true` in the runner wait details); the resume payload is the fixed `WORKFLOW_APPROVAL_FORM` (`approved`, optional `comment`). An approval executes the state normally; a rejection fails it with `WORKFLOW_APPROVAL_REJECTED_CODE` so the state `onError` policy decides; a timeout applies `onError` like any other wait. Approvals are not a state type: a gated state keeps its own transitions and output.

`PARALLEL`, `FOREACH`, `WAIT`, `SUBWORKFLOW` and `AGENT` are advanced states (`WORKFLOW_ADVANCED_STATE_TYPES`), gated by `WorkflowValidationCaps.allowAdvancedStates`.

### `AGENT`: bounded agentic loop

The workflow stays the cage; the model only chooses *which tool* to call next, from a catalog the author declared:

```jsonc
"research": {
  "type": "AGENT", "next": "done",
  "agent": {
    "plannerIntent": "RESEARCH_PLANNER",                 // must return a WorkflowAgentDecision
    "goal": { "$template": "Assess supplier {{input.supplier}}" },
    "tools": [
      { "id": "search_news", "kind": "INTENT", "intent": "NEWS_SEARCH", "description": "Search recent news about a company." },
      { "id": "fetch_registry", "kind": "STATE", "state": "registry_lookup", "description": "Official registry lookup." }
    ],
    "maxIterations": 6, "maxTrackedCalls": 20, "maxToolErrors": 1
  }
}
```

- Loop: the planner receives the goal, the tool catalog, `agent.history` and `context` → `{ action: CALL_TOOL, tool, args }` runs the tool and appends `{ tool, args, output | error }` to the history; `{ action: FINISH, result }` ends the state with `WorkflowAgentOutput { result, stopReason, iterations, trackedCalls, trace }`.
- Tools are either intents (`INTENT`, called with the planner's `args`) or states of the same scope (`STATE`: `INTENT`, `HTTP`, `TRANSFORM`, `SUBWORKFLOW`, `WAIT`) whose mappings read `agent.args.*`, `agent.iteration`, `agent.history[]`, `agent.goal`, `agent.notes[]`, `agent.summary`; `agent.*` is rejected anywhere else. A `WAIT` tool lets the planner ask a human (`HUMAN_TASK`) or wait for an event: the run parks and resumes inside the loop. A tool state is reached through the agent, so it may omit `next` (never followed when invoked as a tool) and it counts as dominated by the agent for reference visibility.
- Bounds are mandatory (`maxIterations`, capped by `WorkflowValidationCaps.maxAgentIterations`) and optional (`maxTrackedCalls`, `maxToolErrors`, `maxDurationMs` capped by `maxAgentDurationMs`, `maxEstimatedCost`); hitting one stops the loop with a `WorkflowAgentStopReason` (`MAX_ITERATIONS`, `BUDGET_EXHAUSTED`, `TOO_MANY_TOOL_ERRORS`, `TIMEOUT`, `CANCELED`, `PLANNER_ERROR`) and fails the state unless `finishOnBound` is set.
- Long loops keep their context bounded: `historyWindow` limits the trace entries handed to the planner and `summarizerIntent` compacts the rest into `agent.summary`. The planner may leave a `notes` scratchpad entry per iteration (`agent.notes[]`).
- Evidence: every tool execution is performed by the host, so what was fetched, called or stored is recorded per iteration as `WorkflowEvidence` (`URL`, `ARTIFACT`, `CALL_LOG`, `NOTE`); the planner may add its own citations in `decision.evidence`, and hosts may refuse a `FINISH` whose citations do not match the trace.
- Deterministic composition still applies around it: a `CHOICE` after the agent routes on `states.research.output.result`, and an `AGENT` can itself be a tool of another via a `SUBWORKFLOW` state.

## Values (the mapping DSL)

Every value fed to a state is a `WorkflowValueNode` tree. Authors write the JSON shorthand; `parseWorkflowValueShorthand` / `parseWorkflowDefinitionShorthand` turn it into typed nodes at the boundary and `format…Shorthand` produce it back.

| Shorthand | Node kind | Semantics |
| --- | --- | --- |
| `"text"`, `12`, `true`, `null` | `LITERAL` | as is |
| `{ "$ref": "states.classify.output.severity", "default"?: scalar }` | `REF` | resolved from the run context; `default` when missing, else `null` |
| `{ "$fn": "COALESCE", "args": [ … ] }` | `FN` | closed function catalog (`WorkflowMappingFunction`), arity in `WORKFLOW_MAPPING_FUNCTION_META`; functions are total and return `null` on bad inputs |
| `{ "$template": "Ticket {{input.ticket.id}}" }` | `TEMPLATE` | Mustache-style `{{path}}` interpolation only (no sections/partials); values are stringified, objects as stable JSON |
| `{ … }` / `[ … ]` | `OBJECT` / `ARRAY` | rebuilt recursively |

Reference roots: `input.*`, `states.<id>.output.*`, `states.<id>.status`, `run.*` (`id`, `startedAt`, `attempt`, `requester.*`), `workflow.*` (`key`, `version`), `constants.*`, `item.value.*` / `item.index` (inside `FOREACH`). Grammar: dot segments with optional `[index]` and the wildcard `[*]`, which maps the rest of the path over every element (`input.ticket.attachments[*].id` → array of ids); limits in `DEFAULT_WORKFLOW_VALUE_LIMITS`.

Functions (`WorkflowMappingFunction`, arity in `WORKFLOW_MAPPING_FUNCTION_META`):

- Text: `CONCAT`, `TO_UPPER`, `TO_LOWER`, `TRIM`, `REPLACE`, `SUBSTRING`, `PAD_START`, `PAD_END`, `SPLIT`, `JOIN`, `LENGTH`.
- Conversion: `TO_NUMBER`, `TO_STRING`, `TO_BOOLEAN`, `JSON_STRINGIFY`, `JSON_PARSE`, `BASE64_ENCODE`, `BASE64_DECODE`, `URL_ENCODE`, `URL_DECODE`.
- Arithmetic: `ADD`, `SUBTRACT`, `MULTIPLY`, `DIVIDE`, `MODULO`, `MIN`, `MAX`, `ABS`, `FLOOR`, `CEIL`, `ROUND`, `SUM`, `AVERAGE`, `COUNT`.
- Logic (usable by `IF`): `IF`, `EQ`, `NEQ`, `GT`, `GTE`, `LT`, `LTE`, `AND`, `OR`, `NOT`, `IS_NULL`, `IS_EMPTY`, `INCLUDES`, `COALESCE`.
- Collections: `PLUCK`, `MERGE`, `KEYS`, `VALUES`, `GET`, `PICK`, `OMIT`, `FIRST`, `LAST`, `SLICE`, `UNIQUE`, `FLATTEN`, `SORT`, `REVERSE`, `FILTER_BY`, `FIND_BY`, `RANGE`.
- Dates (ISO-8601, UTC): `NOW_ISO`, `DATE_ADD`, `DATE_DIFF` (units `WorkflowDateUnit`), `FORMAT_DATE` (`YYYY MM DD HH mm ss SSS`), `PARSE_DATE`.

Truthiness (`IF`/`AND`/`OR`/`NOT`): `false`, `null`, `0`, `""`, empty arrays and empty objects are false. Equality (`EQ`/`INCLUDES`/`FILTER_BY`): scalars by value with number/string coercion, objects by stable JSON. A counter in a loop is `{ "$fn": "ADD", "args": [ { "$ref": "states.counter.output.n", "default": 0 }, 1 ] }`.

## Conditions

`CHOICE` cases use the shared condition tree from `conditions.contract.ts` (`ConditionLeaf` / `ConditionGroup`), evaluated against the same roots as references (`input`, `states`, `run`, `workflow`, `constants`, `item`, `agent`). Leaves may compare two paths (`value1Ref` / `value2Ref` / `value3Ref` instead of literals), use `[index]` in paths, and the array (`ARRAY_CONTAINS`, `ARRAY_EMPTY`, `ARRAY_LENGTH_MIN`…) and bounded `MATCHES_REGEX` operators. AI-backed operators are not allowed.

## Validation

`validateWorkflowDefinition(definition, { intents?, connections?, caps?, valueLimits? })` never throws and returns `{ valid, issues[{ path, code, message }], stateCount, nestingDepth }`. It checks:

- shape: schema version, key, settings within caps, `startAt`, state ids (`^[a-z][a-z0-9_]*$`), one config block per type, advanced states gated;
- graph: transitions target existing states of the same scope, every state reachable, an `END` reachable, `next` present/absent as required, cycles only through `WAIT`;
- values: node kinds and payloads, function arity, reference grammar and roots, `item.*` only inside `FOREACH`, `states.<id>` references only to states that run before the referencing state on every path (dominators) unless a `default` is given, templates without sections, size limits;
- output contract: `output` / `END.output` mappings checked against `outputSchema`, and a declared schema must be covered by a mapping;
- cross-checks when context is given: intent exists, `vars` ⊆ `inputSchema`, required vars mapped, `inputParts` only for intents with asset variables, connection exists, forbidden credential headers, `SUBWORKFLOW` target published with its `input` checked against the child's input schema (a workflow cannot call itself).

## Helpers

- `resolveWorkflowValue(node, ctx)`, `resolveWorkflowValueRecord(record, ctx)`, `renderWorkflowTemplate(text, ctx)`, `resolveWorkflowRef(path, ctx)`.
- `evaluateLocalWorkflowState(state, ctx)` for `CHOICE` / `TRANSFORM` / `END`; `isHostExecutedWorkflowState(type)` for the rest.
- `resolveWorkflowTransition(definition, stateId, outcome, ctx)` → `{ kind: CONTINUE | END | ERROR_HANDLED | FAIL, next?, snapshot, endOutcome?, runOutput?, error?, caseId? }`.
- `computeWorkflowDefinitionSha256(definition, { sha256Hex })` over the canonical form (`display` stripped, keys sorted); `canonicalizeWorkflowDefinition` / `canonicalWorkflowDefinitionJson`.
- `listWorkflowIntents`, `listWorkflowConnections`, `listWorkflowSubworkflows`, `workflowUsesAdvancedStates`, `inferWorkflowStateOutputSchema` (intent output schema for `INTENT`, child `outputSchema` for `SUBWORKFLOW`, `form` for `WAIT`), `validateWorkflowValueAgainstSchema`, `toWorkflowValidationIntents`.

A complete example definition with replay cases lives in `tests/fixtures/workflows/support_ticket_triage.golden.json`.

## Published shape

`WorkflowContract { id, key, version, sha256, active, definition }` is the shape hosts receive for a published workflow. Workflows are not part of `DcdrRegistry`: the runtime keeps executing intents one at a time and never sees a workflow definition.

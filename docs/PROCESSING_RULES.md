# Processing Rules And Processors

This document describes the shared public contract surface for the DCDR intent-processing engine.

Scope:

- intent execution
- the **captured copy** of AI Gateway calls on a `FULL` service token (since contracts 3.27.0, see
  [Gateway content capture](#gateway-content-capture)); gateway traffic itself is never processed
- cloud-only feature today; freeware/runtime `--registry` mode should reject registries that require processing processors

## Why this lives in `@dcdr/contracts`

The processing engine is intentionally shared across:

- runtime execution
- frontend rule editors/previews
- backend-adjacent tooling
- tests that need deterministic processor ordering and bounded trail semantics

## Core exports

The contracts package exports:

- `ProcessingStage`
- `ProcessingRuleKind`
- `ProcessingRuleGroup`
- `ProcessingTargetKind`
- `ProcessingAction`
- `ProcessingPolicyOutcome`
- `ProcessingFailureMode`
- `ProcessingEvidenceKind`
- `ProcessingPolicyReasonCode`
- `ProcessingOutputPolicyRef`
- `ProcessingReviewQueue`
- `ProcessingScope`
- `ProcessingRuntimeMode`
- `ProcessingCacheBehavior`
- `ProcessingRuleConfigValueType`
- `ProcessingRegexFlag`
- `ProcessingRuleConfigurationMap`
- `ProcessingValidationIssueCode`
- `ProcessingRuleDefinition`
- `ProcessingProcessor`
- `ProcessingRuleConfigFieldDefinition`
- `ProcessingRuleSchemaDefinition`
- `PROCESSING_RULE_SCHEMAS`
- `ProcessingValidationIssue`
- `ProcessingValidationResult`
- `ProcessingTrailEntry`
- `ProcessingStageSummary`
- `ExecutionProcessingReport`
- `IntentProcessingSemantics`
- `ConditionOperator`, `ConditionLogicOp`, `ConditionLeaf`, `ConditionGroup` (from `conditions.contract.ts`; the 2.x names `ConditionOp`, `ImplementationCondition`, `LogicalImplementationCondition` stay available in 3.x)

Processors can be attached at two contract levels:

- `DcdrRegistry.processors` for global processors
- `IntentContract.processors` for intent-specific processors

`ProcessingTrailEntry.scope` records which layer produced each effective trail entry:

- `GLOBAL`
- `INTENT`

For governance-oriented rules, `ProcessingTrailEntry` can also project:

- `policyOutcome?: ProcessingPolicyOutcome`
- `policyReasonCode?: ProcessingPolicyReasonCode`

This keeps frontend preview/reporting aligned with runtime without having to infer policy semantics from free-form text.

## Authoring model

The authoring model is intentionally split into two layers:

- atomic rules:
  - shared in contracts
  - versioned by package release
  - represented by `ProcessingRuleKind` + `PROCESSING_RULE_SCHEMAS`
- processors:
  - configured in the registry
  - versioned by product/backend/frontend
  - represented by `ProcessingProcessor`

This means frontend should think in terms of:

1. choose atomic rule primitives from the catalog
2. compose them into one ordered processor
3. attach processors to registry or intent scope
4. optionally attach a shared condition tree to each rule

## Shared condition model

Processing rules can reuse the same condition tree already used by conditioned routing.

That means a rule may declare:

- `condition?: ConditionLeaf | ConditionGroup<ConditionLeaf>`

using the shared vocabulary from `conditions.contract.ts`:

- `ConditionOperator` (`ConditionOp` in 2.x code)
- `ConditionLogicOp`

Validation and evaluation are shared too: `validateConditionTree` (non-throwing, addressed issues) and `evaluateConditionTreeOnScope` (throws `CONFIG_ERROR` on misconfiguration) are exported from the same module so previews and hosts behave identically.

This is intentional so frontend can reuse nearly the same builder/preview UI for:

- execution routing conditions
- processing rule conditions

Example:

```ts
{
  id: "mask-secret",
  kind: ProcessingRuleKind.MASK_SUBSTRING,
  fieldPaths: ["vars.message"],
  condition: {
    path: "vars.message",
    op: ConditionOperator.CONTAINS,
    value1: "secret",
    caseInsensitive: true
  },
  configuration: {
    start: 0,
    end: 6,
    maskChar: "*"
  }
}
```

## Atomic rule catalog

The first shared atomic rule catalog includes:

- `TRIM`
- `COLLAPSE_WHITESPACE`
- `NORMALIZE_NEW_LINES`
- `REMOVE_CONTROL_CHARS`
- `REPLACE_REGEX`

Example atomic rule schema:

```ts
{
  kind: ProcessingRuleKind.REPLACE_REGEX,
  label: "Replace regex",
  allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
  supportsFieldPaths: true,
  supportsStopOnMatch: false,
  configurationFields: [
    {
      key: "pattern",
      type: ProcessingRuleConfigValueType.STRING,
      required: true
    },
    {
      key: "replacement",
      type: ProcessingRuleConfigValueType.STRING,
      required: true
    },
    {
      key: "flags",
      type: ProcessingRuleConfigValueType.STRING_LIST,
      enumValues: [
        ProcessingRegexFlag.GLOBAL,
        ProcessingRegexFlag.CASE_INSENSITIVE,
        ProcessingRegexFlag.MULTILINE,
        ProcessingRegexFlag.DOT_ALL,
        ProcessingRegexFlag.UNICODE
      ]
    }
  ]
}
```

## Processor shape

A processor is the product-facing execution unit:

```json
{
  "id": "phi-compliance-input",
  "version": "1",
  "stage": "INPUT",
  "rules": [
    {
      "id": "trim-message",
      "kind": "TRIM",
      "fieldPaths": ["vars.message"]
    },
    {
      "id": "normalize-lines",
      "kind": "NORMALIZE_NEW_LINES",
      "fieldPaths": ["vars.message"]
    },
    {
      "id": "redact-card",
      "kind": "REPLACE_REGEX",
      "fieldPaths": ["vars.message"],
      "configuration": {
        "pattern": "\\\\b\\\\d{16}\\\\b",
        "replacement": "[REDACTED]",
        "flags": ["GLOBAL"]
      }
    }
  ]
}
```

The intended modeling rule is:

- `rule kind` describes what one atomic primitive does
- `processor stage` describes when the whole composed chain runs

So stage should live on the processor, not be duplicated into one rule kind per stage.

For governance use cases, the recommended authoring mental model is:

- one processor = one named product behavior or compliance preset
- one processor contains an ordered chain of atomic rules
- registry-level processors are global guardrails
- intent-level processors are use-case-specific guardrails

Example governance-oriented processor:

```ts
{
  id: "cloud-output-governance",
  version: "1",
  stage: ProcessingStage.OUTPUT,
  rules: [
    {
      id: "provider-allowlist",
      kind: ProcessingRuleKind.PROVIDER_POLICY_CHECK,
      configuration: {
        allowedProviders: ["OPEN_AI", "ANTHROPIC"]
      }
    },
    {
      id: "pii-review-policy",
      kind: ProcessingRuleKind.OUTPUT_POLICY_CHECK,
      fieldPaths: ["summary"],
      configuration: {
        policyRef: ProcessingOutputPolicyRef.PII_OUTPUT_POLICY
      }
    },
    {
      id: "review-route",
      kind: ProcessingRuleKind.REVIEW_ROUTING,
      fieldPaths: ["summary"],
      configuration: {
        queue: ProcessingReviewQueue.HUMAN_COMPLIANCE
      }
    }
  ]
}
```

This processor model is currently Cloud / Cloud Pro only. Freeware/runtime `--registry` mode should reject registries that require processors.

## Validation and defaults

Frontend can follow a deterministic flow without backend-specific metadata:

1. Load `PROCESSING_RULE_SCHEMAS`.
2. Render atomic rule forms from `configurationFields`.
3. Seed defaults with `IntentProcessingSemantics.buildRuleConfigurationWithDefaults(...)`.
4. Validate each rule with `IntentProcessingSemantics.validateRuleDefinition(...)`.
5. Validate the whole processor with `IntentProcessingSemantics.validateProcessorDefinition(...)`.

## Engine shape

The intended runtime model is:

1. `INPUT` processors run before execution
2. current execution core runs unchanged
3. `OUTPUT` processors run after execution

Runtime may keep richer local state internally, but the shared contracts define the bounded shape that can be previewed and logged consistently.

## Hashing semantics

These rules are important for reproducibility and cache behavior:

- `problemHash` and `runHash` should be based on the processed input that actually reaches execution.
- `outputHash` should be based on the final post-processed output that the caller logically receives.

For that reason, rule-level `cacheBehavior` exists so preview tools and runtime can agree on which rules are safe for cache/dedupe semantics:

- `CACHE_SAFE`
- `CACHE_UNSAFE`
- `CACHE_BYPASS_REQUIRED`

## Bounded processing trail

`ExecutionProcessingReport` is intentionally metadata-first.

It should answer:

- which processors were configured
- which rules ran
- whether anything mutated
- whether a rule blocked execution or required review
- which bounded evidence entries were recorded

`ProcessingTrailEntry` is designed for auditability without turning reports/logs into raw payload stores.

Each entry records:

- `scope`
- `processorId`
- `processorVersion`
- `ruleId`
- `ruleKind`
- optional typed policy decision metadata (`policyOutcome`, `policyReasonCode`)
- bounded mutation/evidence metadata

## Privacy rules: what PII detection and redaction look for

`PII_DETECTION` and `PII_REDACTION` share one built-in, deterministic pattern set. A string target is
treated as containing personal data when it contains any of:

- **E-mail addresses** (`ada@example.com`).
- **Phone numbers**
  - international, with a `+` or `00` prefix and a country code, 7 to 15 digits in total, written
    with or without spaces, dots, dashes or parentheses: `+34 612 345 678`, `+34612345678`,
    `+1 (415) 555-0123`, `+44 (0)20 7946 0958`, `0049 30 1234567`, `+33 6 12 34 56 78`;
  - common national formats, written with separators:
    - Spain (9 digits starting with 6, 7, 8 or 9): `612 345 678`, `612 34 56 78`, `612-345-678`,
      `91 234 56 78`;
    - US/Canada: `(415) 555-0123`, `415-555-0123`, `415.555.0123`, `1-800-555-0199`;
    - France: `06 12 34 56 78`, `01.23.45.67.89`;
    - UK, Germany and other trunk-`0` formats: `020 7946 0958`, `07911 123456`, `030 1234567`,
      `030/1234567`, `(030) 1234567`.
- **Long digit runs** of 9 to 16 consecutive digits (card or account numbers, and phone numbers
  written without separators such as `612345678`).
- **SSN-shaped numbers** (`123-45-6789`).
- **DNI-shaped identifiers** (8 digits and a letter, `12345678Z`).

Phone detection is deliberately conservative around numbers that are not phones: amounts
(`1.234.567,89`, `12,345.67 EUR`, `$1,234,567`), dates and times (`2026-11-16`, `16/11/2026`,
`10:30:00`, ISO timestamps), IP addresses, version strings (`3.24.0`), percentages, decimals and ids
that mix letters and digits (`INV-2026-000123`) are not treated as phone numbers. The long-digit-run
pattern still applies to them, so any 9 to 16 consecutive digits (for example the all-digit last
group of a UUID, or a Unix timestamp) count as personal data.

Phones are handled exactly like the rest of the PII:

- `PII_REDACTION` replaces each occurrence with `configuration.replacement` (default `[REDACTED]`),
  the `+`/`00` prefix and separators included.
- `PII_DETECTION` reports it with the configured `matchMode` (`PII_DETECTION_WARN`,
  `PII_DETECTION_BLOCKED`, `PII_DETECTION_REVIEW`). Reason codes name the rule, not the kind of
  personal data found.
- The `entityTypes` configuration field is accepted but not applied yet: every kind above is always
  checked.

The patterns are heuristics, not a guarantee: a number written in an unusual layout may be missed,
and a non-personal number shaped exactly like a phone (for example `612 345 678` used as a
space-grouped amount) is masked. Combine them with `REPLACE_REGEX` or `MASK_SUBSTRING` on known
fields when a format specific to your data must always be caught.

## Policy-oriented rule semantics

The current policy-oriented rule family is:

- `PROVIDER_POLICY_CHECK`
- `MODEL_POLICY_CHECK`
- `OUTPUT_POLICY_CHECK`
- `REVIEW_ROUTING`

These rules are expected to emit stable policy metadata through:

- `ProcessingPolicyOutcome`
- `ProcessingPolicyReasonCode`

And their authoring-time configuration should prefer closed catalogs when DCDR owns the vocabulary. Today that includes:

- `OUTPUT_POLICY_CHECK.configuration.policyRef: ProcessingOutputPolicyRef`
- `REVIEW_ROUTING.configuration.queue: ProcessingReviewQueue`
- `PROVIDER_POLICY_CHECK.configuration.allowedProviders/deniedProviders: IntentProvider[]`

Examples:

- `PROVIDER_ALLOWED`
- `PROVIDER_NOT_ALLOWED`
- `MODEL_ALLOWED`
- `MODEL_NOT_ALLOWED`
- `OUTPUT_POLICY_FLAGGED`
- `REVIEW_QUEUE_REQUIRED`

Region filters are contract-ready today through optional configuration such as:

- `allowedRegions`
- `deniedRegions`

But runtime only enforces them when explicit region context exists. If region filters are configured and no runtime region is available, the intended trail behavior is a non-blocking warning with:

- `policyOutcome = WARN`
- `policyReasonCode = REGION_CONTEXT_MISSING`

Example:

```ts
{
  id: "output-policy",
  kind: ProcessingRuleKind.OUTPUT_POLICY_CHECK,
  fieldPaths: ["summary"],
  configuration: {
    policyRef: ProcessingOutputPolicyRef.MANUAL_REVIEW_POLICY
  }
}

{
  id: "review-route",
  kind: ProcessingRuleKind.REVIEW_ROUTING,
  fieldPaths: ["summary"],
  configuration: {
    queue: ProcessingReviewQueue.HUMAN_COMPLIANCE
  }
}
```

## Gateway content capture

Since contracts 3.27.0 a service token can carry a payload level for its AI Gateway calls
(`DcdrGatewayTokenCheckResponse.payloadLevel`, same vocabulary as telemetry services). At `FULL`, the content the
gateway captured (`GatewayExecutionLogDetails.content`, a `CapturedContent`) goes through processors before it
leaves the runtime, with the same engine and the same processor shape as intents:

1. the tenant's **global processors** (the registry's `processors`), unless the token sets
   `applyGlobalProcessors: false` (absent means they run);
2. the token's own `processors`.

Stages and fields:

| Stage | Sees | Data root |
| --- | --- | --- |
| `INPUT` | `vars.input` (the request member as JSON text) and `vars.system` (`instructions` / `system`) | `vars` |
| `OUTPUT` | `output` (the response object as JSON text) | the whole output object |

Rules that read a field by path use those names (`fieldPaths: ["output"]` on an `OUTPUT` processor). The texts
are JSON, so a text rule (`REPLACE_REGEX`, `PII_REDACTION`, `MASK_SUBSTRING`...) sees and rewrites the JSON text;
a rule that parses it (`JSON_PARSE_STRING_FIELD`) leaves a structure that is serialised back to JSON text.

Guarantees:

- **The copy only.** Processors never change what reaches the provider or the client, and never block or slow
  the call: they run after the client has the whole answer.
- **A blocking stage withholds its own fields.** An `INPUT` stage that blocks (a `DENY`-style outcome, a policy
  check that fails) drops `input` and `system` from the captured copy; an `OUTPUT` stage that blocks drops
  `output`. When every captured field is dropped the log carries `contentWithheld: "PROCESSOR_BLOCKED"`. The
  processors' report travels on the event's `processing`, as for intents.
- **Never unprocessed.** When the global processors are needed and cannot be loaded, the content is withheld
  (`contentWithheld: "PROCESSORS_UNAVAILABLE"`) rather than sent without them; the content summary and the usage
  are still sent.
- **The cut comes last.** Each field is cut at `DCDR_CAPTURED_CONTENT_MAX_CHARS` (65 536 UTF-16 units) after the
  processors, and a cut field is listed in `content.truncated`.
- The content summary's hashes are computed on the captured text **before** processors, so the same prompt
  hashes the same with or without processors, and in telemetry.

## Frontend preview use cases

`IntentProcessingSemantics` is intentionally pure and side-effect free so frontend and tests can:

- sort processors deterministically by stage and order
- flatten processor rules for preview
- detect cache-safe vs cache-bypass rule sets
- build empty/baseline `ExecutionProcessingReport` objects
- validate processor composition before sending anything to runtime

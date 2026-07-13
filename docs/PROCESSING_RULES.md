# Processing Rules And Processors

This document describes the shared public contract surface for the DCDR intent-processing engine.

Scope:

- intent execution only
- not the OpenAI-compatible `/v1` gateway proxy
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
- `ConditionOp`
- `ConditionLogicOp`
- `ImplementationCondition`
- `LogicalImplementationCondition`

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

- `condition?: ImplementationCondition | LogicalImplementationCondition`

using the existing:

- `ConditionOp`
- `ConditionLogicOp`

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
    op: ConditionOp.CONTAINS,
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

## Frontend preview use cases

`IntentProcessingSemantics` is intentionally pure and side-effect free so frontend and tests can:

- sort processors deterministically by stage and order
- flatten processor rules for preview
- detect cache-safe vs cache-bypass rule sets
- build empty/baseline `ExecutionProcessingReport` objects
- validate processor composition before sending anything to runtime

import {
  ConditionLogicOp,
  ConditionOp,
  ImplementationCondition,
  LogicalImplementationCondition,
} from "./implementations.contract";
import { IntentProvider } from "./provider.contract";

export {
  ConditionLogicOp,
  ConditionOp,
  ImplementationCondition,
  LogicalImplementationCondition,
} from "./implementations.contract";

/**
 * Processing stage around the existing intent execution core.
 *
 * Notes
 * - `INPUT` runs before prompt rendering / provider execution.
 * - `OUTPUT` runs after provider execution and before the final response/report is finalized.
 */
export enum ProcessingStage {
  INPUT = "INPUT",
  OUTPUT = "OUTPUT",
}

/**
 * Atomic built-in processing rule kinds supported by the governed intent-processing engine.
 *
 * Notes
 * - Keep values stable because frontend preview/testing and runtime execution must share semantics.
 * - These are intentionally small primitives; product-facing processors are composed from them.
 */
export enum ProcessingRuleKind {
  TRIM = "TRIM",
  COLLAPSE_WHITESPACE = "COLLAPSE_WHITESPACE",
  NORMALIZE_NEW_LINES = "NORMALIZE_NEW_LINES",
  REMOVE_CONTROL_CHARS = "REMOVE_CONTROL_CHARS",
  TO_LOWERCASE = "TO_LOWERCASE",
  TO_UPPERCASE = "TO_UPPERCASE",
  REPLACE_LITERAL = "REPLACE_LITERAL",
  REPLACE_REGEX = "REPLACE_REGEX",
  PREFIX = "PREFIX",
  SUFFIX = "SUFFIX",
  SLICE = "SLICE",
  JSON_STRINGIFY = "JSON_STRINGIFY",
  JSON_PARSE_STRING_FIELD = "JSON_PARSE_STRING_FIELD",
  REMOVE_EMPTY_FIELDS = "REMOVE_EMPTY_FIELDS",
  COALESCE_NULLISH = "COALESCE_NULLISH",
  SET_DEFAULT_VALUE = "SET_DEFAULT_VALUE",
  MAP_ENUM_VALUE = "MAP_ENUM_VALUE",
  ALLOW_VALUE_SET = "ALLOW_VALUE_SET",
  DENY_VALUE_SET = "DENY_VALUE_SET",
  LENGTH_CHECK = "LENGTH_CHECK",
  REGEX_MATCH_CHECK = "REGEX_MATCH_CHECK",
  SECRET_DETECTION = "SECRET_DETECTION",
  PII_DETECTION = "PII_DETECTION",
  PII_REDACTION = "PII_REDACTION",
  HASH_VALUE = "HASH_VALUE",
  MASK_SUBSTRING = "MASK_SUBSTRING",
  PROVIDER_POLICY_CHECK = "PROVIDER_POLICY_CHECK",
  MODEL_POLICY_CHECK = "MODEL_POLICY_CHECK",
  OUTPUT_SCHEMA_VALIDATION = "OUTPUT_SCHEMA_VALIDATION",
  OUTPUT_POLICY_CHECK = "OUTPUT_POLICY_CHECK",
  REVIEW_ROUTING = "REVIEW_ROUTING",
}

/**
 * Presentation grouping for built-in atomic rule kinds.
 *
 * Notes
 * - This is metadata for UI discoverability and authoring ergonomics.
 * - Runtime behavior must still be keyed only by `ProcessingRuleKind`.
 */
export enum ProcessingRuleGroup {
  TEXT_TRANSFORM = "TEXT_TRANSFORM",
  VALUE_NORMALIZATION = "VALUE_NORMALIZATION",
  VALIDATION_POLICY = "VALIDATION_POLICY",
  SECURITY_PRIVACY = "SECURITY_PRIVACY",
}

/**
 * Logical target family a processing rule operates on.
 */
export enum ProcessingTargetKind {
  DATA_FIELD = "DATA_FIELD",
  FULL_PAYLOAD = "FULL_PAYLOAD",
  EXECUTION_CONTEXT = "EXECUTION_CONTEXT",
}

/**
 * Effective action taken by a processing rule.
 */
export enum ProcessingAction {
  NONE = "NONE",
  WARN = "WARN",
  BLOCK = "BLOCK",
  REDACT = "REDACT",
  REQUIRE_REVIEW = "REQUIRE_REVIEW",
  ANNOTATE = "ANNOTATE",
}

/**
 * Stable policy-oriented outcome classification for governance rules.
 *
 * Notes
 * - This is intentionally broader than a single trail action so frontend, backend, and
 *   reporting can reason about governance decisions without inferring semantics from free text.
 */
export enum ProcessingPolicyOutcome {
  ALLOW = "ALLOW",
  BLOCK = "BLOCK",
  REQUIRE_REVIEW = "REQUIRE_REVIEW",
  REDACT = "REDACT",
  WARN = "WARN",
}

/**
 * Stable reason codes for policy-oriented processing outcomes.
 *
 * Notes
 * - Keep these values wire-stable because they are intended for frontend previews,
 *   backend analytics, and bounded execution trail aggregation.
 * - Region-related reasons are contract-ready today, but runtime may only emit them when
 *   explicit region context is available.
 */
export enum ProcessingPolicyReasonCode {
  PROVIDER_ALLOWED = "PROVIDER_ALLOWED",
  PROVIDER_NOT_ALLOWED = "PROVIDER_NOT_ALLOWED",
  PROVIDER_CONTEXT_MISSING = "PROVIDER_CONTEXT_MISSING",
  PROVIDER_REGION_NOT_ALLOWED = "PROVIDER_REGION_NOT_ALLOWED",
  MODEL_ALLOWED = "MODEL_ALLOWED",
  MODEL_NOT_ALLOWED = "MODEL_NOT_ALLOWED",
  MODEL_CONTEXT_MISSING = "MODEL_CONTEXT_MISSING",
  REGION_ALLOWED = "REGION_ALLOWED",
  REGION_CONTEXT_MISSING = "REGION_CONTEXT_MISSING",
  OUTPUT_POLICY_FLAGGED = "OUTPUT_POLICY_FLAGGED",
  OUTPUT_POLICY_NO_MATCH = "OUTPUT_POLICY_NO_MATCH",
  REVIEW_QUEUE_REQUIRED = "REVIEW_QUEUE_REQUIRED",
  REVIEW_ROUTING_NO_MATCH = "REVIEW_ROUTING_NO_MATCH",
}

/**
 * Stable catalog of output-policy references exposed to frontend/runtime authoring.
 *
 * Notes
 * - These are DCDR-owned semantic policy identifiers, not backend-generated free text.
 * - Additional values can be added additively as product policy coverage expands.
 */
export enum ProcessingOutputPolicyRef {
  DEFAULT_OUTPUT_POLICY = "DEFAULT_OUTPUT_POLICY",
  MANUAL_REVIEW_POLICY = "MANUAL_REVIEW_POLICY",
  PII_OUTPUT_POLICY = "PII_OUTPUT_POLICY",
  SECRET_LEAKAGE_POLICY = "SECRET_LEAKAGE_POLICY",
}

/**
 * Stable catalog of review queues exposed to frontend/runtime authoring.
 *
 * Notes
 * - Keep these values stable because they are intended for UI selects,
 *   bounded execution trail projection, and backend aggregation.
 */
export enum ProcessingReviewQueue {
  HUMAN_COMPLIANCE = "HUMAN_COMPLIANCE",
  SECURITY_REVIEW = "SECURITY_REVIEW",
  OUTPUT_QA = "OUTPUT_QA",
  MANUAL_REVIEW = "MANUAL_REVIEW",
}

/**
 * Failure behavior when a rule handler itself errors.
 */
export enum ProcessingFailureMode {
  FAIL_CLOSED = "FAIL_CLOSED",
  FAIL_OPEN = "FAIL_OPEN",
  WARN_ONLY = "WARN_ONLY",
}

/**
 * Trail/evidence entry family recorded for one processing rule execution.
 */
export enum ProcessingEvidenceKind {
  RULE_MATCHED = "RULE_MATCHED",
  RULE_MUTATED = "RULE_MUTATED",
  RULE_BLOCKED = "RULE_BLOCKED",
  RULE_WARNED = "RULE_WARNED",
  RULE_FAILED = "RULE_FAILED",
  RULE_REVIEW_REQUIRED = "RULE_REVIEW_REQUIRED",
}

/**
 * Declares where a processor originated in the effective execution pipeline.
 */
export enum ProcessingScope {
  GLOBAL = "GLOBAL",
  INTENT = "INTENT",
}

/**
 * Declares whether a rule can be executed exactly outside the runtime.
 */
export enum ProcessingRuntimeMode {
  PURE = "PURE",
  RUNTIME_REQUIRED = "RUNTIME_REQUIRED",
  PREVIEW_APPROXIMABLE = "PREVIEW_APPROXIMABLE",
}

/**
 * Cache/hashing posture for one rule.
 */
export enum ProcessingCacheBehavior {
  CACHE_SAFE = "CACHE_SAFE",
  CACHE_UNSAFE = "CACHE_UNSAFE",
  CACHE_BYPASS_REQUIRED = "CACHE_BYPASS_REQUIRED",
}

/**
 * UI/runtime-facing configuration field types for rule-specific parameters.
 */
export enum ProcessingRuleConfigValueType {
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  ENUM = "ENUM",
  STRING_LIST = "STRING_LIST",
  NUMBER_LIST = "NUMBER_LIST",
  BOOLEAN_LIST = "BOOLEAN_LIST",
}

/**
 * Explicit regex flags available to the built-in `REPLACE_REGEX` atomic rule.
 */
export enum ProcessingRegexFlag {
  GLOBAL = "GLOBAL",
  CASE_INSENSITIVE = "CASE_INSENSITIVE",
  MULTILINE = "MULTILINE",
  DOT_ALL = "DOT_ALL",
  UNICODE = "UNICODE",
}

/**
 * Declarative definition for one rule-specific configuration field.
 */
export interface ProcessingRuleConfigFieldDefinition {
  key: string;
  label?: string;
  description?: string;
  type: ProcessingRuleConfigValueType;
  required?: boolean;
  defaultValue?:
    | string
    | number
    | boolean
    | null
    | string[]
    | number[]
    | boolean[];
  enumValues?: string[];
  min?: number;
  max?: number;
}

/**
 * Shared static schema definition for one built-in atomic rule kind.
 */
export interface ProcessingRuleSchemaDefinition {
  kind: ProcessingRuleKind;
  group: ProcessingRuleGroup;
  label?: string;
  description?: string;
  allowedStages: ProcessingStage[];
  supportsFieldPaths: boolean;
  supportsStopOnMatch: boolean;
  defaultFailureMode?: ProcessingFailureMode;
  defaultCacheBehavior?: ProcessingCacheBehavior;
  configurationFields: ProcessingRuleConfigFieldDefinition[];
}

/**
 * Named configuration map for one configured processing rule instance.
 */
export interface ProcessingRuleConfigurationMap {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | string[]
    | number[]
    | boolean[];
}

/**
 * Stable validation issue codes for configured processing rules/processors.
 */
export enum ProcessingValidationIssueCode {
  RULE_KIND_UNSUPPORTED = "RULE_KIND_UNSUPPORTED",
  RULE_STAGE_NOT_ALLOWED = "RULE_STAGE_NOT_ALLOWED",
  FIELD_PATHS_NOT_SUPPORTED = "FIELD_PATHS_NOT_SUPPORTED",
  STOP_ON_MATCH_NOT_SUPPORTED = "STOP_ON_MATCH_NOT_SUPPORTED",
  CONDITION_INVALID = "CONDITION_INVALID",
  CONFIG_KEY_UNKNOWN = "CONFIG_KEY_UNKNOWN",
  CONFIG_REQUIRED_MISSING = "CONFIG_REQUIRED_MISSING",
  CONFIG_TYPE_INVALID = "CONFIG_TYPE_INVALID",
  CONFIG_ENUM_INVALID = "CONFIG_ENUM_INVALID",
  CONFIG_MIN_INVALID = "CONFIG_MIN_INVALID",
  CONFIG_MAX_INVALID = "CONFIG_MAX_INVALID",
  PROCESSOR_RULES_REQUIRED = "PROCESSOR_RULES_REQUIRED",
}

/**
 * One validation issue found while checking a configured processing rule/processor.
 */
export interface ProcessingValidationIssue {
  path: string;
  code: ProcessingValidationIssueCode;
  message: string;
}

/**
 * Pure validation result for a configured processing rule/processor.
 */
export interface ProcessingValidationResult {
  valid: boolean;
  issues: ProcessingValidationIssue[];
}

interface ProcessingConditionValidationState {
  depth: number;
  nodesSeen: number;
}

/**
 * Declarative atomic rule definition shared by runtime and frontend preview tooling.
 */
export interface ProcessingRuleDefinition {
  id: string;
  name?: string;
  enabled?: boolean;
  kind: ProcessingRuleKind;
  /**
   * Optional shared condition tree that decides whether this rule should run.
   *
   * Notes
   * - Reuses the same condition contract as conditioned routing so frontend authoring
   *   and preview tooling can share one UI model.
   * - The processing engine evaluates this condition against the selected rule scope.
   */
  condition?: ImplementationCondition | LogicalImplementationCondition;
  targetKind?: ProcessingTargetKind;
  failureMode?: ProcessingFailureMode;
  runtimeMode?: ProcessingRuntimeMode;
  cacheBehavior?: ProcessingCacheBehavior;
  stopOnMatch?: boolean;
  fieldPaths?: string[];
  configuration?: ProcessingRuleConfigurationMap;
}

/**
 * Declarative processing processor shared by runtime and frontend preview tooling.
 *
 * Notes
 * - A processor is the product-facing unit attached to registry/intents.
 * - A processor is versioned and contains an ordered sequence of atomic rules.
 */
export interface ProcessingProcessor {
  id: string;
  version: string;
  name?: string;
  enabled?: boolean;
  stage: ProcessingStage;
  order?: number;
  rules: ProcessingRuleDefinition[];
}

/**
 * One bounded evidence/mutation trail entry.
 */
export interface ProcessingTrailEntry {
  sequence: number;
  stage: ProcessingStage;
  scope: ProcessingScope;
  processorId: string;
  processorVersion: string;
  ruleId: string;
  ruleKind: ProcessingRuleKind;
  evidenceKind: ProcessingEvidenceKind;
  action: ProcessingAction;
  targetKind?: ProcessingTargetKind;
  matched: boolean;
  changed: boolean;
  policyOutcome?: ProcessingPolicyOutcome;
  policyReasonCode?: ProcessingPolicyReasonCode;
  fieldPath?: string;
  reasonCode?: string;
  reason?: string;
  beforeHash?: string;
  afterHash?: string;
  safePreviewBefore?: string;
  safePreviewAfter?: string;
}

/**
 * Summary for one processing stage.
 */
export interface ProcessingStageSummary {
  stage: ProcessingStage;
  processorsConfigured: number;
  processorsRun: number;
  rulesConfigured: number;
  rulesRun: number;
  rulesMatched: number;
  rulesApplied: number;
  mutations: number;
  mutated: boolean;
  blocked: boolean;
  reviewRequired: boolean;
  cacheSafe: boolean;
  cacheBypassRequired: boolean;
}

/**
 * Bounded processing report projected into execution reports and logs.
 */
export interface ExecutionProcessingReport {
  engineVersion: string;
  mutated: boolean;
  blocked: boolean;
  reviewRequired: boolean;
  input: ProcessingStageSummary;
  output: ProcessingStageSummary;
  trail?: ProcessingTrailEntry[];
}

/**
 * Static catalog of built-in atomic rule schemas shared across runtime and UI.
 */
export const PROCESSING_RULE_SCHEMAS: ProcessingRuleSchemaDefinition[] = [
  {
    kind: ProcessingRuleKind.TRIM,
    group: ProcessingRuleGroup.TEXT_TRANSFORM,
    label: "Trim",
    description: "Remove leading and trailing whitespace.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_OPEN,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [],
  },
  {
    kind: ProcessingRuleKind.COLLAPSE_WHITESPACE,
    group: ProcessingRuleGroup.TEXT_TRANSFORM,
    label: "Collapse whitespace",
    description: "Collapse repeated spaces and tabs into a single space.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_OPEN,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [],
  },
  {
    kind: ProcessingRuleKind.NORMALIZE_NEW_LINES,
    group: ProcessingRuleGroup.TEXT_TRANSFORM,
    label: "Normalize new lines",
    description: "Convert CRLF and CR newlines into LF.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_OPEN,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [],
  },
  {
    kind: ProcessingRuleKind.REMOVE_CONTROL_CHARS,
    group: ProcessingRuleGroup.TEXT_TRANSFORM,
    label: "Remove control chars",
    description: "Remove non-printable control characters from target strings.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_OPEN,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [],
  },
  {
    kind: ProcessingRuleKind.TO_LOWERCASE,
    group: ProcessingRuleGroup.TEXT_TRANSFORM,
    label: "To lowercase",
    description: "Convert target strings to lowercase.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_OPEN,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [],
  },
  {
    kind: ProcessingRuleKind.TO_UPPERCASE,
    group: ProcessingRuleGroup.TEXT_TRANSFORM,
    label: "To uppercase",
    description: "Convert target strings to uppercase.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_OPEN,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [],
  },
  {
    kind: ProcessingRuleKind.REPLACE_LITERAL,
    group: ProcessingRuleGroup.TEXT_TRANSFORM,
    label: "Replace literal",
    description: "Replace one exact string literal with another.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "search",
        label: "Search",
        type: ProcessingRuleConfigValueType.STRING,
        required: true,
      },
      {
        key: "replacement",
        label: "Replacement",
        type: ProcessingRuleConfigValueType.STRING,
        required: true,
      },
      {
        key: "replaceAll",
        label: "Replace all",
        type: ProcessingRuleConfigValueType.BOOLEAN,
        defaultValue: true,
      },
      {
        key: "caseSensitive",
        label: "Case sensitive",
        type: ProcessingRuleConfigValueType.BOOLEAN,
        defaultValue: true,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.REPLACE_REGEX,
    group: ProcessingRuleGroup.TEXT_TRANSFORM,
    label: "Replace regex",
    description: "Apply a regex replacement over target strings.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "pattern",
        label: "Pattern",
        type: ProcessingRuleConfigValueType.STRING,
        required: true,
      },
      {
        key: "replacement",
        label: "Replacement",
        type: ProcessingRuleConfigValueType.STRING,
        required: true,
      },
      {
        key: "flags",
        label: "Flags",
        description:
          "Optional regex flags as an explicit list of named behaviors.",
        type: ProcessingRuleConfigValueType.STRING_LIST,
        enumValues: Object.values(ProcessingRegexFlag),
      },
    ],
  },
  {
    kind: ProcessingRuleKind.PREFIX,
    group: ProcessingRuleGroup.TEXT_TRANSFORM,
    label: "Prefix",
    description: "Prepend a fixed string to target strings.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_OPEN,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "value",
        label: "Value",
        type: ProcessingRuleConfigValueType.STRING,
        required: true,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.SUFFIX,
    group: ProcessingRuleGroup.TEXT_TRANSFORM,
    label: "Suffix",
    description: "Append a fixed string to target strings.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_OPEN,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "value",
        label: "Value",
        type: ProcessingRuleConfigValueType.STRING,
        required: true,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.SLICE,
    group: ProcessingRuleGroup.TEXT_TRANSFORM,
    label: "Slice",
    description: "Slice target strings by start/end indices.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "start",
        label: "Start",
        type: ProcessingRuleConfigValueType.NUMBER,
        required: true,
      },
      {
        key: "end",
        label: "End",
        type: ProcessingRuleConfigValueType.NUMBER,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.JSON_STRINGIFY,
    group: ProcessingRuleGroup.VALUE_NORMALIZATION,
    label: "JSON stringify",
    description: "Serialize the target value into a JSON string.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [],
  },
  {
    kind: ProcessingRuleKind.JSON_PARSE_STRING_FIELD,
    group: ProcessingRuleGroup.VALUE_NORMALIZATION,
    label: "JSON parse string field",
    description: "Parse a JSON string field into a structured value.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [],
  },
  {
    kind: ProcessingRuleKind.REMOVE_EMPTY_FIELDS,
    group: ProcessingRuleGroup.VALUE_NORMALIZATION,
    label: "Remove empty fields",
    description:
      "Remove empty/nullish fields from objects and arrays according to configuration.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_OPEN,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "removeNull",
        label: "Remove null",
        type: ProcessingRuleConfigValueType.BOOLEAN,
        defaultValue: true,
      },
      {
        key: "removeUndefined",
        label: "Remove undefined",
        type: ProcessingRuleConfigValueType.BOOLEAN,
        defaultValue: true,
      },
      {
        key: "removeEmptyString",
        label: "Remove empty string",
        type: ProcessingRuleConfigValueType.BOOLEAN,
        defaultValue: false,
      },
      {
        key: "removeEmptyArray",
        label: "Remove empty array",
        type: ProcessingRuleConfigValueType.BOOLEAN,
        defaultValue: false,
      },
      {
        key: "removeEmptyObject",
        label: "Remove empty object",
        type: ProcessingRuleConfigValueType.BOOLEAN,
        defaultValue: false,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.COALESCE_NULLISH,
    group: ProcessingRuleGroup.VALUE_NORMALIZATION,
    label: "Coalesce nullish",
    description: "Replace nullish values with a configured default value.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_OPEN,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "fallbackValue",
        label: "Fallback value",
        type: ProcessingRuleConfigValueType.STRING,
        required: true,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.SET_DEFAULT_VALUE,
    group: ProcessingRuleGroup.VALUE_NORMALIZATION,
    label: "Set default value",
    description: "Set a default value when the target field is absent.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_OPEN,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "defaultValue",
        label: "Default value",
        type: ProcessingRuleConfigValueType.STRING,
        required: true,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.MAP_ENUM_VALUE,
    group: ProcessingRuleGroup.VALUE_NORMALIZATION,
    label: "Map enum value",
    description: "Map one allowed input value to another canonical value.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "from",
        label: "From",
        type: ProcessingRuleConfigValueType.STRING,
        required: true,
      },
      {
        key: "to",
        label: "To",
        type: ProcessingRuleConfigValueType.STRING,
        required: true,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.ALLOW_VALUE_SET,
    group: ProcessingRuleGroup.VALIDATION_POLICY,
    label: "Allow value set",
    description: "Allow only configured values; everything else is a policy miss.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: true,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "values",
        label: "Values",
        type: ProcessingRuleConfigValueType.STRING_LIST,
        required: true,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.DENY_VALUE_SET,
    group: ProcessingRuleGroup.VALIDATION_POLICY,
    label: "Deny value set",
    description: "Block or warn when the target value matches a denied set.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: true,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "values",
        label: "Values",
        type: ProcessingRuleConfigValueType.STRING_LIST,
        required: true,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.LENGTH_CHECK,
    group: ProcessingRuleGroup.VALIDATION_POLICY,
    label: "Length check",
    description: "Validate the target string length against optional min/max bounds.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: true,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "minLength",
        label: "Min length",
        type: ProcessingRuleConfigValueType.NUMBER,
        min: 0,
      },
      {
        key: "maxLength",
        label: "Max length",
        type: ProcessingRuleConfigValueType.NUMBER,
        min: 0,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.REGEX_MATCH_CHECK,
    group: ProcessingRuleGroup.VALIDATION_POLICY,
    label: "Regex match check",
    description: "Require or forbid a regex match without mutating the value.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: true,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "pattern",
        label: "Pattern",
        type: ProcessingRuleConfigValueType.STRING,
        required: true,
      },
      {
        key: "mustMatch",
        label: "Must match",
        type: ProcessingRuleConfigValueType.BOOLEAN,
        defaultValue: true,
      },
      {
        key: "flags",
        label: "Flags",
        type: ProcessingRuleConfigValueType.STRING_LIST,
        enumValues: Object.values(ProcessingRegexFlag),
      },
    ],
  },
  {
    kind: ProcessingRuleKind.SECRET_DETECTION,
    group: ProcessingRuleGroup.SECURITY_PRIVACY,
    label: "Secret detection",
    description: "Detect likely credentials or secrets in target fields.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: true,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_BYPASS_REQUIRED,
    configurationFields: [
      {
        key: "matchMode",
        label: "Match mode",
        type: ProcessingRuleConfigValueType.ENUM,
        enumValues: ["WARN", "BLOCK", "REDACT"],
        defaultValue: "WARN",
      },
    ],
  },
  {
    kind: ProcessingRuleKind.PII_DETECTION,
    group: ProcessingRuleGroup.SECURITY_PRIVACY,
    label: "PII detection",
    description: "Detect likely personally identifiable information patterns.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: true,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_BYPASS_REQUIRED,
    configurationFields: [
      {
        key: "entityTypes",
        label: "Entity types",
        type: ProcessingRuleConfigValueType.STRING_LIST,
      },
      {
        key: "matchMode",
        label: "Match mode",
        type: ProcessingRuleConfigValueType.ENUM,
        enumValues: ["WARN", "BLOCK", "REQUIRE_REVIEW"],
        defaultValue: "WARN",
      },
    ],
  },
  {
    kind: ProcessingRuleKind.PII_REDACTION,
    group: ProcessingRuleGroup.SECURITY_PRIVACY,
    label: "PII redaction",
    description: "Redact likely personally identifiable information deterministically.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_BYPASS_REQUIRED,
    configurationFields: [
      {
        key: "replacement",
        label: "Replacement",
        type: ProcessingRuleConfigValueType.STRING,
        defaultValue: "[REDACTED]",
      },
      {
        key: "entityTypes",
        label: "Entity types",
        type: ProcessingRuleConfigValueType.STRING_LIST,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.HASH_VALUE,
    group: ProcessingRuleGroup.SECURITY_PRIVACY,
    label: "Hash value",
    description: "Replace a value with a deterministic hash for safe traceability.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_BYPASS_REQUIRED,
    configurationFields: [
      {
        key: "algorithm",
        label: "Algorithm",
        type: ProcessingRuleConfigValueType.ENUM,
        enumValues: ["SHA256"],
        defaultValue: "SHA256",
      },
      {
        key: "saltRef",
        label: "Salt ref",
        type: ProcessingRuleConfigValueType.STRING,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.MASK_SUBSTRING,
    group: ProcessingRuleGroup.SECURITY_PRIVACY,
    label: "Mask substring",
    description: "Mask part of a string while preserving surrounding context.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: false,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_BYPASS_REQUIRED,
    configurationFields: [
      {
        key: "start",
        label: "Start",
        type: ProcessingRuleConfigValueType.NUMBER,
        required: true,
      },
      {
        key: "end",
        label: "End",
        type: ProcessingRuleConfigValueType.NUMBER,
        required: true,
      },
      {
        key: "maskChar",
        label: "Mask char",
        type: ProcessingRuleConfigValueType.STRING,
        defaultValue: "*",
      },
    ],
  },
  {
    kind: ProcessingRuleKind.PROVIDER_POLICY_CHECK,
    group: ProcessingRuleGroup.VALIDATION_POLICY,
    label: "Provider policy check",
    description: "Validate the resolved provider against a configured allow/deny policy.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: false,
    supportsStopOnMatch: true,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "allowedProviders",
        label: "Allowed providers",
        type: ProcessingRuleConfigValueType.STRING_LIST,
        enumValues: Object.values(IntentProvider),
      },
      {
        key: "deniedProviders",
        label: "Denied providers",
        type: ProcessingRuleConfigValueType.STRING_LIST,
        enumValues: Object.values(IntentProvider),
      },
      {
        key: "allowedRegions",
        label: "Allowed regions",
        description:
          "Optional future-facing region allowlist. Runtime only enforces this when explicit region context is available.",
        type: ProcessingRuleConfigValueType.STRING_LIST,
      },
      {
        key: "deniedRegions",
        label: "Denied regions",
        description:
          "Optional future-facing region denylist. Runtime only enforces this when explicit region context is available.",
        type: ProcessingRuleConfigValueType.STRING_LIST,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.MODEL_POLICY_CHECK,
    group: ProcessingRuleGroup.VALIDATION_POLICY,
    label: "Model policy check",
    description: "Validate the resolved model or family against a configured policy.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: false,
    supportsStopOnMatch: true,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "allowedModels",
        label: "Allowed models",
        type: ProcessingRuleConfigValueType.STRING_LIST,
      },
      {
        key: "deniedModels",
        label: "Denied models",
        type: ProcessingRuleConfigValueType.STRING_LIST,
      },
      {
        key: "allowedRegions",
        label: "Allowed regions",
        description:
          "Optional future-facing region allowlist. Runtime only enforces this when explicit region context is available.",
        type: ProcessingRuleConfigValueType.STRING_LIST,
      },
      {
        key: "deniedRegions",
        label: "Denied regions",
        description:
          "Optional future-facing region denylist. Runtime only enforces this when explicit region context is available.",
        type: ProcessingRuleConfigValueType.STRING_LIST,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.OUTPUT_SCHEMA_VALIDATION,
    group: ProcessingRuleGroup.VALIDATION_POLICY,
    label: "Output schema validation",
    description: "Validate the final output structure against a configured schema contract.",
    allowedStages: [ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: true,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "schemaRef",
        label: "Schema ref",
        type: ProcessingRuleConfigValueType.STRING,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.OUTPUT_POLICY_CHECK,
    group: ProcessingRuleGroup.VALIDATION_POLICY,
    label: "Output policy check",
    description: "Run output-only policy validation rules without mutating payloads.",
    allowedStages: [ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: true,
    defaultFailureMode: ProcessingFailureMode.FAIL_CLOSED,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "policyRef",
        label: "Policy ref",
        type: ProcessingRuleConfigValueType.ENUM,
        enumValues: Object.values(ProcessingOutputPolicyRef),
        defaultValue: ProcessingOutputPolicyRef.DEFAULT_OUTPUT_POLICY,
      },
    ],
  },
  {
    kind: ProcessingRuleKind.REVIEW_ROUTING,
    group: ProcessingRuleGroup.VALIDATION_POLICY,
    label: "Review routing",
    description: "Mark the execution for review routing when a configured condition is met.",
    allowedStages: [ProcessingStage.INPUT, ProcessingStage.OUTPUT],
    supportsFieldPaths: true,
    supportsStopOnMatch: true,
    defaultFailureMode: ProcessingFailureMode.FAIL_OPEN,
    defaultCacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
    configurationFields: [
      {
        key: "queue",
        label: "Queue",
        type: ProcessingRuleConfigValueType.ENUM,
        enumValues: Object.values(ProcessingReviewQueue),
        defaultValue: ProcessingReviewQueue.MANUAL_REVIEW,
      },
      {
        key: "reasonCode",
        label: "Reason code",
        type: ProcessingRuleConfigValueType.STRING,
      },
    ],
  },
];

/**
 * Returns true when the provided value is a string array.
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Returns true when the provided value is a number array.
 */
function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

/**
 * Returns true when the provided value is a boolean array.
 */
function isBooleanArray(value: unknown): value is boolean[] {
  return Array.isArray(value) && value.every((item) => typeof item === "boolean");
}

/**
 * Returns true when the provided value is a primitive parameter supported by the shared condition DSL.
 */
function isConditionParameterValue(
  value: unknown,
): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Returns true when the provided condition object is a logical condition node.
 */
function isProcessingLogicalCondition(
  condition: ImplementationCondition | LogicalImplementationCondition,
): condition is LogicalImplementationCondition {
  return (
    condition.op === ConditionLogicOp.NOT ||
    condition.op === ConditionLogicOp.AND ||
    condition.op === ConditionLogicOp.OR
  );
}

/**
 * Validates one shared condition tree used by processing rules.
 */
function validateProcessingConditionInternal(args: {
  condition: ImplementationCondition | LogicalImplementationCondition;
  path: string;
  state: ProcessingConditionValidationState;
  issues: ProcessingValidationIssue[];
}): void {
  args.state.nodesSeen += 1;
  if (args.state.nodesSeen > 250) {
    args.issues.push({
      path: args.path,
      code: ProcessingValidationIssueCode.CONDITION_INVALID,
      message: "Condition tree exceeds the maximum supported node count (250).",
    });
    return;
  }

  if (isProcessingLogicalCondition(args.condition)) {
    args.state.depth += 1;
    if (args.state.depth > 20) {
      args.issues.push({
        path: args.path,
        code: ProcessingValidationIssueCode.CONDITION_INVALID,
        message: "Condition tree exceeds the maximum supported depth (20).",
      });
      args.state.depth -= 1;
      return;
    }

    if (!Array.isArray(args.condition.conditions)) {
      args.issues.push({
        path: `${args.path}.conditions`,
        code: ProcessingValidationIssueCode.CONDITION_INVALID,
        message: "Logical condition must include conditions[].",
      });
      args.state.depth -= 1;
      return;
    }

    if (
      args.condition.op === ConditionLogicOp.NOT &&
      args.condition.conditions.length !== 1
    ) {
      args.issues.push({
        path: `${args.path}.conditions`,
        code: ProcessingValidationIssueCode.CONDITION_INVALID,
        message: "NOT condition must include exactly 1 child condition.",
      });
      args.state.depth -= 1;
      return;
    }

    if (
      (args.condition.op === ConditionLogicOp.AND ||
        args.condition.op === ConditionLogicOp.OR) &&
      args.condition.conditions.length < 1
    ) {
      args.issues.push({
        path: `${args.path}.conditions`,
        code: ProcessingValidationIssueCode.CONDITION_INVALID,
        message: `${args.condition.op} condition must include at least 1 child condition.`,
      });
      args.state.depth -= 1;
      return;
    }

    for (let i = 0; i < args.condition.conditions.length; i++) {
      validateProcessingConditionInternal({
        condition: args.condition.conditions[i],
        path: `${args.path}.conditions[${i}]`,
        state: args.state,
        issues: args.issues,
      });
    }

    args.state.depth -= 1;
    return;
  }

  const path = String(args.condition.path ?? "").trim();
  if (!path) {
    args.issues.push({
      path: `${args.path}.path`,
      code: ProcessingValidationIssueCode.CONDITION_INVALID,
      message: "Leaf condition is missing path.",
    });
  }

  if (!(Object.values(ConditionOp) as string[]).includes(args.condition.op)) {
    args.issues.push({
      path: `${args.path}.op`,
      code: ProcessingValidationIssueCode.CONDITION_INVALID,
      message: `Unsupported condition op '${String(args.condition.op)}'.`,
    });
  }

  if (
    typeof args.condition.value1 !== "undefined" &&
    !isConditionParameterValue(args.condition.value1)
  ) {
    args.issues.push({
      path: `${args.path}.value1`,
      code: ProcessingValidationIssueCode.CONDITION_INVALID,
      message: "Condition value1 must be string|number|boolean|null.",
    });
  }

  if (
    typeof args.condition.value2 !== "undefined" &&
    !isConditionParameterValue(args.condition.value2)
  ) {
    args.issues.push({
      path: `${args.path}.value2`,
      code: ProcessingValidationIssueCode.CONDITION_INVALID,
      message: "Condition value2 must be string|number|boolean|null.",
    });
  }

  if (
    typeof args.condition.caseInsensitive !== "undefined" &&
    typeof args.condition.caseInsensitive !== "boolean"
  ) {
    args.issues.push({
      path: `${args.path}.caseInsensitive`,
      code: ProcessingValidationIssueCode.CONDITION_INVALID,
      message: "Condition caseInsensitive must be boolean.",
    });
  }

  if (
    typeof args.condition.trim !== "undefined" &&
    typeof args.condition.trim !== "boolean"
  ) {
    args.issues.push({
      path: `${args.path}.trim`,
      code: ProcessingValidationIssueCode.CONDITION_INVALID,
      message: "Condition trim must be boolean.",
    });
  }
}

/**
 * Clones a supported rule configuration value so helpers stay side-effect free.
 */
function cloneProcessingRuleConfigValue<
  T extends
    | string
    | number
    | boolean
    | null
    | string[]
    | number[]
    | boolean[],
>(value: T): T {
  return (Array.isArray(value) ? [...value] : value) as T;
}

/**
 * Returns true when the provided value matches the declared config field type.
 */
function isConfigurationValueValidForField(
  field: ProcessingRuleConfigFieldDefinition,
  value: unknown,
): boolean {
  switch (field.type) {
    case ProcessingRuleConfigValueType.STRING:
      return typeof value === "string";
    case ProcessingRuleConfigValueType.NUMBER:
      return typeof value === "number";
    case ProcessingRuleConfigValueType.BOOLEAN:
      return typeof value === "boolean";
    case ProcessingRuleConfigValueType.ENUM:
      return (
        typeof value === "string" &&
        Array.isArray(field.enumValues) &&
        field.enumValues.includes(value)
      );
    case ProcessingRuleConfigValueType.STRING_LIST:
      return (
        isStringArray(value) &&
        (!Array.isArray(field.enumValues) ||
          value.every((item) => field.enumValues?.includes(item)))
      );
    case ProcessingRuleConfigValueType.NUMBER_LIST:
      return isNumberArray(value);
    case ProcessingRuleConfigValueType.BOOLEAN_LIST:
      return isBooleanArray(value);
    default:
      return false;
  }
}

/**
 * Returns true when the field default value is compatible with the declared config field type.
 */
function isDefaultValueValidForField(
  field: ProcessingRuleConfigFieldDefinition,
): boolean {
  if (typeof field.defaultValue === "undefined") return true;
  return isConfigurationValueValidForField(field, field.defaultValue);
}

/**
 * Shared pure helpers for intent-processing processor definitions and report scaffolding.
 */
export class IntentProcessingSemantics {
  /** Stable engine version identifier for the initial contracts/runtime slice. */
  static readonly ENGINE_VERSION_V1 = "1";

  /**
   * Returns the shared static schema definition for one built-in rule kind.
   */
  static getRuleSchema(
    kind: ProcessingRuleKind,
  ): ProcessingRuleSchemaDefinition | null {
    return PROCESSING_RULE_SCHEMAS.find((schema) => schema.kind === kind) ?? null;
  }

  /**
   * Returns true when the given stage is allowed for the provided rule kind.
   */
  static isStageAllowedForRuleKind(
    kind: ProcessingRuleKind,
    stage: ProcessingStage,
  ): boolean {
    const schema = IntentProcessingSemantics.getRuleSchema(kind);
    if (!schema) return false;
    return schema.allowedStages.includes(stage);
  }

  /**
   * Builds a configuration map with schema defaults applied first and caller overrides layered on top.
   */
  static buildRuleConfigurationWithDefaults(
    kind: ProcessingRuleKind,
    configuration?: ProcessingRuleConfigurationMap | null,
  ): ProcessingRuleConfigurationMap {
    const schema = IntentProcessingSemantics.getRuleSchema(kind);
    const result: ProcessingRuleConfigurationMap = {};

    for (const field of schema?.configurationFields ?? []) {
      if (
        typeof field.defaultValue !== "undefined" &&
        isDefaultValueValidForField(field)
      ) {
        result[field.key] = cloneProcessingRuleConfigValue(field.defaultValue);
      }
    }

    for (const [key, value] of Object.entries(configuration ?? {})) {
      const field = schema?.configurationFields.find(
        (candidate) => candidate.key === key,
      );
      if (!field) continue;
      if (!isConfigurationValueValidForField(field, value)) continue;
      result[key] = cloneProcessingRuleConfigValue(value);
    }

    return result;
  }

  /**
   * Validates one configured atomic rule instance against the shared static schema catalog.
   */
  static validateRuleDefinition(
    rule: ProcessingRuleDefinition,
    stage: ProcessingStage,
  ): ProcessingValidationResult {
    const issues: ProcessingValidationIssue[] = [];
    const schema = IntentProcessingSemantics.getRuleSchema(rule.kind);

    if (!schema) {
      issues.push({
        path: "kind",
        code: ProcessingValidationIssueCode.RULE_KIND_UNSUPPORTED,
        message: `Unsupported processing rule kind '${rule.kind}'.`,
      });
      return { valid: false, issues };
    }

    if (!schema.allowedStages.includes(stage)) {
      issues.push({
        path: "kind",
        code: ProcessingValidationIssueCode.RULE_STAGE_NOT_ALLOWED,
        message: `Rule kind '${rule.kind}' is not allowed in stage '${stage}'.`,
      });
    }

    if (!schema.supportsFieldPaths && (rule.fieldPaths?.length ?? 0) > 0) {
      issues.push({
        path: "fieldPaths",
        code: ProcessingValidationIssueCode.FIELD_PATHS_NOT_SUPPORTED,
        message: `Rule kind '${rule.kind}' does not support fieldPaths.`,
      });
    }

    if (!schema.supportsStopOnMatch && rule.stopOnMatch === true) {
      issues.push({
        path: "stopOnMatch",
        code: ProcessingValidationIssueCode.STOP_ON_MATCH_NOT_SUPPORTED,
        message: `Rule kind '${rule.kind}' does not support stopOnMatch=true.`,
      });
    }

    if (rule.condition) {
      const conditionIssues: ProcessingValidationIssue[] = [];
      validateProcessingConditionInternal({
        condition: rule.condition,
        path: "condition",
        state: { depth: 0, nodesSeen: 0 },
        issues: conditionIssues,
      });
      issues.push(...conditionIssues);
    }

    const providedConfiguration = rule.configuration ?? {};
    const schemaFieldsByKey = new Map(
      schema.configurationFields.map((field) => [field.key, field]),
    );

    for (const [key, value] of Object.entries(providedConfiguration)) {
      const field = schemaFieldsByKey.get(key);
      if (!field) {
        issues.push({
          path: `configuration.${key}`,
          code: ProcessingValidationIssueCode.CONFIG_KEY_UNKNOWN,
          message: `Unknown configuration key '${key}' for rule kind '${rule.kind}'.`,
        });
        continue;
      }

      if (!isConfigurationValueValidForField(field, value)) {
        const isEnumDrivenField =
          field.type === ProcessingRuleConfigValueType.ENUM ||
          ((field.type === ProcessingRuleConfigValueType.STRING_LIST ||
            field.type === ProcessingRuleConfigValueType.NUMBER_LIST ||
            field.type === ProcessingRuleConfigValueType.BOOLEAN_LIST) &&
            Array.isArray(field.enumValues) &&
            field.enumValues.length > 0);
        issues.push({
          path: `configuration.${key}`,
          code:
            isEnumDrivenField
              ? ProcessingValidationIssueCode.CONFIG_ENUM_INVALID
              : ProcessingValidationIssueCode.CONFIG_TYPE_INVALID,
          message:
            isEnumDrivenField
              ? `Configuration key '${key}' must be one of: ${(field.enumValues ?? []).join(", ")}.`
              : `Configuration key '${key}' must match type '${field.type}'.`,
        });
        continue;
      }

      if (field.type === ProcessingRuleConfigValueType.NUMBER) {
        const numericValue = value as number;
        if (typeof field.min === "number" && numericValue < field.min) {
          issues.push({
            path: `configuration.${key}`,
            code: ProcessingValidationIssueCode.CONFIG_MIN_INVALID,
            message: `Configuration key '${key}' must be >= ${field.min}.`,
          });
        }
        if (typeof field.max === "number" && numericValue > field.max) {
          issues.push({
            path: `configuration.${key}`,
            code: ProcessingValidationIssueCode.CONFIG_MAX_INVALID,
            message: `Configuration key '${key}' must be <= ${field.max}.`,
          });
        }
      }
    }

    for (const field of schema.configurationFields) {
      if (
        field.required === true &&
        typeof providedConfiguration[field.key] === "undefined" &&
        typeof field.defaultValue === "undefined"
      ) {
        issues.push({
          path: `configuration.${field.key}`,
          code: ProcessingValidationIssueCode.CONFIG_REQUIRED_MISSING,
          message: `Missing required configuration key '${field.key}'.`,
        });
      }
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Validates one shared condition tree reused by processing rules.
   */
  static validateConditionDefinition(
    condition: ImplementationCondition | LogicalImplementationCondition,
  ): ProcessingValidationResult {
    const issues: ProcessingValidationIssue[] = [];
    validateProcessingConditionInternal({
      condition,
      path: "condition",
      state: { depth: 0, nodesSeen: 0 },
      issues,
    });
    return { valid: issues.length === 0, issues };
  }

  /**
   * Validates one configured processor instance and all of its rules.
   */
  static validateProcessorDefinition(
    processor: ProcessingProcessor,
  ): ProcessingValidationResult {
    const issues: ProcessingValidationIssue[] = [];

    if (!Array.isArray(processor.rules) || processor.rules.length < 1) {
      issues.push({
        path: "rules",
        code: ProcessingValidationIssueCode.PROCESSOR_RULES_REQUIRED,
        message: "A processing processor must contain at least one rule.",
      });
      return { valid: false, issues };
    }

    for (let i = 0; i < processor.rules.length; i++) {
      const result = IntentProcessingSemantics.validateRuleDefinition(
        processor.rules[i],
        processor.stage,
      );
      for (const issue of result.issues) {
        issues.push({
          ...issue,
          path: `rules[${i}].${issue.path}`,
        });
      }
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Sorts processors for a given stage deterministically.
   */
  static sortProcessorsForStage(
    processors: ProcessingProcessor[] | null | undefined,
    stage: ProcessingStage,
  ): ProcessingProcessor[] {
    const filtered = (processors ?? []).filter(
      (processor) => processor.stage === stage && processor.enabled !== false,
    );

    return [...filtered].sort((a, b) => {
      const aOrder = typeof a.order === "number" ? a.order : 0;
      const bOrder = typeof b.order === "number" ? b.order : 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
  }

  /**
   * Returns the ordered active rules for the given stage, flattened from processors.
   */
  static flattenRulesForStage(
    processors: ProcessingProcessor[] | null | undefined,
    stage: ProcessingStage,
  ): ProcessingRuleDefinition[] {
    const flattened: ProcessingRuleDefinition[] = [];

    for (const processor of IntentProcessingSemantics.sortProcessorsForStage(
      processors,
      stage,
    )) {
      for (const rule of processor.rules ?? []) {
        if (rule.enabled !== false) {
          flattened.push(rule);
        }
      }
    }

    return flattened;
  }

  /**
   * Returns true when every active rule for the stage is cache-safe.
   */
  static isCacheSafeForStage(
    processors: ProcessingProcessor[] | null | undefined,
    stage: ProcessingStage,
  ): boolean {
    return !IntentProcessingSemantics.flattenRulesForStage(processors, stage).some(
      (rule) =>
        rule.cacheBehavior === ProcessingCacheBehavior.CACHE_UNSAFE ||
        rule.cacheBehavior === ProcessingCacheBehavior.CACHE_BYPASS_REQUIRED,
    );
  }

  /**
   * Returns true when any active rule for the stage requires bypassing execution cache/dedupe.
   */
  static isCacheBypassRequiredForStage(
    processors: ProcessingProcessor[] | null | undefined,
    stage: ProcessingStage,
  ): boolean {
    return IntentProcessingSemantics.flattenRulesForStage(processors, stage).some(
      (rule) =>
        rule.cacheBehavior === ProcessingCacheBehavior.CACHE_BYPASS_REQUIRED,
    );
  }

  /**
   * Builds an empty stage summary with stable defaults.
   */
  static buildEmptyStageSummary(stage: ProcessingStage): ProcessingStageSummary {
    return {
      stage,
      processorsConfigured: 0,
      processorsRun: 0,
      rulesConfigured: 0,
      rulesRun: 0,
      rulesMatched: 0,
      rulesApplied: 0,
      mutations: 0,
      mutated: false,
      blocked: false,
      reviewRequired: false,
      cacheSafe: true,
      cacheBypassRequired: false,
    };
  }

  /**
   * Builds an empty bounded processing report.
   */
  static buildEmptyExecutionProcessingReport(): ExecutionProcessingReport {
    return {
      engineVersion: IntentProcessingSemantics.ENGINE_VERSION_V1,
      mutated: false,
      blocked: false,
      reviewRequired: false,
      input: IntentProcessingSemantics.buildEmptyStageSummary(
        ProcessingStage.INPUT,
      ),
      output: IntentProcessingSemantics.buildEmptyStageSummary(
        ProcessingStage.OUTPUT,
      ),
      trail: [],
    };
  }
}

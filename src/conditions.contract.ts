import {
  createExecutionError,
  ExecutionErrorCode,
} from "./errors.contract";

/**
 * Shared condition vocabulary and evaluator.
 *
 * Why this module exists
 * - Conditioned routing (`ImplementationContract.condition`), processing rules
 *   (`ProcessingRuleDefinition.condition`) and workflows (`CHOICE` states) all share the same
 *   AND/OR/NOT tree of path-based leaf comparisons. Until 3.0.0 the shape was named after its first
 *   consumer (`ImplementationCondition` / `LogicalImplementationCondition`) and had no shared evaluator.
 * - Every operator string value is wire-level and kept verbatim across versions.
 *
 * Boundary note
 * - The evaluation scope and the values it yields are untrusted JSON, hence `unknown` at this
 *   boundary. Operators narrow explicitly before comparing; nothing is coerced implicitly.
 */

const LOG_SOURCE = "conditions.contract";

/**
 * Boolean operators for composing conditions into a tree.
 *
 * Notes
 * - Keep values stable (wire-level behavior).
 * - These values are disjoint from `ConditionOperator`, which is what lets a tree node be
 *   classified structurally (see `isConditionGroup`).
 */
export enum ConditionLogicOp {
  NOT = "NOT",
  AND = "AND",
  OR = "OR",
}

/**
 * Leaf comparison operators.
 *
 * Notes
 * - Union of the runtime routing/processing operators and the backend alert/comparison operators.
 * - Keep values stable (wire-level behavior): they are persisted in registries and JSONB columns.
 * - `AI_CONTEXT_*` operators are part of the vocabulary so editors can list them, but they are
 *   evaluated by backend AI-backed checks only; `evaluateConditionLeaf` refuses them.
 */
export enum ConditionOperator {
  /** Type mismatch (see `evaluateConditionLeaf` for the hint semantics carried by `value1`). */
  INCORRECT = "INCORRECT",

  // Boolean
  TRUE = "TRUE",
  FALSE = "FALSE",

  // Text
  LENGTH_MIN = "LENGTH_MIN",
  LENGTH_MAX = "LENGTH_MAX",
  CONTAINS = "CONTAINS",
  NOT_CONTAINS = "NOT_CONTAINS",
  STARTS_WITH = "STARTS_WITH",
  ENDS_WITH = "ENDS_WITH",
  EMPTY = "EMPTY",
  NOT_EMPTY = "NOT_EMPTY",

  // Numeric
  MORE_THAN = "MORE_THAN",
  MORE_THAN_EQUAL = "MORE_THAN_EQUAL",
  LESS_THAN = "LESS_THAN",
  LESS_THAN_EQUAL = "LESS_THAN_EQUAL",
  BETWEEN_RANGE = "BETWEEN_RANGE",
  OUTSIDE_RANGE = "OUTSIDE_RANGE",

  // Percentage change against a baseline (value1 = baseline, value2 = threshold or min%, value3 = max%)
  PERCENTAGE_MORE_THAN = "PERCENTAGE_MORE_THAN",
  PERCENTAGE_MORE_THAN_EQUAL = "PERCENTAGE_MORE_THAN_EQUAL",
  PERCENTAGE_LESS_THAN = "PERCENTAGE_LESS_THAN",
  PERCENTAGE_LESS_THAN_EQUAL = "PERCENTAGE_LESS_THAN_EQUAL",
  PERCENTAGE_BETWEEN_RANGE = "PERCENTAGE_BETWEEN_RANGE",
  PERCENTAGE_OUTSIDE_RANGE = "PERCENTAGE_OUTSIDE_RANGE",

  // Generic
  NA = "NA",
  NULL = "NULL",
  EQUALS = "EQUALS",
  NOT_EQUALS = "NOT_EQUALS",
  VALID_URL = "VALID_URL",

  // Membership (value1 holds a comma-separated list)
  IN = "IN",
  NOT_IN = "NOT_IN",

  // AI-backed checks (backend only, not evaluable by the shared evaluator)
  AI_CONTEXT_TEXT = "AI_CONTEXT_TEXT",
  AI_CONTEXT_IMAGE = "AI_CONTEXT_IMAGE",
  AI_CONTEXT_ENDPOINT = "AI_CONTEXT_ENDPOINT",

  // Arrays (3.0.0): the observed value must be an array
  ARRAY_CONTAINS = "ARRAY_CONTAINS",
  ARRAY_NOT_CONTAINS = "ARRAY_NOT_CONTAINS",
  ARRAY_EMPTY = "ARRAY_EMPTY",
  ARRAY_NOT_EMPTY = "ARRAY_NOT_EMPTY",
  ARRAY_LENGTH_MIN = "ARRAY_LENGTH_MIN",
  ARRAY_LENGTH_MAX = "ARRAY_LENGTH_MAX",

  // Regular expressions (3.0.0): bounded, see `evaluateConditionLeaf`
  MATCHES_REGEX = "MATCHES_REGEX",
}

/**
 * Coarse grouping of operators, used by editors to organize dropdowns and by validators to reason
 * about which value types make sense.
 */
export enum ConditionOperatorCategory {
  TYPE = "TYPE",
  BOOLEAN = "BOOLEAN",
  TEXT = "TEXT",
  NUMERIC = "NUMERIC",
  PERCENTAGE = "PERCENTAGE",
  GENERIC = "GENERIC",
  MEMBERSHIP = "MEMBERSHIP",
  ARRAY = "ARRAY",
  AI = "AI",
}

/**
 * How many operator parameters (`value1`, `value2`, `value3`) an operator consumes.
 *
 * Notes
 * - Numeric enum on purpose: editors compare arity with `>=` to decide which inputs to show.
 */
export enum ConditionOperatorArity {
  NONE = 0,
  ONE = 1,
  TWO = 2,
  THREE = 3,
}

/**
 * Static metadata for one operator.
 */
export interface ConditionOperatorMeta {
  op: ConditionOperator;
  category: ConditionOperatorCategory;
  /** Number of `valueN` parameters the operator requires. */
  arity: ConditionOperatorArity;
  /**
   * Whether `evaluateConditionLeaf` can evaluate the operator without external services.
   * `false` for AI-backed operators, which only the backend can run.
   */
  pureEvaluable: boolean;
}

/**
 * Single source of truth for operator category/arity/evaluability.
 *
 * Notes
 * - Every `ConditionOperator` value MUST have an entry (enforced by contracts tests).
 * - `INCORRECT` takes an optional type hint in `value1`, so its arity is `NONE` (the hint is
 *   optional, not required).
 */
export const CONDITION_OPERATOR_META: Record<ConditionOperator, ConditionOperatorMeta> = {
  [ConditionOperator.INCORRECT]: { op: ConditionOperator.INCORRECT, category: ConditionOperatorCategory.TYPE, arity: ConditionOperatorArity.NONE, pureEvaluable: true },

  [ConditionOperator.TRUE]: { op: ConditionOperator.TRUE, category: ConditionOperatorCategory.BOOLEAN, arity: ConditionOperatorArity.NONE, pureEvaluable: true },
  [ConditionOperator.FALSE]: { op: ConditionOperator.FALSE, category: ConditionOperatorCategory.BOOLEAN, arity: ConditionOperatorArity.NONE, pureEvaluable: true },

  [ConditionOperator.LENGTH_MIN]: { op: ConditionOperator.LENGTH_MIN, category: ConditionOperatorCategory.TEXT, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.LENGTH_MAX]: { op: ConditionOperator.LENGTH_MAX, category: ConditionOperatorCategory.TEXT, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.CONTAINS]: { op: ConditionOperator.CONTAINS, category: ConditionOperatorCategory.TEXT, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.NOT_CONTAINS]: { op: ConditionOperator.NOT_CONTAINS, category: ConditionOperatorCategory.TEXT, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.STARTS_WITH]: { op: ConditionOperator.STARTS_WITH, category: ConditionOperatorCategory.TEXT, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.ENDS_WITH]: { op: ConditionOperator.ENDS_WITH, category: ConditionOperatorCategory.TEXT, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.EMPTY]: { op: ConditionOperator.EMPTY, category: ConditionOperatorCategory.TEXT, arity: ConditionOperatorArity.NONE, pureEvaluable: true },
  [ConditionOperator.NOT_EMPTY]: { op: ConditionOperator.NOT_EMPTY, category: ConditionOperatorCategory.TEXT, arity: ConditionOperatorArity.NONE, pureEvaluable: true },

  [ConditionOperator.MORE_THAN]: { op: ConditionOperator.MORE_THAN, category: ConditionOperatorCategory.NUMERIC, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.MORE_THAN_EQUAL]: { op: ConditionOperator.MORE_THAN_EQUAL, category: ConditionOperatorCategory.NUMERIC, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.LESS_THAN]: { op: ConditionOperator.LESS_THAN, category: ConditionOperatorCategory.NUMERIC, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.LESS_THAN_EQUAL]: { op: ConditionOperator.LESS_THAN_EQUAL, category: ConditionOperatorCategory.NUMERIC, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.BETWEEN_RANGE]: { op: ConditionOperator.BETWEEN_RANGE, category: ConditionOperatorCategory.NUMERIC, arity: ConditionOperatorArity.TWO, pureEvaluable: true },
  [ConditionOperator.OUTSIDE_RANGE]: { op: ConditionOperator.OUTSIDE_RANGE, category: ConditionOperatorCategory.NUMERIC, arity: ConditionOperatorArity.TWO, pureEvaluable: true },

  [ConditionOperator.PERCENTAGE_MORE_THAN]: { op: ConditionOperator.PERCENTAGE_MORE_THAN, category: ConditionOperatorCategory.PERCENTAGE, arity: ConditionOperatorArity.TWO, pureEvaluable: true },
  [ConditionOperator.PERCENTAGE_MORE_THAN_EQUAL]: { op: ConditionOperator.PERCENTAGE_MORE_THAN_EQUAL, category: ConditionOperatorCategory.PERCENTAGE, arity: ConditionOperatorArity.TWO, pureEvaluable: true },
  [ConditionOperator.PERCENTAGE_LESS_THAN]: { op: ConditionOperator.PERCENTAGE_LESS_THAN, category: ConditionOperatorCategory.PERCENTAGE, arity: ConditionOperatorArity.TWO, pureEvaluable: true },
  [ConditionOperator.PERCENTAGE_LESS_THAN_EQUAL]: { op: ConditionOperator.PERCENTAGE_LESS_THAN_EQUAL, category: ConditionOperatorCategory.PERCENTAGE, arity: ConditionOperatorArity.TWO, pureEvaluable: true },
  [ConditionOperator.PERCENTAGE_BETWEEN_RANGE]: { op: ConditionOperator.PERCENTAGE_BETWEEN_RANGE, category: ConditionOperatorCategory.PERCENTAGE, arity: ConditionOperatorArity.THREE, pureEvaluable: true },
  [ConditionOperator.PERCENTAGE_OUTSIDE_RANGE]: { op: ConditionOperator.PERCENTAGE_OUTSIDE_RANGE, category: ConditionOperatorCategory.PERCENTAGE, arity: ConditionOperatorArity.THREE, pureEvaluable: true },

  [ConditionOperator.NA]: { op: ConditionOperator.NA, category: ConditionOperatorCategory.GENERIC, arity: ConditionOperatorArity.NONE, pureEvaluable: true },
  [ConditionOperator.NULL]: { op: ConditionOperator.NULL, category: ConditionOperatorCategory.GENERIC, arity: ConditionOperatorArity.NONE, pureEvaluable: true },
  [ConditionOperator.EQUALS]: { op: ConditionOperator.EQUALS, category: ConditionOperatorCategory.GENERIC, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.NOT_EQUALS]: { op: ConditionOperator.NOT_EQUALS, category: ConditionOperatorCategory.GENERIC, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.VALID_URL]: { op: ConditionOperator.VALID_URL, category: ConditionOperatorCategory.GENERIC, arity: ConditionOperatorArity.NONE, pureEvaluable: true },

  [ConditionOperator.IN]: { op: ConditionOperator.IN, category: ConditionOperatorCategory.MEMBERSHIP, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.NOT_IN]: { op: ConditionOperator.NOT_IN, category: ConditionOperatorCategory.MEMBERSHIP, arity: ConditionOperatorArity.ONE, pureEvaluable: true },

  [ConditionOperator.AI_CONTEXT_TEXT]: { op: ConditionOperator.AI_CONTEXT_TEXT, category: ConditionOperatorCategory.AI, arity: ConditionOperatorArity.NONE, pureEvaluable: false },
  [ConditionOperator.AI_CONTEXT_IMAGE]: { op: ConditionOperator.AI_CONTEXT_IMAGE, category: ConditionOperatorCategory.AI, arity: ConditionOperatorArity.NONE, pureEvaluable: false },
  [ConditionOperator.AI_CONTEXT_ENDPOINT]: { op: ConditionOperator.AI_CONTEXT_ENDPOINT, category: ConditionOperatorCategory.AI, arity: ConditionOperatorArity.NONE, pureEvaluable: false },

  [ConditionOperator.ARRAY_CONTAINS]: { op: ConditionOperator.ARRAY_CONTAINS, category: ConditionOperatorCategory.ARRAY, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.ARRAY_NOT_CONTAINS]: { op: ConditionOperator.ARRAY_NOT_CONTAINS, category: ConditionOperatorCategory.ARRAY, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.ARRAY_EMPTY]: { op: ConditionOperator.ARRAY_EMPTY, category: ConditionOperatorCategory.ARRAY, arity: ConditionOperatorArity.NONE, pureEvaluable: true },
  [ConditionOperator.ARRAY_NOT_EMPTY]: { op: ConditionOperator.ARRAY_NOT_EMPTY, category: ConditionOperatorCategory.ARRAY, arity: ConditionOperatorArity.NONE, pureEvaluable: true },
  [ConditionOperator.ARRAY_LENGTH_MIN]: { op: ConditionOperator.ARRAY_LENGTH_MIN, category: ConditionOperatorCategory.ARRAY, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
  [ConditionOperator.ARRAY_LENGTH_MAX]: { op: ConditionOperator.ARRAY_LENGTH_MAX, category: ConditionOperatorCategory.ARRAY, arity: ConditionOperatorArity.ONE, pureEvaluable: true },

  [ConditionOperator.MATCHES_REGEX]: { op: ConditionOperator.MATCHES_REGEX, category: ConditionOperatorCategory.TEXT, arity: ConditionOperatorArity.ONE, pureEvaluable: true },
};

/** Maximum regular-expression pattern length accepted by `MATCHES_REGEX`. */
export const CONDITION_REGEX_MAX_PATTERN_LENGTH = 200;

/** Maximum text length `MATCHES_REGEX` will test (longer observed values never match). */
export const CONDITION_REGEX_MAX_INPUT_LENGTH = 10_000;

/**
 * Patterns with a quantified group that is itself quantified (`(a+)+`, `(a*)*`, `(a|aa)+`...) are
 * the classic catastrophic-backtracking shapes; they are refused rather than executed.
 */
const CONDITION_REGEX_NESTED_QUANTIFIER = /\([^()]*[+*][^()]*\)[+*{]|\([^()]*\|[^()]*\)[+*]/;

/**
 * Leaf condition: applies one operator to the value found at `path` inside the evaluation scope.
 *
 * Semantics
 * - `path` is a dot-path relative to the evaluation scope (context, vars, run context...).
 * - `value1`/`value2`/`value3` are operator parameters; their meaning depends on the operator
 *   (see `CONDITION_OPERATOR_META` for arity and `evaluateConditionLeaf` for semantics).
 * - `caseInsensitive` / `trim` normalize text before string operators run.
 */
export interface ConditionLeaf {
  /** Dot-path relative to the evaluation scope. */
  path: string;

  /** Operator applied to the resolved value at `path`. */
  op: ConditionOperator;

  /** Primary operator parameter. */
  value1?: string | number | boolean | null;

  /** Secondary operator parameter (e.g. max of a range, percentage threshold). */
  value2?: string | number | boolean | null;

  /** Tertiary operator parameter (only the percentage range operators use it). */
  value3?: string | number | boolean | null;

  /**
   * Path-based alternatives to the literal parameters (3.0.0): when set, the parameter is read from
   * the evaluation scope instead of `valueN`. A reference that resolves to nothing makes the leaf
   * evaluate to `false` (a data gap, not a configuration error). Set either the literal or the ref.
   */
  value1Ref?: string;
  value2Ref?: string;
  value3Ref?: string;

  /** Optional normalization for string operators. */
  caseInsensitive?: boolean;

  /** Optional trim for string operators. */
  trim?: boolean;
}

/**
 * Boolean composition node.
 *
 * Rules
 * - NOT: exactly 1 child.
 * - AND/OR: 1+ children.
 *
 * `TLeaf` defaults to `ConditionLeaf`; domains with their own leaf shape (a property reference, a
 * comparison dimension...) reuse the same wrapper with their leaf type.
 */
export interface ConditionGroup<TLeaf = ConditionLeaf> {
  op: ConditionLogicOp;

  /** Child nodes (leaves or nested groups). Optional in the wire shape; validators flag it missing. */
  conditions?: Array<TLeaf | ConditionGroup<TLeaf>>;
}

/**
 * Defense-in-depth limits for tree evaluation/validation.
 */
export interface ConditionTreeLimits {
  /** Maximum nested boolean depth. */
  maxDepth: number;
  /** Maximum total nodes visited. */
  maxNodes: number;
}

/** Default tree limits shared by runtime routing, processing rules and workflows. */
export const DEFAULT_CONDITION_TREE_LIMITS: ConditionTreeLimits = {
  maxDepth: 20,
  maxNodes: 250,
};

/**
 * Defense-in-depth limits for dot-path resolution.
 */
export interface ConditionPathLimits {
  /** Maximum number of dot segments walked. */
  maxDepth: number;
  /** Maximum path string length. */
  maxPathLength: number;
  /** Maximum single segment length. */
  maxSegmentLength: number;
}

/** Default path limits shared by every host. */
export const DEFAULT_CONDITION_PATH_LIMITS: ConditionPathLimits = {
  maxDepth: 10,
  maxPathLength: 200,
  maxSegmentLength: 80,
};

/**
 * Options accepted by the tree evaluators.
 */
export interface ConditionEvaluationOptions {
  /** Tree limits; defaults to `DEFAULT_CONDITION_TREE_LIMITS`. */
  limits?: ConditionTreeLimits;
  /** Path limits; defaults to `DEFAULT_CONDITION_PATH_LIMITS`. */
  pathLimits?: ConditionPathLimits;
  /** Free-text subject appended to error messages (an implementation id, a state id...). */
  subjectForError?: string;
}

/**
 * Issue codes produced by `validateConditionTree`.
 */
export enum ConditionValidationIssueCode {
  TREE_TOO_LARGE = "TREE_TOO_LARGE",
  TREE_TOO_DEEP = "TREE_TOO_DEEP",
  GROUP_MISSING_CONDITIONS = "GROUP_MISSING_CONDITIONS",
  GROUP_INVALID_CHILD_COUNT = "GROUP_INVALID_CHILD_COUNT",
  LEAF_MISSING_PATH = "LEAF_MISSING_PATH",
  LEAF_PATH_TOO_LONG = "LEAF_PATH_TOO_LONG",
  LEAF_UNSUPPORTED_OPERATOR = "LEAF_UNSUPPORTED_OPERATOR",
  LEAF_OPERATOR_NOT_ALLOWED = "LEAF_OPERATOR_NOT_ALLOWED",
  LEAF_MISSING_VALUE = "LEAF_MISSING_VALUE",
  LEAF_INVALID_VALUE = "LEAF_INVALID_VALUE",
  LEAF_INVALID_VALUE_REF = "LEAF_INVALID_VALUE_REF",
  LEAF_INVALID_FLAG = "LEAF_INVALID_FLAG",
  NODE_INVALID = "NODE_INVALID",
}

/**
 * One validation finding, addressed by a JSON-ish path inside the tree (`condition.conditions[1].value1`).
 */
export interface ConditionValidationIssue {
  path: string;
  code: ConditionValidationIssueCode;
  message: string;
}

/**
 * Result of `validateConditionTree`.
 */
export interface ConditionValidationResult {
  valid: boolean;
  issues: ConditionValidationIssue[];
  /** Deepest boolean nesting reached. */
  depth: number;
  /** Total nodes visited. */
  nodesSeen: number;
}

/**
 * Options accepted by `validateConditionTree`.
 */
export interface ConditionValidationOptions {
  /** Tree limits; defaults to `DEFAULT_CONDITION_TREE_LIMITS`. */
  limits?: ConditionTreeLimits;
  /** Path limits; defaults to `DEFAULT_CONDITION_PATH_LIMITS`. */
  pathLimits?: ConditionPathLimits;
  /**
   * Operators the host allows. Defaults to every pure-evaluable operator, which rejects the
   * AI-backed operators unless the caller opts in explicitly.
   */
  allowedOperators?: ConditionOperator[];
  /** Root path used in issue addresses. Defaults to `condition`. */
  rootPath?: string;
}

interface ConditionWalkState {
  depth: number;
  nodesSeen: number;
}

/**
 * Returns true when `value` is one of the boolean composition operators.
 */
export function isConditionLogicOp(value: unknown): value is ConditionLogicOp {
  return (
    value === ConditionLogicOp.NOT ||
    value === ConditionLogicOp.AND ||
    value === ConditionLogicOp.OR
  );
}

/**
 * Returns true when `value` is a known leaf operator.
 */
export function isConditionOperator(value: unknown): value is ConditionOperator {
  return typeof value === "string" && (Object.values(ConditionOperator) as string[]).includes(value);
}

/**
 * Structural guard: a node is a group when its `op` is a boolean composition operator.
 *
 * Notes
 * - Leaf and group operators are disjoint enums, so this works for any leaf shape, including
 *   domain-specific leaves that do not carry `path`.
 */
export function isConditionGroup<TLeaf>(
  node: TLeaf | ConditionGroup<TLeaf> | null | undefined,
): node is ConditionGroup<TLeaf> {
  if (node === null || node === undefined || typeof node !== "object") return false;
  return isConditionLogicOp((node as ConditionGroup<TLeaf>).op);
}

/**
 * Lists the operators the shared evaluator can run (excludes AI-backed operators).
 */
export function pureEvaluableConditionOperators(): ConditionOperator[] {
  return Object.values(CONDITION_OPERATOR_META)
    .filter((meta) => meta.pureEvaluable)
    .map((meta) => meta.op);
}

/**
 * Returns true for plain JSON objects (not arrays, not class instances).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return false;
  if (typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Splits a condition path into segments.
 *
 * Grammar
 * - Dot-separated segments; a segment may carry `[index]` suffixes (`items[0].id`), which become
 *   numeric segments. Segments are trimmed.
 * - Returns `null` when the path is empty, malformed or exceeds the limits.
 */
export function parseConditionPath(
  path: string,
  limits: ConditionPathLimits = DEFAULT_CONDITION_PATH_LIMITS,
): string[] | null {
  const p = String(path ?? "").trim();
  if (!p) return null;
  if (p.length > limits.maxPathLength) return null;

  const out: string[] = [];
  for (const rawSegment of p.split(".")) {
    const segment = rawSegment.trim();
    if (!segment || segment.length > limits.maxSegmentLength) return null;
    const match = /^([^[\]]+)((?:\[\d+\])*)$/.exec(segment);
    if (!match) return null;
    out.push(match[1].trim());
    for (const idx of match[2].match(/\d+/g) ?? []) out.push(idx);
  }
  if (out.length === 0 || out.length > limits.maxDepth) return null;
  if (out.some((s) => !s)) return null;
  return out;
}

/**
 * Resolves a dot-path value from an object.
 *
 * Notes
 * - Dot-path with optional `[index]` suffixes (3.0.0; plain dot-paths behave exactly as before).
 * - Plain objects are entered by key, arrays only by numeric index.
 * - Returns `undefined` when the path is missing, exceeds the limits, or traversal meets a value
 *   that cannot be entered.
 */
export function resolveConditionPath(
  root: unknown,
  path: string,
  limits: ConditionPathLimits = DEFAULT_CONDITION_PATH_LIMITS,
): unknown {
  const parts = parseConditionPath(path, limits);
  if (!parts) return undefined;

  let cur: unknown = root;
  for (const seg of parts) {
    if (Array.isArray(cur)) {
      if (!/^\d+$/.test(seg)) return undefined;
      cur = cur[Number(seg)];
      continue;
    }
    if (!isPlainObject(cur)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

/**
 * Builds the standard CONFIG_ERROR thrown for misconfigured conditions.
 */
function configError(message: string, subjectForError?: string): ReturnType<typeof createExecutionError> {
  const suffix = subjectForError ? ` (subject=${subjectForError})` : "";
  return createExecutionError(ExecutionErrorCode.CONFIG_ERROR, `[${LOG_SOURCE}] ${message}${suffix}`);
}

/**
 * Applies `trim` / `caseInsensitive` normalization to a string.
 */
function normalizeText(value: string, leaf: ConditionLeaf): string {
  const trimmed = leaf.trim ? value.trim() : value;
  return leaf.caseInsensitive ? trimmed.toLowerCase() : trimmed;
}

/**
 * Asserts that an operator parameter is a finite number.
 */
function assertFiniteNumber(value: unknown, where: string, subjectForError?: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw configError(
      `Invalid condition parameter: ${where} must be a finite number (got ${String(value)})`,
      subjectForError,
    );
  }
  return value;
}

/**
 * Asserts that an operator parameter is a string.
 */
function assertString(value: unknown, where: string, subjectForError?: string): string {
  if (typeof value !== "string") {
    throw configError(
      `Invalid condition parameter: ${where} must be a string (got ${String(value)})`,
      subjectForError,
    );
  }
  return value;
}

/**
 * Asserts that an operator parameter is a comparable primitive.
 */
function assertPrimitiveComparable(
  value: unknown,
  where: string,
  subjectForError?: string,
): string | number | boolean | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  throw configError(
    `Invalid condition parameter: ${where} must be string|number|boolean|null (got ${typeof value})`,
    subjectForError,
  );
}

/**
 * Parses a comma-separated membership list (`IN` / `NOT_IN`): entries are trimmed, empties dropped.
 */
function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/**
 * Returns the observed value as a membership key, or `null` when it is not a comparable primitive.
 */
function membershipKey(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "boolean") return String(raw);
  return null;
}

/**
 * Signed percentage change of `observed` against `baseline`.
 *
 * Notes
 * - A zero baseline cannot be divided: any move away from zero counts as an infinite change,
 *   staying at zero counts as no change (mirrors the backend alert engine).
 */
function percentageChange(observed: number, baseline: number): number {
  if (baseline === 0) return observed === 0 ? 0 : Infinity;
  return ((observed - baseline) / baseline) * 100;
}

/**
 * Evaluates one leaf against a scope.
 *
 * Behavior
 * - Returns `true`/`false` when the leaf is well-formed; a value of the wrong type never matches
 *   (strict semantics: no implicit string/number coercion).
 * - Throws `ExecutionError(CONFIG_ERROR)` when the leaf itself is misconfigured (missing path/op,
 *   wrong parameter types, inverted ranges, AI-backed operator).
 *
 * Operator parameters
 * - Text/numeric/generic operators: as documented on `ConditionOperator`.
 * - `INCORRECT`: `value1` is an optional type hint (`null`, string, number or boolean); without a hint,
 *   any non-primitive value is incorrect.
 * - `IN`/`NOT_IN`: `value1` is a comma-separated string; observed strings, finite numbers and booleans
 *   are compared by their string form.
 * - `NA`: matches the literal string `"NA"`.
 * - `PERCENTAGE_*`: `value1` baseline (number), `value2` threshold percentage; the two range operators
 *   read `value2` as the inclusive min percentage and `value3` as the inclusive max percentage.
 */
export function evaluateConditionLeaf(
  scope: unknown,
  leaf: ConditionLeaf,
  options: ConditionEvaluationOptions = {},
): boolean {
  const subject = options.subjectForError;
  const path = String(leaf?.path ?? "").trim();
  const op = leaf?.op;

  if (!path) {
    throw configError("Condition leaf is missing path", subject);
  }
  if (!op) {
    throw configError("Condition leaf is missing op", subject);
  }

  const pathLimits = options.pathLimits ?? DEFAULT_CONDITION_PATH_LIMITS;
  const raw = resolveConditionPath(scope, path, pathLimits);

  // Effective operator parameters: a `valueNRef` reads the scope; a ref that resolves to nothing
  // makes the leaf false instead of throwing (data gap vs. configuration error).
  const refSlots: Array<string | undefined> = [leaf.value1Ref, leaf.value2Ref, leaf.value3Ref];
  const literalSlots: Array<string | number | boolean | null | undefined> = [leaf.value1, leaf.value2, leaf.value3];
  const params: Array<string | number | boolean | null | undefined> = [];
  for (let i = 0; i < 3; i++) {
    const ref = refSlots[i];
    if (typeof ref === "string" && ref.trim()) {
      const resolved = resolveConditionPath(scope, ref, pathLimits);
      if (resolved === undefined || resolved === null) return false;
      if (typeof resolved !== "string" && typeof resolved !== "number" && typeof resolved !== "boolean") return false;
      params.push(resolved);
    } else {
      params.push(literalSlots[i]);
    }
  }
  const value1 = params[0];
  const value2 = params[1];
  const value3 = params[2];
  const effective: ConditionLeaf = { ...leaf, value1, value2, value3 };

  switch (op) {
    case ConditionOperator.ARRAY_EMPTY:
      return Array.isArray(raw) && raw.length === 0;

    case ConditionOperator.ARRAY_NOT_EMPTY:
      return Array.isArray(raw) && raw.length > 0;

    case ConditionOperator.ARRAY_LENGTH_MIN: {
      const n = assertFiniteNumber(value1, `value1 for ${op}`, subject);
      return Array.isArray(raw) && raw.length >= n;
    }

    case ConditionOperator.ARRAY_LENGTH_MAX: {
      const n = assertFiniteNumber(value1, `value1 for ${op}`, subject);
      return Array.isArray(raw) && raw.length <= n;
    }

    case ConditionOperator.ARRAY_CONTAINS:
    case ConditionOperator.ARRAY_NOT_CONTAINS: {
      const needle = assertPrimitiveComparable(value1, `value1 for ${op}`, subject);
      if (!Array.isArray(raw)) return false;
      const found = raw.some((element) => element === needle);
      return op === ConditionOperator.ARRAY_CONTAINS ? found : !found;
    }

    case ConditionOperator.MATCHES_REGEX: {
      const pattern = assertString(value1, `value1 for ${op}`, subject);
      if (pattern.length > CONDITION_REGEX_MAX_PATTERN_LENGTH) {
        throw configError(`Regular expression exceeds ${CONDITION_REGEX_MAX_PATTERN_LENGTH} characters`, subject);
      }
      if (CONDITION_REGEX_NESTED_QUANTIFIER.test(pattern)) {
        throw configError("Regular expression uses a nested quantifier, which is not allowed", subject);
      }
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, leaf.caseInsensitive ? "iu" : "u");
      } catch {
        throw configError(`Invalid regular expression: ${pattern}`, subject);
      }
      if (typeof raw !== "string") return false;
      const txt = leaf.trim ? raw.trim() : raw;
      if (txt.length > CONDITION_REGEX_MAX_INPUT_LENGTH) return false;
      return regex.test(txt);
    }

    case ConditionOperator.NULL:
      return raw === null || raw === undefined;

    case ConditionOperator.NA:
      return raw === "NA";

    case ConditionOperator.TRUE:
      return raw === true;

    case ConditionOperator.FALSE:
      return raw === false;

    case ConditionOperator.EMPTY: {
      if (typeof raw !== "string") return false;
      return normalizeText(raw, effective).length === 0;
    }

    case ConditionOperator.NOT_EMPTY: {
      if (typeof raw !== "string") return false;
      return normalizeText(raw, effective).length > 0;
    }

    case ConditionOperator.LENGTH_MIN: {
      const n = assertFiniteNumber(value1, `value1 for ${op}`, subject);
      if (typeof raw !== "string") return false;
      return normalizeText(raw, effective).length >= n;
    }

    case ConditionOperator.LENGTH_MAX: {
      const n = assertFiniteNumber(value1, `value1 for ${op}`, subject);
      if (typeof raw !== "string") return false;
      return normalizeText(raw, effective).length <= n;
    }

    case ConditionOperator.CONTAINS: {
      const needle = normalizeText(assertString(value1, `value1 for ${op}`, subject), effective);
      if (typeof raw !== "string") return false;
      return normalizeText(raw, effective).includes(needle);
    }

    case ConditionOperator.NOT_CONTAINS: {
      const needle = normalizeText(assertString(value1, `value1 for ${op}`, subject), effective);
      if (typeof raw !== "string") return false;
      return !normalizeText(raw, effective).includes(needle);
    }

    case ConditionOperator.STARTS_WITH: {
      const needle = normalizeText(assertString(value1, `value1 for ${op}`, subject), effective);
      if (typeof raw !== "string") return false;
      return normalizeText(raw, effective).startsWith(needle);
    }

    case ConditionOperator.ENDS_WITH: {
      const needle = normalizeText(assertString(value1, `value1 for ${op}`, subject), effective);
      if (typeof raw !== "string") return false;
      return normalizeText(raw, effective).endsWith(needle);
    }

    case ConditionOperator.MORE_THAN: {
      const n = assertFiniteNumber(value1, `value1 for ${op}`, subject);
      if (typeof raw !== "number" || !Number.isFinite(raw)) return false;
      return raw > n;
    }

    case ConditionOperator.MORE_THAN_EQUAL: {
      const n = assertFiniteNumber(value1, `value1 for ${op}`, subject);
      if (typeof raw !== "number" || !Number.isFinite(raw)) return false;
      return raw >= n;
    }

    case ConditionOperator.LESS_THAN: {
      const n = assertFiniteNumber(value1, `value1 for ${op}`, subject);
      if (typeof raw !== "number" || !Number.isFinite(raw)) return false;
      return raw < n;
    }

    case ConditionOperator.LESS_THAN_EQUAL: {
      const n = assertFiniteNumber(value1, `value1 for ${op}`, subject);
      if (typeof raw !== "number" || !Number.isFinite(raw)) return false;
      return raw <= n;
    }

    case ConditionOperator.BETWEEN_RANGE:
    case ConditionOperator.OUTSIDE_RANGE: {
      const min = assertFiniteNumber(value1, `value1 for ${op} (min)`, subject);
      const max = assertFiniteNumber(value2, `value2 for ${op} (max)`, subject);
      if (min > max) {
        throw configError(
          `Invalid condition range: min must be <= max (got min=${min} max=${max})`,
          subject,
        );
      }
      if (typeof raw !== "number" || !Number.isFinite(raw)) return false;
      const inside = raw >= min && raw <= max;
      return op === ConditionOperator.BETWEEN_RANGE ? inside : !inside;
    }

    case ConditionOperator.PERCENTAGE_MORE_THAN:
    case ConditionOperator.PERCENTAGE_MORE_THAN_EQUAL:
    case ConditionOperator.PERCENTAGE_LESS_THAN:
    case ConditionOperator.PERCENTAGE_LESS_THAN_EQUAL: {
      const baseline = assertFiniteNumber(value1, `value1 for ${op} (baseline)`, subject);
      const threshold = assertFiniteNumber(value2, `value2 for ${op} (threshold)`, subject);
      if (typeof raw !== "number" || !Number.isFinite(raw)) return false;
      const pct = percentageChange(raw, baseline);
      switch (op) {
        case ConditionOperator.PERCENTAGE_MORE_THAN:
          return pct > threshold;
        case ConditionOperator.PERCENTAGE_MORE_THAN_EQUAL:
          return pct >= threshold;
        case ConditionOperator.PERCENTAGE_LESS_THAN:
          return pct < -threshold;
        default:
          return pct <= -threshold;
      }
    }

    case ConditionOperator.PERCENTAGE_BETWEEN_RANGE:
    case ConditionOperator.PERCENTAGE_OUTSIDE_RANGE: {
      const baseline = assertFiniteNumber(value1, `value1 for ${op} (baseline)`, subject);
      const pctMin = assertFiniteNumber(value2, `value2 for ${op} (min %)`, subject);
      const pctMax = assertFiniteNumber(value3, `value3 for ${op} (max %)`, subject);
      if (pctMin > pctMax) {
        throw configError(
          `Invalid condition range: min must be <= max (got min=${pctMin} max=${pctMax})`,
          subject,
        );
      }
      if (typeof raw !== "number" || !Number.isFinite(raw)) return false;
      const pct = percentageChange(raw, baseline);
      const inside = pct >= pctMin && pct <= pctMax;
      return op === ConditionOperator.PERCENTAGE_BETWEEN_RANGE ? inside : !inside;
    }

    case ConditionOperator.EQUALS: {
      const v1 = assertPrimitiveComparable(value1, `value1 for ${op}`, subject);
      return raw === v1;
    }

    case ConditionOperator.NOT_EQUALS: {
      const v1 = assertPrimitiveComparable(value1, `value1 for ${op}`, subject);
      return raw !== v1;
    }

    case ConditionOperator.IN:
    case ConditionOperator.NOT_IN: {
      const list = parseCommaList(assertString(value1, `value1 for ${op}`, subject));
      const key = membershipKey(raw);
      const member = key !== null && list.includes(key);
      return op === ConditionOperator.IN ? member : !member;
    }

    case ConditionOperator.VALID_URL: {
      if (typeof raw !== "string") return false;
      const txt = normalizeText(raw, effective);
      if (!txt) return false;
      try {
        // Absolute URLs only; relative URLs would need an explicit operator.
        const u = new URL(txt);
        return Boolean(u.protocol && u.host);
      } catch {
        return false;
      }
    }

    case ConditionOperator.INCORRECT: {
      if (raw === null || raw === undefined) return false;

      // With a hint in value1, the expected type is the hint's type.
      if (value1 === null) return raw !== null;
      if (typeof value1 === "string") return typeof raw !== "string";
      if (typeof value1 === "boolean") return typeof raw !== "boolean";
      if (typeof value1 === "number") {
        return typeof raw !== "number" || !Number.isFinite(raw);
      }

      // Without a hint, any non-primitive value is incorrect.
      if (typeof raw === "string") return false;
      if (typeof raw === "boolean") return false;
      if (typeof raw === "number" && Number.isFinite(raw)) return false;
      return true;
    }

    case ConditionOperator.AI_CONTEXT_TEXT:
    case ConditionOperator.AI_CONTEXT_IMAGE:
    case ConditionOperator.AI_CONTEXT_ENDPOINT:
      throw configError(
        `Condition op ${op} is AI-backed and cannot be evaluated by the shared evaluator`,
        subject,
      );

    default:
      throw configError(`Unsupported condition op: ${String(op)}`, subject);
  }
}

/**
 * Throws when the walk state exceeds the configured limits.
 */
function assertWithinLimits(
  state: ConditionWalkState,
  limits: ConditionTreeLimits,
  subjectForError?: string,
): void {
  if (state.depth > limits.maxDepth) {
    throw configError(`Condition tree is too deep (maxDepth=${limits.maxDepth})`, subjectForError);
  }
  if (state.nodesSeen > limits.maxNodes) {
    throw configError(`Condition tree is too large (maxNodes=${limits.maxNodes})`, subjectForError);
  }
}

/**
 * Evaluates an AND/OR/NOT tree with a caller-supplied leaf evaluator.
 *
 * Behavior
 * - A `null`/`undefined` root means "no condition" and evaluates to `true`.
 * - Groups are detected structurally (`isConditionGroup`); everything else is handed to `evaluateLeaf`.
 * - AND short-circuits on the first `false`, OR on the first `true`.
 * - Throws `ExecutionError(CONFIG_ERROR)` for malformed groups (NOT without exactly one child,
 *   AND/OR without children) and when limits are exceeded.
 *
 * @param node Root of the tree (a leaf, a group, or nothing).
 * @param evaluateLeaf Domain-owned leaf evaluation (for `ConditionLeaf` use `evaluateConditionLeaf`).
 * @param options Limits and error subject.
 */
export function evaluateConditionTree<TLeaf>(
  node: TLeaf | ConditionGroup<TLeaf> | null | undefined,
  evaluateLeaf: (leaf: TLeaf) => boolean,
  options: ConditionEvaluationOptions = {},
): boolean {
  if (node === null || node === undefined) return true;
  const state: ConditionWalkState = { depth: 0, nodesSeen: 0 };
  return evaluateConditionTreeInternal(node, evaluateLeaf, options, state);
}

/**
 * Recursive worker for `evaluateConditionTree`.
 */
function evaluateConditionTreeInternal<TLeaf>(
  node: TLeaf | ConditionGroup<TLeaf>,
  evaluateLeaf: (leaf: TLeaf) => boolean,
  options: ConditionEvaluationOptions,
  state: ConditionWalkState,
): boolean {
  const limits = options.limits ?? DEFAULT_CONDITION_TREE_LIMITS;
  const subject = options.subjectForError;

  state.nodesSeen++;
  assertWithinLimits(state, limits, subject);

  if (!isConditionGroup(node)) {
    return evaluateLeaf(node);
  }

  state.depth++;
  assertWithinLimits(state, limits, subject);

  const children = node.conditions;
  try {
    switch (node.op) {
      case ConditionLogicOp.NOT: {
        if (!Array.isArray(children) || children.length !== 1) {
          throw configError("NOT condition must include exactly 1 child in conditions[]", subject);
        }
        return !evaluateConditionTreeInternal(children[0], evaluateLeaf, options, state);
      }

      case ConditionLogicOp.AND: {
        if (!Array.isArray(children) || children.length === 0) {
          throw configError("AND condition must include a non-empty conditions array", subject);
        }
        for (const child of children) {
          if (!evaluateConditionTreeInternal(child, evaluateLeaf, options, state)) return false;
        }
        return true;
      }

      case ConditionLogicOp.OR: {
        if (!Array.isArray(children) || children.length === 0) {
          throw configError("OR condition must include a non-empty conditions array", subject);
        }
        for (const child of children) {
          if (evaluateConditionTreeInternal(child, evaluateLeaf, options, state)) return true;
        }
        return false;
      }

      default:
        throw configError(`Unsupported logical condition op: ${String(node.op)}`, subject);
    }
  } finally {
    state.depth--;
  }
}

/**
 * Convenience for the common case: a `ConditionLeaf` tree evaluated against a scope object.
 *
 * Notes
 * - Equivalent to `evaluateConditionTree(node, (leaf) => evaluateConditionLeaf(scope, leaf, options), options)`.
 */
export function evaluateConditionTreeOnScope(
  scope: unknown,
  node: ConditionLeaf | ConditionGroup<ConditionLeaf> | null | undefined,
  options: ConditionEvaluationOptions = {},
): boolean {
  return evaluateConditionTree<ConditionLeaf>(
    node,
    (leaf) => evaluateConditionLeaf(scope, leaf, options),
    options,
  );
}

/**
 * Returns true when a value is a valid operator parameter (`string | number | boolean | null`).
 */
function isConditionParameterValue(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Validates a `ConditionLeaf` tree without throwing, collecting every issue found.
 *
 * Checks
 * - Structure: groups have `conditions[]`, NOT has exactly one child, AND/OR at least one.
 * - Limits: depth and node count (validation stops descending once exceeded).
 * - Leaves: non-empty `path` within limits, known operator, operator allowed by the host,
 *   required parameters present (by arity), parameters and flags of the right primitive types.
 *
 * Notes
 * - A `null`/`undefined` root is valid ("no condition").
 * - Use this at authoring/publish time; `evaluateConditionLeaf` still guards at run time.
 */
export function validateConditionTree(
  node: ConditionLeaf | ConditionGroup<ConditionLeaf> | null | undefined,
  options: ConditionValidationOptions = {},
): ConditionValidationResult {
  const limits = options.limits ?? DEFAULT_CONDITION_TREE_LIMITS;
  const pathLimits = options.pathLimits ?? DEFAULT_CONDITION_PATH_LIMITS;
  const allowed = new Set<ConditionOperator>(options.allowedOperators ?? pureEvaluableConditionOperators());
  const rootPath = options.rootPath ?? "condition";
  const issues: ConditionValidationIssue[] = [];
  const state: ConditionWalkState = { depth: 0, nodesSeen: 0 };
  let maxDepthSeen = 0;
  let sizeExceeded = false;

  const visit = (current: ConditionLeaf | ConditionGroup<ConditionLeaf>, address: string): void => {
    // Once the size limit is hit, one issue is enough: stop counting and stop descending.
    if (sizeExceeded) return;
    state.nodesSeen++;
    if (state.nodesSeen > limits.maxNodes) {
      sizeExceeded = true;
      issues.push({
        path: address,
        code: ConditionValidationIssueCode.TREE_TOO_LARGE,
        message: `Condition tree exceeds the maximum supported node count (${limits.maxNodes}).`,
      });
      return;
    }

    if (current === null || current === undefined || typeof current !== "object") {
      issues.push({
        path: address,
        code: ConditionValidationIssueCode.NODE_INVALID,
        message: "Condition node must be an object.",
      });
      return;
    }

    if (isConditionGroup(current)) {
      state.depth++;
      maxDepthSeen = Math.max(maxDepthSeen, state.depth);
      try {
        if (state.depth > limits.maxDepth) {
          issues.push({
            path: address,
            code: ConditionValidationIssueCode.TREE_TOO_DEEP,
            message: `Condition tree exceeds the maximum supported depth (${limits.maxDepth}).`,
          });
          return;
        }

        const children = current.conditions;
        if (!Array.isArray(children)) {
          issues.push({
            path: `${address}.conditions`,
            code: ConditionValidationIssueCode.GROUP_MISSING_CONDITIONS,
            message: "Logical condition must include conditions[].",
          });
          return;
        }

        if (current.op === ConditionLogicOp.NOT && children.length !== 1) {
          issues.push({
            path: `${address}.conditions`,
            code: ConditionValidationIssueCode.GROUP_INVALID_CHILD_COUNT,
            message: "NOT condition must include exactly 1 child condition.",
          });
          return;
        }

        if (current.op !== ConditionLogicOp.NOT && children.length < 1) {
          issues.push({
            path: `${address}.conditions`,
            code: ConditionValidationIssueCode.GROUP_INVALID_CHILD_COUNT,
            message: `${current.op} condition must include at least 1 child condition.`,
          });
          return;
        }

        for (let i = 0; i < children.length; i++) {
          visit(children[i], `${address}.conditions[${i}]`);
        }
      } finally {
        state.depth--;
      }
      return;
    }

    const leaf = current;
    const path = String(leaf.path ?? "").trim();
    if (!path) {
      issues.push({
        path: `${address}.path`,
        code: ConditionValidationIssueCode.LEAF_MISSING_PATH,
        message: "Leaf condition is missing path.",
      });
    } else if (parseConditionPath(path, pathLimits) === null) {
      issues.push({
        path: `${address}.path`,
        code: ConditionValidationIssueCode.LEAF_PATH_TOO_LONG,
        message: `Leaf condition path exceeds the supported limits (maxDepth=${pathLimits.maxDepth}, maxPathLength=${pathLimits.maxPathLength}, maxSegmentLength=${pathLimits.maxSegmentLength}).`,
      });
    }

    if (!isConditionOperator(leaf.op)) {
      issues.push({
        path: `${address}.op`,
        code: ConditionValidationIssueCode.LEAF_UNSUPPORTED_OPERATOR,
        message: `Unsupported condition op '${String(leaf.op)}'.`,
      });
    } else {
      if (!allowed.has(leaf.op)) {
        issues.push({
          path: `${address}.op`,
          code: ConditionValidationIssueCode.LEAF_OPERATOR_NOT_ALLOWED,
          message: `Condition op '${leaf.op}' is not allowed in this context.`,
        });
      }

      const arity = CONDITION_OPERATOR_META[leaf.op].arity;
      const slots: Array<{ name: string; value: unknown; ref: unknown; required: boolean }> = [
        { name: "value1", value: leaf.value1, ref: leaf.value1Ref, required: arity >= ConditionOperatorArity.ONE },
        { name: "value2", value: leaf.value2, ref: leaf.value2Ref, required: arity >= ConditionOperatorArity.TWO },
        { name: "value3", value: leaf.value3, ref: leaf.value3Ref, required: arity >= ConditionOperatorArity.THREE },
      ];
      for (const slot of slots) {
        const hasValue = typeof slot.value !== "undefined";
        const hasRef = typeof slot.ref !== "undefined";
        if (slot.required && !hasValue && !hasRef) {
          issues.push({
            path: `${address}.${slot.name}`,
            code: ConditionValidationIssueCode.LEAF_MISSING_VALUE,
            message: `Condition op '${leaf.op}' requires ${slot.name} (literal or ${slot.name}Ref).`,
          });
        }
        if (hasValue && hasRef) {
          issues.push({
            path: `${address}.${slot.name}Ref`,
            code: ConditionValidationIssueCode.LEAF_INVALID_VALUE_REF,
            message: `Set either ${slot.name} or ${slot.name}Ref, not both.`,
          });
        }
        if (hasRef && (typeof slot.ref !== "string" || parseConditionPath(slot.ref, pathLimits) === null)) {
          issues.push({
            path: `${address}.${slot.name}Ref`,
            code: ConditionValidationIssueCode.LEAF_INVALID_VALUE_REF,
            message: `${slot.name}Ref must be a valid path.`,
          });
        }
      }
      if (leaf.op === ConditionOperator.MATCHES_REGEX && typeof leaf.value1 === "string") {
        if (leaf.value1.length > CONDITION_REGEX_MAX_PATTERN_LENGTH || CONDITION_REGEX_NESTED_QUANTIFIER.test(leaf.value1)) {
          issues.push({
            path: `${address}.value1`,
            code: ConditionValidationIssueCode.LEAF_INVALID_VALUE,
            message: `Regular expression must be at most ${CONDITION_REGEX_MAX_PATTERN_LENGTH} characters and must not nest quantifiers.`,
          });
        } else {
          try {
            new RegExp(leaf.value1, "u");
          } catch {
            issues.push({
              path: `${address}.value1`,
              code: ConditionValidationIssueCode.LEAF_INVALID_VALUE,
              message: "Regular expression does not compile.",
            });
          }
        }
      }
    }

    const valueSlots: Array<{ name: string; value: unknown }> = [
      { name: "value1", value: leaf.value1 },
      { name: "value2", value: leaf.value2 },
      { name: "value3", value: leaf.value3 },
    ];
    for (const slot of valueSlots) {
      if (typeof slot.value !== "undefined" && !isConditionParameterValue(slot.value)) {
        issues.push({
          path: `${address}.${slot.name}`,
          code: ConditionValidationIssueCode.LEAF_INVALID_VALUE,
          message: `Condition ${slot.name} must be string|number|boolean|null.`,
        });
      }
    }

    const flagSlots: Array<{ name: string; value: unknown }> = [
      { name: "caseInsensitive", value: leaf.caseInsensitive },
      { name: "trim", value: leaf.trim },
    ];
    for (const flag of flagSlots) {
      if (typeof flag.value !== "undefined" && typeof flag.value !== "boolean") {
        issues.push({
          path: `${address}.${flag.name}`,
          code: ConditionValidationIssueCode.LEAF_INVALID_FLAG,
          message: `Condition ${flag.name} must be boolean.`,
        });
      }
    }
  };

  if (node !== null && node !== undefined) {
    visit(node, rootPath);
  }

  return {
    valid: issues.length === 0,
    issues,
    depth: maxDepthSeen,
    nodesSeen: state.nodesSeen,
  };
}

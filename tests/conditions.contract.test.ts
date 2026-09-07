import {
  CONDITION_OPERATOR_META,
  ConditionGroup,
  ConditionLeaf,
  ConditionLogicOp,
  ConditionOperator,
  ConditionOperatorArity,
  ConditionOperatorCategory,
  ConditionValidationIssueCode,
  DEFAULT_CONDITION_PATH_LIMITS,
  DEFAULT_CONDITION_TREE_LIMITS,
  evaluateConditionLeaf,
  evaluateConditionTree,
  evaluateConditionTreeOnScope,
  isConditionGroup,
  isConditionLogicOp,
  isConditionOperator,
  parseConditionPath,
  pureEvaluableConditionOperators,
  resolveConditionPath,
  validateConditionTree,
} from "../src/conditions.contract";
import {
  ConditionOp,
  ImplementationCondition,
  LogicalImplementationCondition,
} from "../src/implementations.contract";
import { ExecutionErrorCode } from "../src/errors.contract";

/**
 * Wire-level operator values. Adding is fine; renaming or removing one is a breaking change.
 */
const WIRE_OPERATORS: string[] = [
  "INCORRECT",
  "TRUE",
  "FALSE",
  "LENGTH_MIN",
  "LENGTH_MAX",
  "CONTAINS",
  "NOT_CONTAINS",
  "STARTS_WITH",
  "ENDS_WITH",
  "EMPTY",
  "NOT_EMPTY",
  "MORE_THAN",
  "MORE_THAN_EQUAL",
  "LESS_THAN",
  "LESS_THAN_EQUAL",
  "BETWEEN_RANGE",
  "OUTSIDE_RANGE",
  "PERCENTAGE_MORE_THAN",
  "PERCENTAGE_MORE_THAN_EQUAL",
  "PERCENTAGE_LESS_THAN",
  "PERCENTAGE_LESS_THAN_EQUAL",
  "PERCENTAGE_BETWEEN_RANGE",
  "PERCENTAGE_OUTSIDE_RANGE",
  "NA",
  "NULL",
  "EQUALS",
  "NOT_EQUALS",
  "VALID_URL",
  "IN",
  "NOT_IN",
  "AI_CONTEXT_TEXT",
  "AI_CONTEXT_IMAGE",
  "AI_CONTEXT_ENDPOINT",
  "ARRAY_CONTAINS",
  "ARRAY_NOT_CONTAINS",
  "ARRAY_EMPTY",
  "ARRAY_NOT_EMPTY",
  "ARRAY_LENGTH_MIN",
  "ARRAY_LENGTH_MAX",
  "MATCHES_REGEX",
];

/**
 * Evaluates a leaf against a scope with an error subject, mirroring how hosts call it.
 */
function leafOn(scope: unknown, leaf: ConditionLeaf): boolean {
  return evaluateConditionLeaf(scope, leaf, { subjectForError: "test-subject" });
}

/**
 * Captures the ExecutionError thrown by `fn`, failing when nothing is thrown.
 */
function thrownCode(fn: () => unknown): ExecutionErrorCode | undefined {
  try {
    fn();
  } catch (e) {
    const err = e as { code?: ExecutionErrorCode };
    return err.code;
  }
  return undefined;
}

describe("conditions.contract vocabulary", () => {
  it("keeps operator values stable and unique", () => {
    const values = Object.values(ConditionOperator) as string[];
    expect(values).toEqual(WIRE_OPERATORS);
    expect(new Set(values).size).toBe(values.length);
  });

  it("keeps logic operators stable and disjoint from leaf operators", () => {
    expect(Object.values(ConditionLogicOp)).toEqual(["NOT", "AND", "OR"]);
    for (const logic of Object.values(ConditionLogicOp)) {
      expect(isConditionOperator(logic)).toBe(false);
      expect(isConditionLogicOp(logic)).toBe(true);
    }
    expect(isConditionLogicOp("EQUALS")).toBe(false);
  });

  it("has metadata for every operator with a consistent op key", () => {
    for (const op of Object.values(ConditionOperator)) {
      const meta = CONDITION_OPERATOR_META[op];
      expect(meta).toBeDefined();
      expect(meta.op).toBe(op);
      expect(Object.values(ConditionOperatorCategory)).toContain(meta.category);
      expect([
        ConditionOperatorArity.NONE,
        ConditionOperatorArity.ONE,
        ConditionOperatorArity.TWO,
        ConditionOperatorArity.THREE,
      ]).toContain(meta.arity);
    }
  });

  it("marks only AI operators as not pure-evaluable", () => {
    const notPure = Object.values(CONDITION_OPERATOR_META)
      .filter((m) => !m.pureEvaluable)
      .map((m) => m.op)
      .sort();
    expect(notPure).toEqual(
      [
        ConditionOperator.AI_CONTEXT_ENDPOINT,
        ConditionOperator.AI_CONTEXT_IMAGE,
        ConditionOperator.AI_CONTEXT_TEXT,
      ].sort(),
    );
    const pure = pureEvaluableConditionOperators();
    expect(pure).not.toContain(ConditionOperator.AI_CONTEXT_TEXT);
    expect(pure).toContain(ConditionOperator.EQUALS);
    expect(pure.length).toBe(WIRE_OPERATORS.length - 3);
  });

  it("exposes the deprecated names as the same runtime values", () => {
    expect(ConditionOp).toBe(ConditionOperator);
    expect(ConditionOp.EQUALS).toBe("EQUALS");

    // Structural compatibility of the deprecated interfaces.
    const leaf: ImplementationCondition = { path: "a", op: ConditionOp.TRUE };
    const group: LogicalImplementationCondition = {
      op: ConditionLogicOp.AND,
      conditions: [leaf],
    };
    expect(evaluateConditionTreeOnScope({ a: true }, group)).toBe(true);
  });

  it("exposes default limits", () => {
    expect(DEFAULT_CONDITION_TREE_LIMITS).toEqual({ maxDepth: 20, maxNodes: 250 });
    expect(DEFAULT_CONDITION_PATH_LIMITS).toEqual({
      maxDepth: 10,
      maxPathLength: 200,
      maxSegmentLength: 80,
    });
  });
});

describe("conditions.contract resolveConditionPath", () => {
  it("returns undefined for missing paths and non-objects", () => {
    expect(resolveConditionPath(null, "a")).toBeUndefined();
    expect(resolveConditionPath(undefined, "a")).toBeUndefined();
    expect(resolveConditionPath(123, "a")).toBeUndefined();
    expect(resolveConditionPath({ a: { b: 1 } }, "a.c")).toBeUndefined();
    // Numeric segments enter arrays (3.0.0): `a.0` and `a[0]` are equivalent.
    expect(resolveConditionPath({ a: [1, 2] }, "a.0")).toBe(1);
    expect(resolveConditionPath({ a: [1, 2] }, "a.x")).toBeUndefined();
  });

  it("resolves simple dot paths and trims segments", () => {
    expect(resolveConditionPath({ a: { b: 1 } }, "a.b")).toBe(1);
    expect(resolveConditionPath({ a: { b: 1 } }, " a . b ")).toBe(1);
    expect(resolveConditionPath({ a: { b: null } }, "a.b")).toBeNull();
  });

  it("supports bracket indexes into arrays (3.0.0)", () => {
    const scope = { items: [{ id: "a", tags: ["x", "y"] }, { id: "b" }], map: { "k": 1 } };
    expect(parseConditionPath("items[1].id")).toEqual(["items", "1", "id"]);
    expect(parseConditionPath("items[0].tags[1]")).toEqual(["items", "0", "tags", "1"]);
    expect(parseConditionPath("items[x]")).toBeNull();
    expect(parseConditionPath("")).toBeNull();
    expect(resolveConditionPath(scope, "items[1].id")).toBe("b");
    expect(resolveConditionPath(scope, "items[0].tags[1]")).toBe("y");
    expect(resolveConditionPath(scope, "items[5].id")).toBeUndefined();
    expect(resolveConditionPath(scope, "items.id")).toBeUndefined();
    expect(resolveConditionPath(scope, "map.k")).toBe(1);
  });

  it("enforces path limits", () => {
    const deep: Record<string, unknown> = {};
    let cur: Record<string, unknown> = deep;
    for (let i = 0; i < 11; i++) {
      const next: Record<string, unknown> = {};
      cur[`k${i}`] = i === 10 ? 1 : next;
      cur = next;
    }
    expect(resolveConditionPath(deep, "k0.k1.k2.k3.k4.k5.k6.k7.k8.k9.k10")).toBeUndefined();
    expect(resolveConditionPath({ a: 1 }, "a", { maxDepth: 1, maxPathLength: 200, maxSegmentLength: 80 })).toBe(1);
    expect(resolveConditionPath({ a: 1 }, "a", { maxDepth: 1, maxPathLength: 0, maxSegmentLength: 80 })).toBeUndefined();
    expect(resolveConditionPath({ abc: 1 }, "abc", { maxDepth: 1, maxPathLength: 200, maxSegmentLength: 2 })).toBeUndefined();
  });
});

describe("conditions.contract evaluateConditionLeaf", () => {
  it("throws CONFIG_ERROR on missing path/op", () => {
    expect(() => leafOn({}, { op: ConditionOperator.TRUE } as unknown as ConditionLeaf)).toThrow("missing path");
    expect(() => leafOn({}, { path: "a" } as unknown as ConditionLeaf)).toThrow("missing op");
    expect(thrownCode(() => leafOn({}, { path: "a" } as unknown as ConditionLeaf))).toBe(ExecutionErrorCode.CONFIG_ERROR);
  });

  it("appends the error subject", () => {
    expect(() => leafOn({}, { path: "a" } as unknown as ConditionLeaf)).toThrow("subject=test-subject");
  });

  it("evaluates NULL / NA / TRUE / FALSE strictly", () => {
    expect(leafOn({}, { path: "a", op: ConditionOperator.NULL })).toBe(true);
    expect(leafOn({ a: null }, { path: "a", op: ConditionOperator.NULL })).toBe(true);
    expect(leafOn({ a: 0 }, { path: "a", op: ConditionOperator.NULL })).toBe(false);

    expect(leafOn({ a: "NA" }, { path: "a", op: ConditionOperator.NA })).toBe(true);
    expect(leafOn({ a: "na" }, { path: "a", op: ConditionOperator.NA })).toBe(false);

    expect(leafOn({ a: true }, { path: "a", op: ConditionOperator.TRUE })).toBe(true);
    expect(leafOn({ a: "true" }, { path: "a", op: ConditionOperator.TRUE })).toBe(false);
    expect(leafOn({ a: false }, { path: "a", op: ConditionOperator.FALSE })).toBe(true);
    expect(leafOn({ a: 0 }, { path: "a", op: ConditionOperator.FALSE })).toBe(false);
  });

  it("evaluates text operators with trim/caseInsensitive normalization", () => {
    expect(leafOn({ a: "" }, { path: "a", op: ConditionOperator.EMPTY })).toBe(true);
    expect(leafOn({ a: "  " }, { path: "a", op: ConditionOperator.EMPTY, trim: true })).toBe(true);
    expect(leafOn({ a: "  " }, { path: "a", op: ConditionOperator.EMPTY })).toBe(false);
    expect(leafOn({ a: 1 }, { path: "a", op: ConditionOperator.NOT_EMPTY })).toBe(false);

    expect(leafOn({ a: "Hello World" }, { path: "a", op: ConditionOperator.CONTAINS, value1: "world", caseInsensitive: true })).toBe(true);
    expect(leafOn({ a: "Hello World" }, { path: "a", op: ConditionOperator.CONTAINS, value1: "world" })).toBe(false);
    expect(leafOn({ a: "Hello World" }, { path: "a", op: ConditionOperator.NOT_CONTAINS, value1: "xyz" })).toBe(true);
    expect(leafOn({ a: "Hello" }, { path: "a", op: ConditionOperator.STARTS_WITH, value1: "He" })).toBe(true);
    expect(leafOn({ a: "Hello" }, { path: "a", op: ConditionOperator.ENDS_WITH, value1: "lo" })).toBe(true);
    expect(leafOn({ a: "Hello" }, { path: "a", op: ConditionOperator.LENGTH_MIN, value1: 5 })).toBe(true);
    expect(leafOn({ a: "Hello" }, { path: "a", op: ConditionOperator.LENGTH_MAX, value1: 4 })).toBe(false);

    expect(() => leafOn({ a: "x" }, { path: "a", op: ConditionOperator.CONTAINS, value1: 1 })).toThrow("must be a string");
    expect(() => leafOn({ a: "x" }, { path: "a", op: ConditionOperator.LENGTH_MIN, value1: "5" })).toThrow("must be a finite number");
  });

  it("evaluates numeric operators only against finite numbers", () => {
    expect(leafOn({ a: 5 }, { path: "a", op: ConditionOperator.MORE_THAN, value1: 4 })).toBe(true);
    expect(leafOn({ a: "5" }, { path: "a", op: ConditionOperator.MORE_THAN, value1: 4 })).toBe(false);
    expect(leafOn({ a: 5 }, { path: "a", op: ConditionOperator.MORE_THAN_EQUAL, value1: 5 })).toBe(true);
    expect(leafOn({ a: 5 }, { path: "a", op: ConditionOperator.LESS_THAN, value1: 5 })).toBe(false);
    expect(leafOn({ a: 5 }, { path: "a", op: ConditionOperator.LESS_THAN_EQUAL, value1: 5 })).toBe(true);
    expect(leafOn({ a: 5 }, { path: "a", op: ConditionOperator.BETWEEN_RANGE, value1: 1, value2: 5 })).toBe(true);
    expect(leafOn({ a: 6 }, { path: "a", op: ConditionOperator.OUTSIDE_RANGE, value1: 1, value2: 5 })).toBe(true);
    expect(() => leafOn({ a: 6 }, { path: "a", op: ConditionOperator.BETWEEN_RANGE, value1: 5, value2: 1 })).toThrow("min must be <= max");
    expect(() => leafOn({ a: 6 }, { path: "a", op: ConditionOperator.BETWEEN_RANGE, value1: 1 })).toThrow("value2");
  });

  it("evaluates percentage operators against a baseline", () => {
    // 110 vs baseline 100 = +10%
    expect(leafOn({ a: 110 }, { path: "a", op: ConditionOperator.PERCENTAGE_MORE_THAN, value1: 100, value2: 5 })).toBe(true);
    expect(leafOn({ a: 110 }, { path: "a", op: ConditionOperator.PERCENTAGE_MORE_THAN, value1: 100, value2: 10 })).toBe(false);
    expect(leafOn({ a: 110 }, { path: "a", op: ConditionOperator.PERCENTAGE_MORE_THAN_EQUAL, value1: 100, value2: 10 })).toBe(true);
    // 90 vs baseline 100 = -10%
    expect(leafOn({ a: 90 }, { path: "a", op: ConditionOperator.PERCENTAGE_LESS_THAN, value1: 100, value2: 5 })).toBe(true);
    expect(leafOn({ a: 90 }, { path: "a", op: ConditionOperator.PERCENTAGE_LESS_THAN_EQUAL, value1: 100, value2: 10 })).toBe(true);
    expect(leafOn({ a: 90 }, { path: "a", op: ConditionOperator.PERCENTAGE_LESS_THAN, value1: 100, value2: 10 })).toBe(false);
    // Ranges are inclusive on the signed change.
    expect(leafOn({ a: 90 }, { path: "a", op: ConditionOperator.PERCENTAGE_BETWEEN_RANGE, value1: 100, value2: -10, value3: 30 })).toBe(true);
    expect(leafOn({ a: 140 }, { path: "a", op: ConditionOperator.PERCENTAGE_OUTSIDE_RANGE, value1: 100, value2: -10, value3: 30 })).toBe(true);
    // Zero baseline: any move off zero is an infinite change.
    expect(leafOn({ a: 1 }, { path: "a", op: ConditionOperator.PERCENTAGE_MORE_THAN, value1: 0, value2: 1000 })).toBe(true);
    expect(leafOn({ a: 0 }, { path: "a", op: ConditionOperator.PERCENTAGE_MORE_THAN, value1: 0, value2: 0 })).toBe(false);
    // Non-numeric observed never matches; misconfigured parameters throw.
    expect(leafOn({ a: "110" }, { path: "a", op: ConditionOperator.PERCENTAGE_MORE_THAN, value1: 100, value2: 5 })).toBe(false);
    expect(() => leafOn({ a: 1 }, { path: "a", op: ConditionOperator.PERCENTAGE_BETWEEN_RANGE, value1: 100, value2: 30, value3: -10 })).toThrow("min must be <= max");
    expect(() => leafOn({ a: 1 }, { path: "a", op: ConditionOperator.PERCENTAGE_MORE_THAN, value1: "100", value2: 5 })).toThrow("must be a finite number");
  });

  it("evaluates EQUALS / NOT_EQUALS strictly", () => {
    expect(leafOn({ a: "ES" }, { path: "a", op: ConditionOperator.EQUALS, value1: "ES" })).toBe(true);
    expect(leafOn({ a: 1 }, { path: "a", op: ConditionOperator.EQUALS, value1: "1" })).toBe(false);
    expect(leafOn({ a: 1 }, { path: "a", op: ConditionOperator.NOT_EQUALS, value1: "1" })).toBe(true);
    expect(leafOn({ a: null }, { path: "a", op: ConditionOperator.EQUALS, value1: null })).toBe(true);
    expect(() => leafOn({ a: 1 }, { path: "a", op: ConditionOperator.EQUALS, value1: { x: 1 } as unknown as string })).toThrow("must be string|number|boolean|null");
  });

  it("evaluates IN / NOT_IN membership from a comma-separated list", () => {
    const list = " ANNUAL, MONTHLY ,,";
    expect(leafOn({ a: "ANNUAL" }, { path: "a", op: ConditionOperator.IN, value1: list })).toBe(true);
    expect(leafOn({ a: "WEEKLY" }, { path: "a", op: ConditionOperator.IN, value1: list })).toBe(false);
    expect(leafOn({ a: "WEEKLY" }, { path: "a", op: ConditionOperator.NOT_IN, value1: list })).toBe(true);
    expect(leafOn({ a: 2 }, { path: "a", op: ConditionOperator.IN, value1: "1,2,3" })).toBe(true);
    expect(leafOn({ a: true }, { path: "a", op: ConditionOperator.IN, value1: "true" })).toBe(true);
    expect(leafOn({ a: { x: 1 } }, { path: "a", op: ConditionOperator.IN, value1: "x" })).toBe(false);
    expect(leafOn({ a: { x: 1 } }, { path: "a", op: ConditionOperator.NOT_IN, value1: "x" })).toBe(true);
    expect(() => leafOn({ a: 1 }, { path: "a", op: ConditionOperator.IN, value1: 1 })).toThrow("must be a string");
  });

  it("evaluates VALID_URL for absolute URLs only", () => {
    expect(leafOn({ a: "https://dcdr.ai/x" }, { path: "a", op: ConditionOperator.VALID_URL })).toBe(true);
    expect(leafOn({ a: "/relative" }, { path: "a", op: ConditionOperator.VALID_URL })).toBe(false);
    expect(leafOn({ a: "" }, { path: "a", op: ConditionOperator.VALID_URL })).toBe(false);
    expect(leafOn({ a: 1 }, { path: "a", op: ConditionOperator.VALID_URL })).toBe(false);
  });

  it("evaluates INCORRECT with and without a type hint", () => {
    expect(leafOn({}, { path: "a", op: ConditionOperator.INCORRECT })).toBe(false);
    expect(leafOn({ a: 1 }, { path: "a", op: ConditionOperator.INCORRECT, value1: "x" })).toBe(true);
    expect(leafOn({ a: "1" }, { path: "a", op: ConditionOperator.INCORRECT, value1: "x" })).toBe(false);
    expect(leafOn({ a: "1" }, { path: "a", op: ConditionOperator.INCORRECT, value1: 1 })).toBe(true);
    expect(leafOn({ a: Number.NaN }, { path: "a", op: ConditionOperator.INCORRECT, value1: 1 })).toBe(true);
    expect(leafOn({ a: 1 }, { path: "a", op: ConditionOperator.INCORRECT, value1: true })).toBe(true);
    expect(leafOn({ a: "x" }, { path: "a", op: ConditionOperator.INCORRECT, value1: null })).toBe(true);
    expect(leafOn({ a: { x: 1 } }, { path: "a", op: ConditionOperator.INCORRECT })).toBe(true);
    expect(leafOn({ a: "x" }, { path: "a", op: ConditionOperator.INCORRECT })).toBe(false);
  });

  it("evaluates array operators", () => {
    const scope = { list: ["a", 2, true], empty: [], text: "abc" };
    expect(leafOn(scope, { path: "list", op: ConditionOperator.ARRAY_CONTAINS, value1: "a" })).toBe(true);
    expect(leafOn(scope, { path: "list", op: ConditionOperator.ARRAY_CONTAINS, value1: 2 })).toBe(true);
    expect(leafOn(scope, { path: "list", op: ConditionOperator.ARRAY_CONTAINS, value1: "2" })).toBe(false);
    expect(leafOn(scope, { path: "list", op: ConditionOperator.ARRAY_NOT_CONTAINS, value1: "z" })).toBe(true);
    expect(leafOn(scope, { path: "text", op: ConditionOperator.ARRAY_CONTAINS, value1: "a" })).toBe(false);
    expect(leafOn(scope, { path: "empty", op: ConditionOperator.ARRAY_EMPTY })).toBe(true);
    expect(leafOn(scope, { path: "list", op: ConditionOperator.ARRAY_EMPTY })).toBe(false);
    expect(leafOn(scope, { path: "text", op: ConditionOperator.ARRAY_NOT_EMPTY })).toBe(false);
    expect(leafOn(scope, { path: "list", op: ConditionOperator.ARRAY_NOT_EMPTY })).toBe(true);
    expect(leafOn(scope, { path: "list", op: ConditionOperator.ARRAY_LENGTH_MIN, value1: 3 })).toBe(true);
    expect(leafOn(scope, { path: "list", op: ConditionOperator.ARRAY_LENGTH_MAX, value1: 2 })).toBe(false);
    expect(() => leafOn(scope, { path: "list", op: ConditionOperator.ARRAY_LENGTH_MIN, value1: "3" })).toThrow("must be a finite number");
  });

  it("evaluates bounded regular expressions", () => {
    expect(leafOn({ a: "ABC-123" }, { path: "a", op: ConditionOperator.MATCHES_REGEX, value1: "^[A-Z]+-\\d+$" })).toBe(true);
    expect(leafOn({ a: "abc-123" }, { path: "a", op: ConditionOperator.MATCHES_REGEX, value1: "^[A-Z]+-\\d+$" })).toBe(false);
    expect(leafOn({ a: "abc-123" }, { path: "a", op: ConditionOperator.MATCHES_REGEX, value1: "^[A-Z]+-\\d+$", caseInsensitive: true })).toBe(true);
    expect(leafOn({ a: " x " }, { path: "a", op: ConditionOperator.MATCHES_REGEX, value1: "^x$", trim: true })).toBe(true);
    expect(leafOn({ a: 5 }, { path: "a", op: ConditionOperator.MATCHES_REGEX, value1: "5" })).toBe(false);
    expect(leafOn({ a: "x".repeat(20_000) }, { path: "a", op: ConditionOperator.MATCHES_REGEX, value1: "x" })).toBe(false);
    expect(() => leafOn({ a: "x" }, { path: "a", op: ConditionOperator.MATCHES_REGEX, value1: "(a+)+$" })).toThrow("nested quantifier");
    expect(() => leafOn({ a: "x" }, { path: "a", op: ConditionOperator.MATCHES_REGEX, value1: "(a|aa)+" })).toThrow("nested quantifier");
    expect(() => leafOn({ a: "x" }, { path: "a", op: ConditionOperator.MATCHES_REGEX, value1: "[" })).toThrow("Invalid regular expression");
    expect(() => leafOn({ a: "x" }, { path: "a", op: ConditionOperator.MATCHES_REGEX, value1: "a".repeat(300) })).toThrow("exceeds");
  });

  it("reads parameters from the scope through valueNRef", () => {
    const scope = { total: 120, limit: 100, tags: ["a"], tag: "a", lo: 1, hi: 5, n: 3, missing: null };
    expect(leafOn(scope, { path: "total", op: ConditionOperator.MORE_THAN, value1Ref: "limit" })).toBe(true);
    expect(leafOn(scope, { path: "limit", op: ConditionOperator.MORE_THAN, value1Ref: "total" })).toBe(false);
    expect(leafOn(scope, { path: "n", op: ConditionOperator.BETWEEN_RANGE, value1Ref: "lo", value2Ref: "hi" })).toBe(true);
    expect(leafOn(scope, { path: "n", op: ConditionOperator.BETWEEN_RANGE, value1Ref: "lo", value2: 2 })).toBe(false);
    expect(leafOn(scope, { path: "tags", op: ConditionOperator.ARRAY_CONTAINS, value1Ref: "tag" })).toBe(true);
    expect(leafOn(scope, { path: "tag", op: ConditionOperator.EQUALS, value1Ref: "tag" })).toBe(true);
    // A ref resolving to nothing (or to a non-primitive) is a data gap: false, not CONFIG_ERROR.
    expect(leafOn(scope, { path: "total", op: ConditionOperator.MORE_THAN, value1Ref: "nope" })).toBe(false);
    expect(leafOn(scope, { path: "total", op: ConditionOperator.MORE_THAN, value1Ref: "missing" })).toBe(false);
    expect(leafOn(scope, { path: "total", op: ConditionOperator.MORE_THAN, value1Ref: "tags" })).toBe(false);
  });

  it("refuses AI-backed operators and unknown operators", () => {
    expect(() => leafOn({ a: "x" }, { path: "a", op: ConditionOperator.AI_CONTEXT_TEXT })).toThrow("AI-backed");
    expect(() => leafOn({ a: "x" }, { path: "a", op: "NOPE" as ConditionOperator })).toThrow("Unsupported condition op");
  });
});

describe("conditions.contract evaluateConditionTree", () => {
  const scope = { country: "ES", amount: 10, tags: { vip: true } };

  it("treats a missing root as always true", () => {
    expect(evaluateConditionTreeOnScope(scope, null)).toBe(true);
    expect(evaluateConditionTreeOnScope(scope, undefined)).toBe(true);
  });

  it("evaluates AND / OR / NOT with short-circuit", () => {
    const and: ConditionGroup = {
      op: ConditionLogicOp.AND,
      conditions: [
        { path: "country", op: ConditionOperator.EQUALS, value1: "ES" },
        { path: "amount", op: ConditionOperator.MORE_THAN, value1: 5 },
      ],
    };
    expect(evaluateConditionTreeOnScope(scope, and)).toBe(true);

    const or: ConditionGroup = {
      op: ConditionLogicOp.OR,
      conditions: [
        { path: "country", op: ConditionOperator.EQUALS, value1: "US" },
        { path: "tags.vip", op: ConditionOperator.TRUE },
      ],
    };
    expect(evaluateConditionTreeOnScope(scope, or)).toBe(true);

    const not: ConditionGroup = { op: ConditionLogicOp.NOT, conditions: [or] };
    expect(evaluateConditionTreeOnScope(scope, not)).toBe(false);

    // Short-circuit: the misconfigured second leaf is never reached.
    const shortCircuit: ConditionGroup = {
      op: ConditionLogicOp.AND,
      conditions: [
        { path: "country", op: ConditionOperator.EQUALS, value1: "US" },
        { path: "amount", op: ConditionOperator.MORE_THAN, value1: "bad" },
      ],
    };
    expect(evaluateConditionTreeOnScope(scope, shortCircuit)).toBe(false);
  });

  it("throws CONFIG_ERROR for invalid boolean nodes", () => {
    expect(() => evaluateConditionTreeOnScope(scope, { op: ConditionLogicOp.AND, conditions: [] })).toThrow("AND");
    expect(() => evaluateConditionTreeOnScope(scope, { op: ConditionLogicOp.OR })).toThrow("OR");
    expect(() => evaluateConditionTreeOnScope(scope, { op: ConditionLogicOp.NOT, conditions: [] })).toThrow("NOT");
    expect(() =>
      evaluateConditionTreeOnScope(scope, {
        op: ConditionLogicOp.NOT,
        conditions: [
          { path: "amount", op: ConditionOperator.TRUE },
          { path: "amount", op: ConditionOperator.FALSE },
        ],
      }),
    ).toThrow("NOT");
    expect(thrownCode(() => evaluateConditionTreeOnScope(scope, { op: ConditionLogicOp.AND }))).toBe(
      ExecutionErrorCode.CONFIG_ERROR,
    );
  });

  it("enforces depth and node limits", () => {
    let deep: ConditionGroup = {
      op: ConditionLogicOp.NOT,
      conditions: [{ path: "tags.vip", op: ConditionOperator.TRUE }],
    };
    for (let i = 0; i < 25; i++) {
      deep = { op: ConditionLogicOp.NOT, conditions: [deep] };
    }
    expect(() => evaluateConditionTreeOnScope(scope, deep)).toThrow("too deep");

    const wide: ConditionGroup = {
      op: ConditionLogicOp.OR,
      conditions: Array.from({ length: 300 }, () => ({ path: "country", op: ConditionOperator.EQUALS, value1: "US" })),
    };
    expect(() => evaluateConditionTreeOnScope(scope, wide)).toThrow("too large");
    expect(() =>
      evaluateConditionTreeOnScope(scope, wide, { limits: { maxDepth: 20, maxNodes: 1000 } }),
    ).not.toThrow();
  });

  it("supports domain-specific leaves through the leaf callback", () => {
    interface FlagLeaf {
      flag: string;
    }
    const tree: ConditionGroup<FlagLeaf> = {
      op: ConditionLogicOp.AND,
      conditions: [{ flag: "a" }, { op: ConditionLogicOp.NOT, conditions: [{ flag: "b" }] }],
    };
    const flags = new Set(["a"]);
    expect(evaluateConditionTree<FlagLeaf>(tree, (leaf) => flags.has(leaf.flag))).toBe(true);
    expect(isConditionGroup<FlagLeaf>(tree)).toBe(true);
    expect(isConditionGroup<FlagLeaf>({ flag: "a" })).toBe(false);
  });
});

describe("conditions.contract validateConditionTree", () => {
  it("accepts a missing root and a well-formed tree", () => {
    expect(validateConditionTree(null).valid).toBe(true);
    const result = validateConditionTree({
      op: ConditionLogicOp.AND,
      conditions: [
        { path: "country", op: ConditionOperator.EQUALS, value1: "ES" },
        {
          op: ConditionLogicOp.NOT,
          conditions: [{ path: "amount", op: ConditionOperator.BETWEEN_RANGE, value1: 1, value2: 2 }],
        },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.depth).toBe(2);
    expect(result.nodesSeen).toBe(4);
  });

  it("reports structural issues with addressed paths", () => {
    const result = validateConditionTree({
      op: ConditionLogicOp.AND,
      conditions: [
        { op: ConditionLogicOp.NOT, conditions: [] },
        { op: ConditionLogicOp.OR, conditions: [] },
        { op: ConditionLogicOp.OR } as ConditionGroup,
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => [i.path, i.code])).toEqual([
      ["condition.conditions[0].conditions", ConditionValidationIssueCode.GROUP_INVALID_CHILD_COUNT],
      ["condition.conditions[1].conditions", ConditionValidationIssueCode.GROUP_INVALID_CHILD_COUNT],
      ["condition.conditions[2].conditions", ConditionValidationIssueCode.GROUP_MISSING_CONDITIONS],
    ]);
  });

  it("reports leaf issues: path, operator, arity, value and flag types", () => {
    const result = validateConditionTree(
      {
        op: ConditionLogicOp.AND,
        conditions: [
          { path: "", op: ConditionOperator.TRUE },
          { path: "a", op: "NOPE" as ConditionOperator },
          { path: "a", op: ConditionOperator.BETWEEN_RANGE, value1: 1 },
          { path: "a", op: ConditionOperator.PERCENTAGE_BETWEEN_RANGE, value1: 1, value2: 2 },
          { path: "a", op: ConditionOperator.EQUALS, value1: { x: 1 } as unknown as string, caseInsensitive: "yes" as unknown as boolean },
          { path: "a", op: ConditionOperator.AI_CONTEXT_TEXT },
          { path: "a.b.c.d.e.f.g.h.i.j.k", op: ConditionOperator.TRUE },
        ],
      },
      { rootPath: "root" },
    );
    expect(result.valid).toBe(false);
    const codes = result.issues.map((i) => `${i.path}:${i.code}`);
    expect(codes).toEqual([
      `root.conditions[0].path:${ConditionValidationIssueCode.LEAF_MISSING_PATH}`,
      `root.conditions[1].op:${ConditionValidationIssueCode.LEAF_UNSUPPORTED_OPERATOR}`,
      `root.conditions[2].value2:${ConditionValidationIssueCode.LEAF_MISSING_VALUE}`,
      `root.conditions[3].value3:${ConditionValidationIssueCode.LEAF_MISSING_VALUE}`,
      `root.conditions[4].value1:${ConditionValidationIssueCode.LEAF_INVALID_VALUE}`,
      `root.conditions[4].caseInsensitive:${ConditionValidationIssueCode.LEAF_INVALID_FLAG}`,
      `root.conditions[5].op:${ConditionValidationIssueCode.LEAF_OPERATOR_NOT_ALLOWED}`,
      `root.conditions[6].path:${ConditionValidationIssueCode.LEAF_PATH_TOO_LONG}`,
    ]);
  });

  it("validates value refs and regex patterns", () => {
    const result = validateConditionTree({
      op: ConditionLogicOp.AND,
      conditions: [
        { path: "a", op: ConditionOperator.MORE_THAN, value1Ref: "limit" },
        { path: "a", op: ConditionOperator.MORE_THAN, value1: 1, value1Ref: "limit" },
        { path: "a", op: ConditionOperator.MORE_THAN, value1Ref: "bad[" },
        { path: "a", op: ConditionOperator.BETWEEN_RANGE, value1Ref: "lo" },
        { path: "a", op: ConditionOperator.MATCHES_REGEX, value1: "(a+)+" },
        { path: "a", op: ConditionOperator.MATCHES_REGEX, value1: "[" },
        { path: "items[0].id", op: ConditionOperator.EQUALS, value1: "x" },
      ],
    });
    expect(result.issues.map((i) => `${i.path}:${i.code}`)).toEqual([
      `condition.conditions[1].value1Ref:${ConditionValidationIssueCode.LEAF_INVALID_VALUE_REF}`,
      `condition.conditions[2].value1Ref:${ConditionValidationIssueCode.LEAF_INVALID_VALUE_REF}`,
      `condition.conditions[3].value2:${ConditionValidationIssueCode.LEAF_MISSING_VALUE}`,
      `condition.conditions[4].value1:${ConditionValidationIssueCode.LEAF_INVALID_VALUE}`,
      `condition.conditions[5].value1:${ConditionValidationIssueCode.LEAF_INVALID_VALUE}`,
    ]);
  });

  it("lets hosts opt in to AI operators and restrict the allowed set", () => {
    const aiLeaf: ConditionLeaf = { path: "a", op: ConditionOperator.AI_CONTEXT_TEXT };
    expect(validateConditionTree(aiLeaf, { allowedOperators: [ConditionOperator.AI_CONTEXT_TEXT] }).valid).toBe(true);
    const restricted = validateConditionTree(
      { path: "a", op: ConditionOperator.EQUALS, value1: "x" },
      { allowedOperators: [ConditionOperator.TRUE] },
    );
    expect(restricted.valid).toBe(false);
    expect(restricted.issues[0]?.code).toBe(ConditionValidationIssueCode.LEAF_OPERATOR_NOT_ALLOWED);
  });

  it("stops descending once limits are exceeded", () => {
    let deep: ConditionGroup = { op: ConditionLogicOp.NOT, conditions: [{ path: "a", op: ConditionOperator.TRUE }] };
    for (let i = 0; i < 25; i++) {
      deep = { op: ConditionLogicOp.NOT, conditions: [deep] };
    }
    const tooDeep = validateConditionTree(deep);
    expect(tooDeep.valid).toBe(false);
    expect(tooDeep.issues).toHaveLength(1);
    expect(tooDeep.issues[0]?.code).toBe(ConditionValidationIssueCode.TREE_TOO_DEEP);

    const wide: ConditionGroup = {
      op: ConditionLogicOp.OR,
      conditions: Array.from({ length: 300 }, () => ({ path: "a", op: ConditionOperator.TRUE })),
    };
    const tooLarge = validateConditionTree(wide);
    expect(tooLarge.valid).toBe(false);
    expect(tooLarge.issues).toHaveLength(1);
    expect(tooLarge.issues[0]?.code).toBe(ConditionValidationIssueCode.TREE_TOO_LARGE);
    expect(tooLarge.nodesSeen).toBe(DEFAULT_CONDITION_TREE_LIMITS.maxNodes + 1);
  });

  it("rejects non-object nodes", () => {
    const result = validateConditionTree({
      op: ConditionLogicOp.AND,
      conditions: ["nope" as unknown as ConditionLeaf],
    });
    expect(result.issues[0]?.code).toBe(ConditionValidationIssueCode.NODE_INVALID);
  });
});

import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { ConditionLogicOp, ConditionOperator } from "../src/conditions.contract";
import { PromptVariableType } from "../src/prompts.contract";
import { WORKFLOW_CAPABILITIES, WORKFLOW_IMPLEMENTED_CAPABILITIES, WorkflowCapabilityBroker, findWorkflowCapability } from "../src/workflow.capabilities.contract";
import {
  applyWorkflowMappingFunction,
  canonicalizeWorkflowDefinition,
  computeWorkflowDefinitionSha256,
  DEFAULT_WORKFLOW_VALIDATION_CAPS,
  evaluateLocalWorkflowState,
  formatWorkflowDefinitionShorthand,
  WORKFLOW_APPROVAL_FORM,
  WORKFLOW_APPROVAL_REJECTED_CODE,
  formatWorkflowValueShorthand,
  inferWorkflowStateOutputSchema,
  isHostExecutedWorkflowState,
  listWorkflowConnections,
  listWorkflowIntents,
  listWorkflowTemplateRefs,
  parseWorkflowDefinitionShorthand,
  parseWorkflowRefPath,
  parseWorkflowValueShorthand,
  renderWorkflowTemplate,
  resolveWorkflowRef,
  resolveWorkflowTransition,
  resolveWorkflowValue,
  resolveWorkflowValueRecord,
  selectChoiceNext,
  validateWorkflowDefinition,
  workflowCanPark,
  WORKFLOW_MAPPING_FUNCTION_META,
  WorkflowDefinition,
  WorkflowEndOutcome,
  WorkflowHttpMethod,
  WorkflowHttpResponseType,
  WorkflowMappingFunction,
  WorkflowRefRoot,
  WorkflowQcFailAction,
  WorkflowSchemaVersion,
  WorkflowState,
  WorkflowStateErrorAction,
  WorkflowStateOutcome,
  WorkflowStateOutcomeStatus,
  WorkflowStateRunStatus,
  WorkflowStateSnapshot,
  WorkflowStateType,
  WorkflowTransitionKind,
  WorkflowValidationContext,
  WorkflowAgentStopReason,
  WorkflowEvidenceKind,
  WorkflowValidationIntent,
  WorkflowValidationIssueCode,
  listWorkflowSubworkflows,
  validateWorkflowValueAgainstSchema,
  WorkflowValueContext,
  WorkflowValueKind,
  WorkflowValueNode,
  WorkflowDateUnit,
  WorkflowAgentToolKind,
  WORKFLOW_AGENT_TOOL_STATE_TYPES,
  WORKFLOW_ADVANCED_STATE_TYPES,
  workflowUsesAdvancedStates,
  WorkflowAgentAction,
} from "../src/workflow.contract";
import type { WorkflowAgentDecision, WorkflowAgentDecisionPayload } from "../src/workflow.contract";

/** Shape of the golden fixture file. */
interface GoldenCase {
  name: string;
  input: Record<string, unknown>;
  hostOutputs?: Record<string, unknown>;
  hostFailures?: Record<string, { code: string; message: string }>;
  expected: {
    trail: string[];
    choice?: Record<string, string | null>;
    resolvedVars?: Record<string, Record<string, unknown>>;
    resolvedHttp?: Record<string, { path?: string; body?: unknown }>;
    stateStatus?: Record<string, string>;
    transformOutputs?: Record<string, unknown>;
    endOutcome: string;
    runOutput: unknown;
  };
}

interface GoldenFixture {
  intents: WorkflowValidationIntent[];
  connections: string[];
  definition: unknown;
  cases: GoldenCase[];
}

/** Result of the reference walker. */
interface ReferenceRunResult {
  trail: string[];
  choices: Record<string, string | null>;
  resolvedVars: Record<string, Record<string, unknown>>;
  resolvedHttp: Record<string, { path: string; body?: unknown }>;
  transformOutputs: Record<string, unknown>;
  states: Record<string, WorkflowStateSnapshot>;
  endOutcome?: WorkflowEndOutcome;
  runOutput?: unknown;
  failed: boolean;
}

const sha256Deps = { sha256Hex: (value: string) => createHash("sha256").update(value, "utf8").digest("hex") };

/**
 * Loads the golden fixture from disk.
 */
function loadGolden(): GoldenFixture {
  const file = path.resolve(__dirname, "fixtures", "workflows", "support_ticket_triage.golden.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as GoldenFixture;
}

/**
 * Builds a value context for a run.
 */
function makeCtx(input: Record<string, unknown>, states: Record<string, WorkflowStateSnapshot> = {}, constants?: Record<string, string | number | boolean | null>): WorkflowValueContext {
  return {
    input,
    states,
    constants,
    run: { id: "run-1", startedAt: "2026-09-06T00:00:00.000Z", attempt: 1 },
    workflow: { key: "SUPPORT_TRIAGE", version: 1 },
    now: () => Date.UTC(2026, 8, 6, 12, 0, 0),
  };
}

/**
 * Reference walker: what every host must reproduce. Host-executed states take their outputs from
 * the golden case; local states are evaluated by the contract.
 */
function referenceRun(definition: WorkflowDefinition, goldenCase: GoldenCase): ReferenceRunResult {
  const result: ReferenceRunResult = {
    trail: [],
    choices: {},
    resolvedVars: {},
    resolvedHttp: {},
    transformOutputs: {},
    states: {},
    failed: false,
  };
  let current: string | undefined = definition.startAt;
  let transitions = 0;

  while (current) {
    if (++transitions > definition.settings.maxTransitionsPerRun) throw new Error("loop guard");
    const state: WorkflowState = definition.states[current];
    result.trail.push(current);
    const ctx = makeCtx(goldenCase.input, result.states, definition.constants);

    let outcome: WorkflowStateOutcome;
    if (isHostExecutedWorkflowState(state.type)) {
      if (state.type === WorkflowStateType.INTENT && state.intent) {
        result.resolvedVars[current] = resolveWorkflowValueRecord(state.intent.vars, ctx);
      }
      if (state.type === WorkflowStateType.HTTP && state.http) {
        const resolvedPath = String(resolveWorkflowValue(state.http.path, ctx));
        const body = state.http.body ? resolveWorkflowValue(state.http.body, ctx) : undefined;
        result.resolvedHttp[current] = body === undefined ? { path: resolvedPath } : { path: resolvedPath, body };
      }
      const failure = goldenCase.hostFailures?.[current];
      outcome = failure
        ? { status: WorkflowStateOutcomeStatus.FAILED, error: failure }
        : { status: WorkflowStateOutcomeStatus.COMPLETED, output: goldenCase.hostOutputs?.[current] ?? null };
    } else {
      outcome = evaluateLocalWorkflowState(state, ctx, current);
      if (state.type === WorkflowStateType.TRANSFORM) result.transformOutputs[current] = outcome.output;
    }

    const transition = resolveWorkflowTransition(definition, current, outcome, ctx);
    result.states[current] = transition.snapshot;
    if (state.type === WorkflowStateType.CHOICE) result.choices[current] = transition.caseId ?? null;

    switch (transition.kind) {
      case WorkflowTransitionKind.CONTINUE:
      case WorkflowTransitionKind.ERROR_HANDLED:
        current = transition.next;
        break;
      case WorkflowTransitionKind.END:
        result.endOutcome = transition.endOutcome;
        result.runOutput = transition.runOutput;
        current = undefined;
        break;
      default:
        result.failed = true;
        current = undefined;
        break;
    }
  }
  return result;
}

/**
 * Minimal valid definition used as a base for validation tests.
 */
function baseDefinition(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    schemaVersion: WorkflowSchemaVersion.V1,
    key: "TEST_FLOW",
    name: "Test flow",
    settings: { timeoutMs: 60_000, maxTransitionsPerRun: 50 },
    startAt: "start",
    states: {
      start: {
        type: WorkflowStateType.TRANSFORM,
        next: "done",
        transform: { output: { kind: WorkflowValueKind.LITERAL, literal: 1 } },
      },
      done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
    },
    ...overrides,
  };
}

/**
 * Returns `path:code` labels of the issues found for a definition.
 */
function issueLabels(definition: WorkflowDefinition, context?: WorkflowValidationContext): string[] {
  return validateWorkflowDefinition(definition, context).issues.map((i) => `${i.path}:${i.code}`);
}

describe("workflow.contract value shorthand", () => {
  it("parses scalars, refs, functions, templates, objects and arrays", () => {
    const node = parseWorkflowValueShorthand({
      literal: "x",
      n: 2,
      ref: { $ref: "input.a", default: "d" },
      fn: { $fn: "CONCAT", args: ["a", { $ref: "input.b" }] },
      tpl: { $template: "hi {{input.name}}" },
      list: [1, { $ref: "input.c" }],
      nested: { deep: { $fn: "NOW_ISO" } },
    });
    expect(node.kind).toBe(WorkflowValueKind.OBJECT);
    expect(node.object?.literal).toEqual({ kind: WorkflowValueKind.LITERAL, literal: "x" });
    expect(node.object?.ref).toEqual({ kind: WorkflowValueKind.REF, ref: "input.a", default: "d" });
    expect(node.object?.fn?.kind).toBe(WorkflowValueKind.FN);
    expect(node.object?.fn?.args?.[1]).toEqual({ kind: WorkflowValueKind.REF, ref: "input.b" });
    expect(node.object?.tpl).toEqual({ kind: WorkflowValueKind.TEMPLATE, template: "hi {{input.name}}" });
    expect(node.object?.list?.kind).toBe(WorkflowValueKind.ARRAY);
    expect(node.object?.nested?.object?.deep).toEqual({ kind: WorkflowValueKind.FN, fn: "NOW_ISO", args: [] });
  });

  it("round-trips through format", () => {
    const shorthand = { a: { $ref: "input.a" }, b: [1, "x", null], c: { $template: "t" }, d: { $fn: "TRIM", args: [{ $ref: "input.s" }] } };
    expect(formatWorkflowValueShorthand(parseWorkflowValueShorthand(shorthand))).toEqual(shorthand);
  });

  it("passes typed nodes through and rejects unsupported shapes", () => {
    const typed: WorkflowValueNode = { kind: WorkflowValueKind.LITERAL, literal: 1 };
    expect(parseWorkflowValueShorthand(typed)).toBe(typed);
    expect(() => parseWorkflowValueShorthand({ $ref: "input.a", default: { x: 1 } })).toThrow("scalar");
    expect(() => parseWorkflowValueShorthand(() => 1)).toThrow("Unsupported");
  });
});

describe("workflow.contract references and templates", () => {
  const ctx = makeCtx(
    { user: { name: "Ana", tags: ["a", "b"] }, n: 3 },
    { s1: { status: WorkflowStateRunStatus.COMPLETED, output: { items: [{ id: 1 }, { id: 2 }], text: "ok" } } },
  );

  it("parses the reference grammar", () => {
    expect(parseWorkflowRefPath("input.user.name")).toEqual({ root: WorkflowRefRoot.INPUT, segments: ["user", "name"] });
    expect(parseWorkflowRefPath("states.s1.output.items[1].id")).toEqual({ root: WorkflowRefRoot.STATES, segments: ["s1", "output", "items", "1", "id"] });
    expect(parseWorkflowRefPath("item.index")).toEqual({ root: WorkflowRefRoot.ITEM, segments: ["index"] });
    expect(parseWorkflowRefPath("nope.a")).toBeNull();
    expect(parseWorkflowRefPath("input..a")).toBeNull();
    expect(parseWorkflowRefPath("input.a[")).toBeNull();
    expect(parseWorkflowRefPath("input." + "a.".repeat(20) + "z")).toBeNull();
  });

  it("resolves every root", () => {
    expect(resolveWorkflowRef("input.user.name", ctx)).toBe("Ana");
    expect(resolveWorkflowRef("input.user.tags[1]", ctx)).toBe("b");
    expect(resolveWorkflowRef("states.s1.output.items[1].id", ctx)).toBe(2);
    expect(resolveWorkflowRef("states.s1.status", ctx)).toBe("COMPLETED");
    expect(resolveWorkflowRef("states.missing.output", ctx)).toBeUndefined();
    expect(resolveWorkflowRef("run.id", ctx)).toBe("run-1");
    expect(resolveWorkflowRef("workflow.version", ctx)).toBe(1);
    expect(resolveWorkflowRef("item.index", ctx)).toBeUndefined();
    expect(resolveWorkflowRef("item.value.x", { ...ctx, item: { value: { x: 9 }, index: 4 } })).toBe(9);
    expect(resolveWorkflowRef("item.index", { ...ctx, item: { value: null, index: 4 } })).toBe(4);
    expect(resolveWorkflowRef("input.user.tags.x", ctx)).toBeUndefined();
  });

  it("plucks with [*] and reads constants", () => {
    expect(parseWorkflowRefPath("states.s1.output.items[*].id")).toEqual({ root: WorkflowRefRoot.STATES, segments: ["s1", "output", "items", "*", "id"] });
    expect(resolveWorkflowRef("states.s1.output.items[*].id", ctx)).toEqual([1, 2]);
    expect(resolveWorkflowRef("states.s1.output.items[*].missing", ctx)).toEqual([]);
    expect(resolveWorkflowRef("input.user.tags[*]", ctx)).toEqual(["a", "b"]);
    expect(resolveWorkflowRef("input.n[*]", ctx)).toBeUndefined();
    const withConstants = { ...ctx, constants: { region: "EU", retries: 3 } };
    expect(resolveWorkflowRef("constants.region", withConstants)).toBe("EU");
    expect(resolveWorkflowRef("constants.retries", withConstants)).toBe(3);
    expect(resolveWorkflowRef("constants.region", ctx)).toBeUndefined();
  });

  it("renders templates and lists their refs", () => {
    expect(renderWorkflowTemplate("Hi {{ input.user.name }}, {{states.s1.output.text}} {{{input.n}}} {{input.missing}}!", ctx)).toBe("Hi Ana, ok 3 !");
    expect(renderWorkflowTemplate("obj={{input.user.tags}}", ctx)).toBe('obj=["a","b"]');
    expect(listWorkflowTemplateRefs("{{a.b}} x {{ c }}")).toEqual(["a.b", "c"]);
  });
});

describe("workflow.contract value resolution", () => {
  const ctx = makeCtx({ s: "  Hi  ", n: "12.5", list: [1, 2, 3], obj: { a: 1, b: 2, c: 3 }, json: "{\"k\":1}" });

  it("resolves refs with defaults, objects and arrays", () => {
    const node = parseWorkflowValueShorthand({ a: { $ref: "input.s" }, b: { $ref: "input.missing", default: "dflt" }, c: { $ref: "input.missing" }, d: [{ $ref: "input.n" }] });
    expect(resolveWorkflowValue(node, ctx)).toEqual({ a: "  Hi  ", b: "dflt", c: null, d: ["12.5"] });
  });

  it("applies every mapping function", () => {
    const at = (fn: WorkflowMappingFunction, ...args: unknown[]): unknown => applyWorkflowMappingFunction(fn, args, ctx.now);
    expect(at(WorkflowMappingFunction.CONCAT, "a", 1, null, { x: 1 })).toBe('a1{"x":1}');
    expect(at(WorkflowMappingFunction.COALESCE, null, "", undefined, "v", "w")).toBe("v");
    expect(at(WorkflowMappingFunction.COALESCE, null)).toBeNull();
    expect(at(WorkflowMappingFunction.TO_UPPER, "ab")).toBe("AB");
    expect(at(WorkflowMappingFunction.TO_UPPER, 1)).toBeNull();
    expect(at(WorkflowMappingFunction.TO_LOWER, "AB")).toBe("ab");
    expect(at(WorkflowMappingFunction.TRIM, "  x ")).toBe("x");
    expect(at(WorkflowMappingFunction.TO_NUMBER, "12.5")).toBe(12.5);
    expect(at(WorkflowMappingFunction.TO_NUMBER, "x")).toBeNull();
    expect(at(WorkflowMappingFunction.TO_NUMBER, true)).toBe(1);
    expect(at(WorkflowMappingFunction.TO_STRING, 5)).toBe("5");
    expect(at(WorkflowMappingFunction.TO_STRING, null)).toBeNull();
    expect(at(WorkflowMappingFunction.TO_BOOLEAN, "yes")).toBe(true);
    expect(at(WorkflowMappingFunction.TO_BOOLEAN, "0")).toBe(false);
    expect(at(WorkflowMappingFunction.TO_BOOLEAN, "maybe")).toBeNull();
    expect(at(WorkflowMappingFunction.LENGTH, "abc")).toBe(3);
    expect(at(WorkflowMappingFunction.LENGTH, [1])).toBe(1);
    expect(at(WorkflowMappingFunction.LENGTH, { a: 1, b: 2 })).toBe(2);
    expect(at(WorkflowMappingFunction.LENGTH, 4)).toBeNull();
    expect(at(WorkflowMappingFunction.NOW_ISO)).toBe("2026-09-06T12:00:00.000Z");
    expect(at(WorkflowMappingFunction.JSON_STRINGIFY, { b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(at(WorkflowMappingFunction.JSON_PARSE, '{"k":1}')).toEqual({ k: 1 });
    expect(at(WorkflowMappingFunction.JSON_PARSE, "{bad")).toBeNull();
    expect(at(WorkflowMappingFunction.PICK, { a: 1, b: 2, c: 3 }, ["a", "c"])).toEqual({ a: 1, c: 3 });
    expect(at(WorkflowMappingFunction.OMIT, { a: 1, b: 2, c: 3 }, ["a"])).toEqual({ b: 2, c: 3 });
    expect(at(WorkflowMappingFunction.PICK, "x", ["a"])).toBeNull();
    expect(at(WorkflowMappingFunction.FIRST, [7, 8])).toBe(7);
    expect(at(WorkflowMappingFunction.LAST, [7, 8])).toBe(8);
    expect(at(WorkflowMappingFunction.FIRST, [])).toBeNull();
    expect(at(WorkflowMappingFunction.JOIN, ["a", 1], "-")).toBe("a-1");
    expect(at(WorkflowMappingFunction.JOIN, ["a", "b"])).toBe("a,b");
    expect(at(WorkflowMappingFunction.SPLIT, "a/b", "/")).toEqual(["a", "b"]);
    expect(at(WorkflowMappingFunction.ROUND, 3.14159, 2)).toBe(3.14);
    expect(at(WorkflowMappingFunction.ROUND, "2.5")).toBe(3);
    expect(at(WorkflowMappingFunction.SUM, [1, "2", true])).toBe(4);
    expect(at(WorkflowMappingFunction.SUM, [1, "x"])).toBeNull();
    expect(at(WorkflowMappingFunction.COUNT, [1, 2])).toBe(2);
    expect(at(WorkflowMappingFunction.COUNT, "x")).toBeNull();
  });

  it("applies arithmetic, logic, string, collection, date and encoding functions", () => {
    const at = (fn: WorkflowMappingFunction, ...args: unknown[]): unknown => applyWorkflowMappingFunction(fn, args, ctx.now);
    // Arithmetic
    expect(at(WorkflowMappingFunction.ADD, 1, "2", 3)).toBe(6);
    expect(at(WorkflowMappingFunction.ADD, 1, "x")).toBeNull();
    expect(at(WorkflowMappingFunction.SUBTRACT, 5, 2)).toBe(3);
    expect(at(WorkflowMappingFunction.MULTIPLY, 2, 3, 4)).toBe(24);
    expect(at(WorkflowMappingFunction.DIVIDE, 9, 3)).toBe(3);
    expect(at(WorkflowMappingFunction.DIVIDE, 9, 0)).toBeNull();
    expect(at(WorkflowMappingFunction.MODULO, 9, 4)).toBe(1);
    expect(at(WorkflowMappingFunction.MIN, 4, 2, 8)).toBe(2);
    expect(at(WorkflowMappingFunction.MAX, [4, 2, 8])).toBe(8);
    expect(at(WorkflowMappingFunction.MIN, [])).toBeNull();
    expect(at(WorkflowMappingFunction.ABS, -2)).toBe(2);
    expect(at(WorkflowMappingFunction.FLOOR, 2.7)).toBe(2);
    expect(at(WorkflowMappingFunction.CEIL, 2.1)).toBe(3);
    expect(at(WorkflowMappingFunction.AVERAGE, [1, 2, 3])).toBe(2);
    expect(at(WorkflowMappingFunction.AVERAGE, [])).toBeNull();
    // Logic
    expect(at(WorkflowMappingFunction.IF, true, "a", "b")).toBe("a");
    expect(at(WorkflowMappingFunction.IF, [], "a", "b")).toBe("b");
    expect(at(WorkflowMappingFunction.IF, "no", "a", "b")).toBe("a");
    expect(at(WorkflowMappingFunction.EQ, "1", 1)).toBe(true);
    expect(at(WorkflowMappingFunction.EQ, { a: 1 }, { a: 1 })).toBe(true);
    expect(at(WorkflowMappingFunction.EQ, null, undefined)).toBe(false);
    expect(at(WorkflowMappingFunction.NEQ, "a", "b")).toBe(true);
    expect(at(WorkflowMappingFunction.GT, 3, "2")).toBe(true);
    expect(at(WorkflowMappingFunction.GTE, "b", "a")).toBe(true);
    expect(at(WorkflowMappingFunction.LT, 1, 2)).toBe(true);
    expect(at(WorkflowMappingFunction.LTE, 2, 2)).toBe(true);
    expect(at(WorkflowMappingFunction.GT, "a", 1)).toBeNull();
    expect(at(WorkflowMappingFunction.AND, true, 1, "x")).toBe(true);
    expect(at(WorkflowMappingFunction.AND, true, 0)).toBe(false);
    expect(at(WorkflowMappingFunction.OR, false, null, "x")).toBe(true);
    expect(at(WorkflowMappingFunction.NOT, "")).toBe(true);
    expect(at(WorkflowMappingFunction.IS_NULL, null)).toBe(true);
    expect(at(WorkflowMappingFunction.IS_NULL, 0)).toBe(false);
    expect(at(WorkflowMappingFunction.IS_EMPTY, "")).toBe(true);
    expect(at(WorkflowMappingFunction.IS_EMPTY, {})).toBe(true);
    expect(at(WorkflowMappingFunction.IS_EMPTY, [1])).toBe(false);
    expect(at(WorkflowMappingFunction.IS_EMPTY, 0)).toBe(false);
    expect(at(WorkflowMappingFunction.INCLUDES, "hello", "ell")).toBe(true);
    expect(at(WorkflowMappingFunction.INCLUDES, [1, "2"], 2)).toBe(true);
    expect(at(WorkflowMappingFunction.INCLUDES, 5, 5)).toBeNull();
    // Strings
    expect(at(WorkflowMappingFunction.REPLACE, "a-b-c", "-", "+")).toBe("a+b+c");
    expect(at(WorkflowMappingFunction.REPLACE, "abc", "", "x")).toBe("abc");
    expect(at(WorkflowMappingFunction.SUBSTRING, "abcdef", 1, 3)).toBe("bcd");
    expect(at(WorkflowMappingFunction.SUBSTRING, "abcdef", 4)).toBe("ef");
    expect(at(WorkflowMappingFunction.PAD_START, 7, 3, "0")).toBe("007");
    expect(at(WorkflowMappingFunction.PAD_END, "ab", 4)).toBe("ab  ");
    // Collections
    expect(at(WorkflowMappingFunction.PLUCK, [{ a: { b: 1 } }, { a: { b: 2 } }, {}], "a.b")).toEqual([1, 2, null]);
    expect(at(WorkflowMappingFunction.MERGE, { a: 1, b: 1 }, { b: 2 }, "x")).toEqual({ a: 1, b: 2 });
    expect(at(WorkflowMappingFunction.KEYS, { a: 1, b: 2 })).toEqual(["a", "b"]);
    expect(at(WorkflowMappingFunction.VALUES, { a: 1, b: 2 })).toEqual([1, 2]);
    expect(at(WorkflowMappingFunction.GET, { a: { b: [5] } }, "a.b.0")).toBe(5);
    expect(at(WorkflowMappingFunction.GET, { a: 1 }, "z", "dflt")).toBe("dflt");
    expect(at(WorkflowMappingFunction.SLICE, [1, 2, 3, 4], 1, 3)).toEqual([2, 3]);
    expect(at(WorkflowMappingFunction.SLICE, "abcd", -2)).toBe("cd");
    expect(at(WorkflowMappingFunction.UNIQUE, [1, "1", 1, { a: 1 }, { a: 1 }])).toEqual([1, "1", { a: 1 }]);
    expect(at(WorkflowMappingFunction.FLATTEN, [[1, 2], 3, [[4]]])).toEqual([1, 2, 3, [4]]);
    expect(at(WorkflowMappingFunction.SORT, [3, 1, 2])).toEqual([1, 2, 3]);
    expect(at(WorkflowMappingFunction.SORT, [{ n: 2 }, { n: 1 }], "n")).toEqual([{ n: 1 }, { n: 2 }]);
    expect(at(WorkflowMappingFunction.SORT, ["b", "a"], null, true)).toEqual(["b", "a"]);
    expect(at(WorkflowMappingFunction.REVERSE, [1, 2])).toEqual([2, 1]);
    expect(at(WorkflowMappingFunction.REVERSE, "ab")).toBe("ba");
    expect(at(WorkflowMappingFunction.FILTER_BY, [{ t: "a", v: 1 }, { t: "b" }, { t: "a", v: 2 }], "t", "a")).toEqual([{ t: "a", v: 1 }, { t: "a", v: 2 }]);
    expect(at(WorkflowMappingFunction.FIND_BY, [{ t: "a", v: 1 }, { t: "b" }], "t", "b")).toEqual({ t: "b" });
    expect(at(WorkflowMappingFunction.FIND_BY, [{ t: "a" }], "t", "z")).toBeNull();
    expect(at(WorkflowMappingFunction.RANGE, 3)).toEqual([0, 1, 2]);
    expect(at(WorkflowMappingFunction.RANGE, 2, 5)).toEqual([2, 3, 4]);
    expect(at(WorkflowMappingFunction.RANGE, 5, 2)).toEqual([]);
    // Dates
    expect(at(WorkflowMappingFunction.DATE_ADD, "2026-09-06T00:00:00.000Z", 2, WorkflowDateUnit.DAYS)).toBe("2026-09-08T00:00:00.000Z");
    expect(at(WorkflowMappingFunction.DATE_ADD, "2026-09-06T00:00:00.000Z", 90, WorkflowDateUnit.MINUTES)).toBe("2026-09-06T01:30:00.000Z");
    expect(at(WorkflowMappingFunction.DATE_ADD, "nope", 1, WorkflowDateUnit.DAYS)).toBeNull();
    expect(at(WorkflowMappingFunction.DATE_ADD, "2026-09-06T00:00:00.000Z", 1, "WEEKS")).toBeNull();
    expect(at(WorkflowMappingFunction.DATE_DIFF, "2026-09-08T00:00:00.000Z", "2026-09-06T00:00:00.000Z", WorkflowDateUnit.HOURS)).toBe(48);
    expect(at(WorkflowMappingFunction.FORMAT_DATE, "2026-09-06T14:05:09.007Z", "YYYY-MM-DD HH:mm:ss.SSS")).toBe("2026-09-06 14:05:09.007");
    expect(at(WorkflowMappingFunction.FORMAT_DATE, 0, "DD/MM/YYYY")).toBe("01/01/1970");
    expect(at(WorkflowMappingFunction.PARSE_DATE, "2026-09-06")).toBe("2026-09-06T00:00:00.000Z");
    expect(at(WorkflowMappingFunction.PARSE_DATE, "not a date")).toBeNull();
    // Encoding
    expect(at(WorkflowMappingFunction.BASE64_ENCODE, "héllo")).toBe("aMOpbGxv");
    expect(at(WorkflowMappingFunction.BASE64_DECODE, "aMOpbGxv")).toBe("héllo");
    expect(at(WorkflowMappingFunction.BASE64_DECODE, "***")).toBeNull();
    expect(at(WorkflowMappingFunction.URL_ENCODE, "a b&c")).toBe("a%20b%26c");
    expect(at(WorkflowMappingFunction.URL_DECODE, "a%20b%26c")).toBe("a b&c");
    expect(at(WorkflowMappingFunction.URL_DECODE, "%E0%A4%A")).toBeNull();
  });

  it("has arity metadata for every function", () => {
    for (const fn of Object.values(WorkflowMappingFunction)) {
      const meta = WORKFLOW_MAPPING_FUNCTION_META[fn];
      expect(meta.fn).toBe(fn);
      expect(meta.minArgs).toBeGreaterThanOrEqual(0);
      if (meta.maxArgs !== null) expect(meta.maxArgs).toBeGreaterThanOrEqual(meta.minArgs);
    }
  });

  it("resolves nested function trees and templates through the context clock", () => {
    const node = parseWorkflowValueShorthand({
      when: { $fn: "NOW_ISO" },
      joined: { $fn: "JOIN", args: [{ $fn: "SPLIT", args: [{ $ref: "input.s" }, " "] }, "_"] },
      line: { $template: "n={{input.n}}" },
    });
    expect(resolveWorkflowValue(node, ctx)).toEqual({ when: "2026-09-06T12:00:00.000Z", joined: "__Hi__", line: "n=12.5" });
  });

  it("enforces value limits and rejects malformed nodes", () => {
    let deep: WorkflowValueNode = { kind: WorkflowValueKind.LITERAL, literal: 1 };
    for (let i = 0; i < 15; i++) deep = { kind: WorkflowValueKind.ARRAY, array: [deep] };
    expect(() => resolveWorkflowValue(deep, ctx)).toThrow("too deep");
    expect(() => resolveWorkflowValue({ kind: "NOPE" as WorkflowValueKind }, ctx)).toThrow("Unsupported value node kind");
    expect(() => resolveWorkflowValue({ kind: WorkflowValueKind.FN }, ctx)).toThrow("missing fn");
  });
});

describe("workflow.contract choices and transitions", () => {
  const definition = baseDefinition({
    startAt: "route",
    states: {
      route: {
        type: WorkflowStateType.CHOICE,
        choice: {
          choices: [
            { id: "high", condition: { path: "input.score", op: ConditionOperator.MORE_THAN, value1: 5 }, next: "flag" },
            { id: "named", condition: { op: ConditionLogicOp.NOT, conditions: [{ path: "input.name", op: ConditionOperator.NULL }] }, next: "greet" },
          ],
          default: "done",
        },
      },
      flag: {
        type: WorkflowStateType.HTTP,
        next: "done",
        onError: { action: WorkflowStateErrorAction.GOTO, next: "fallback" },
        http: { connection: "c", method: WorkflowHttpMethod.POST, path: { kind: WorkflowValueKind.LITERAL, literal: "/f" }, responseType: WorkflowHttpResponseType.JSON },
      },
      fallback: { type: WorkflowStateType.TRANSFORM, next: "done", transform: { output: { kind: WorkflowValueKind.LITERAL, literal: "fb" } } },
      greet: {
        type: WorkflowStateType.INTENT,
        next: "done",
        onError: { action: WorkflowStateErrorAction.CONTINUE },
        intent: { intent: "X", vars: {} },
      },
      done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED, output: parseWorkflowValueShorthand({ flagged: { $ref: "states.flag.status", default: "NO" } }) } },
      failed: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.FAIL, errorCode: "BAD", errorMessage: parseWorkflowValueShorthand({ $template: "score {{input.score}}" }) } },
    },
  });

  it("selects the first matching case or the default", () => {
    expect(selectChoiceNext(definition.states.route.choice!, makeCtx({ score: 9 }))).toEqual({ next: "flag", caseId: "high" });
    expect(selectChoiceNext(definition.states.route.choice!, makeCtx({ score: 1, name: "Ana" }))).toEqual({ next: "greet", caseId: "named" });
    expect(selectChoiceNext(definition.states.route.choice!, makeCtx({ score: 1 }))).toEqual({ next: "done", caseId: null });
    expect(() => selectChoiceNext({ choices: [{ id: "x", condition: { path: "input.score", op: ConditionOperator.MORE_THAN, value1: "bad" }, next: "done" }], default: "done" }, makeCtx({ score: 1 }), "route")).toThrow("subject=route");
  });

  it("evaluates local states and refuses host states", () => {
    const outcome = evaluateLocalWorkflowState(definition.states.route, makeCtx({ score: 9 }));
    expect(outcome).toEqual({ status: WorkflowStateOutcomeStatus.COMPLETED, output: "high", caseId: "high" });
    expect(evaluateLocalWorkflowState(definition.states.fallback, makeCtx({})).output).toBe("fb");
    expect(() => evaluateLocalWorkflowState(definition.states.flag, makeCtx({}))).toThrow("executed by the host");
    expect(isHostExecutedWorkflowState(WorkflowStateType.WAIT)).toBe(true);
    expect(isHostExecutedWorkflowState(WorkflowStateType.END)).toBe(false);
  });

  it("routes CONTINUE, END, ERROR_HANDLED (GOTO / CONTINUE) and FAIL", () => {
    const ctx = makeCtx({ score: 9 });
    const choice = resolveWorkflowTransition(definition, "route", evaluateLocalWorkflowState(definition.states.route, ctx), ctx);
    expect(choice.kind).toBe(WorkflowTransitionKind.CONTINUE);
    expect(choice.next).toBe("flag");
    expect(choice.caseId).toBe("high");
    expect(choice.snapshot).toEqual({ status: WorkflowStateRunStatus.COMPLETED, output: "high" });

    const httpOk = resolveWorkflowTransition(definition, "flag", { status: WorkflowStateOutcomeStatus.COMPLETED, output: { status: 201 } }, ctx);
    expect(httpOk).toMatchObject({ kind: WorkflowTransitionKind.CONTINUE, next: "done" });

    const httpFail = resolveWorkflowTransition(definition, "flag", { status: WorkflowStateOutcomeStatus.FAILED, error: { code: "HTTP_500", message: "boom" } }, ctx);
    expect(httpFail).toMatchObject({ kind: WorkflowTransitionKind.ERROR_HANDLED, next: "fallback", error: { code: "HTTP_500" } });
    expect(httpFail.snapshot).toEqual({ status: WorkflowStateRunStatus.FAILED, output: null });

    const intentFail = resolveWorkflowTransition(definition, "greet", { status: WorkflowStateOutcomeStatus.FAILED }, ctx);
    expect(intentFail).toMatchObject({ kind: WorkflowTransitionKind.ERROR_HANDLED, next: "done", error: { code: "STATE_FAILED" } });

    const transformFail = resolveWorkflowTransition(definition, "fallback", { status: WorkflowStateOutcomeStatus.FAILED }, ctx);
    expect(transformFail.kind).toBe(WorkflowTransitionKind.FAIL);

    const ctxWithFlag = makeCtx({ score: 9 }, { flag: httpOk.snapshot });
    const end = resolveWorkflowTransition(definition, "done", evaluateLocalWorkflowState(definition.states.done, ctxWithFlag), ctxWithFlag);
    expect(end).toMatchObject({ kind: WorkflowTransitionKind.END, endOutcome: WorkflowEndOutcome.SUCCEED, runOutput: { flagged: "COMPLETED" } });

    const failEnd = resolveWorkflowTransition(definition, "failed", evaluateLocalWorkflowState(definition.states.failed, ctx), ctx);
    expect(failEnd).toMatchObject({ kind: WorkflowTransitionKind.END, endOutcome: WorkflowEndOutcome.FAIL, error: { code: "BAD", message: "score 9" } });

    expect(() => resolveWorkflowTransition(definition, "nope", { status: WorkflowStateOutcomeStatus.COMPLETED }, ctx)).toThrow("Unknown state");
  });

  it("applies settings.onError when a state declares no policy", () => {
    const def = baseDefinition({
      settings: { timeoutMs: 1000, maxTransitionsPerRun: 10, onError: { action: WorkflowStateErrorAction.GOTO, next: "cleanup" } },
      states: {
        start: { type: WorkflowStateType.TRANSFORM, next: "done", transform: { output: { kind: WorkflowValueKind.LITERAL, literal: 1 } } },
        cleanup: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.FAIL, errorCode: "CLEANED" } },
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
      },
    });
    expect(validateWorkflowDefinition(def).valid).toBe(true);
    const t = resolveWorkflowTransition(def, "start", { status: WorkflowStateOutcomeStatus.FAILED }, makeCtx({}));
    expect(t).toMatchObject({ kind: WorkflowTransitionKind.ERROR_HANDLED, next: "cleanup" });
    expect(issueLabels({ ...def, settings: { ...def.settings, onError: { action: WorkflowStateErrorAction.GOTO } } })).toContain(`settings.onError.next:${WorkflowValidationIssueCode.TRANSITION_MISSING}`);
    expect(issueLabels({ ...def, settings: { ...def.settings, onError: { action: WorkflowStateErrorAction.GOTO, next: "ghost" } } })).toContain(`settings.onError.next:${WorkflowValidationIssueCode.TRANSITION_TARGET_MISSING}`);
  });

  it("falls back to the last completed output when no output mapping exists", () => {
    const def = baseDefinition();
    const ctx = makeCtx({}, { start: { status: WorkflowStateRunStatus.COMPLETED, output: 42 } });
    const end = resolveWorkflowTransition(def, "done", evaluateLocalWorkflowState(def.states.done, ctx), ctx);
    expect(end.runOutput).toBe(42);
  });
});

describe("workflow.contract approval gates (v3.1.1)", () => {
  /** Minimal valid definition with one gated state. */
  const gated = (approval: unknown, type: WorkflowStateType = WorkflowStateType.TRANSFORM): WorkflowDefinition => ({
    schemaVersion: WorkflowSchemaVersion.V1,
    key: "GATE",
    name: "Gate",
    settings: { timeoutMs: 60_000, maxTransitionsPerRun: 10 },
    startAt: "step",
    states: {
      step: {
        type,
        ...(type === WorkflowStateType.END ? {} : { next: "done" }),
        ...(type === WorkflowStateType.TRANSFORM ? { transform: { output: { kind: WorkflowValueKind.LITERAL, literal: 1 } } } : {}),
        ...(type === WorkflowStateType.END ? { end: { outcome: WorkflowEndOutcome.SUCCEED } } : {}),
        approval: approval as never,
      },
      done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
    },
  });

  it("accepts a gate with a timeout, a group and resolved mappings", () => {
    const result = validateWorkflowDefinition(gated({
      timeoutMs: 3_600_000,
      assignmentGroupKey: "ops",
      notifyRequester: true,
      assignees: { kind: WorkflowValueKind.REF, ref: "input.approvers", default: null },
      instructions: { kind: WorkflowValueKind.TEMPLATE, template: "Approve {{input.subject}}" },
    }));
    expect(result.valid).toBe(true);
  });

  it("requires a positive timeout, a usable group key and an object", () => {
    expect(validateWorkflowDefinition(gated({ timeoutMs: 0 })).issues.map((i) => i.path)).toContain("states.step.approval.timeoutMs");
    expect(validateWorkflowDefinition(gated({ timeoutMs: 1_000, assignmentGroupKey: "  " })).issues.map((i) => i.path)).toContain("states.step.approval.assignmentGroupKey");
    expect(validateWorkflowDefinition(gated("nope")).issues.map((i) => i.path)).toContain("states.step.approval");
  });

  it("refuses a gate on an END state: there is nothing left to approve", () => {
    const issues = validateWorkflowDefinition(gated({ timeoutMs: 1_000 }, WorkflowStateType.END)).issues;
    expect(issues.some((i) => i.path === "states.step.approval" && i.code === WorkflowValidationIssueCode.STATE_CONFIG_INVALID)).toBe(true);
  });

  it("validates the mappings of the gate like any other value", () => {
    const issues = validateWorkflowDefinition(gated({ timeoutMs: 1_000, instructions: { kind: WorkflowValueKind.REF, ref: "nope.field" } })).issues;
    expect(issues.some((i) => i.path.startsWith("states.step.approval.instructions") && i.code === WorkflowValidationIssueCode.REF_INVALID)).toBe(true);
  });

  it("survives the shorthand round trip with its mappings", () => {
    const definition = gated({ timeoutMs: 1_000, assignees: { kind: WorkflowValueKind.LITERAL, literal: "ops@example.org" } });
    const round = parseWorkflowDefinitionShorthand(formatWorkflowDefinitionShorthand(definition));
    expect(round.states.step.approval).toEqual(definition.states.step.approval);
  });

  it("publishes the decision form and the rejection code", () => {
    expect(Object.keys(WORKFLOW_APPROVAL_FORM)).toEqual(["approved", "comment"]);
    expect(WORKFLOW_APPROVAL_FORM.approved.required).toBe(true);
    expect(WORKFLOW_APPROVAL_FORM.approved.type).toBe(PromptVariableType.BOOLEAN);
    expect(WORKFLOW_APPROVAL_REJECTED_CODE).toBe("APPROVAL_REJECTED");
  });
});

describe("workflow.contract validation", () => {
  it("accepts the base definition and reports counts", () => {
    const result = validateWorkflowDefinition(baseDefinition());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.stateCount).toBe(2);
    expect(result.nestingDepth).toBe(0);
  });

  it("reports shape issues", () => {
    const labels = issueLabels({
      ...baseDefinition(),
      schemaVersion: 2 as WorkflowSchemaVersion,
      key: "bad key",
      name: " ",
      settings: { timeoutMs: 0, maxTransitionsPerRun: 10_000 },
      startAt: "missing",
    });
    expect(labels).toEqual(expect.arrayContaining([
      `schemaVersion:${WorkflowValidationIssueCode.DEFINITION_INVALID}`,
      `key:${WorkflowValidationIssueCode.KEY_INVALID}`,
      `name:${WorkflowValidationIssueCode.DEFINITION_INVALID}`,
      `settings.timeoutMs:${WorkflowValidationIssueCode.SETTINGS_INVALID}`,
      `settings.maxTransitionsPerRun:${WorkflowValidationIssueCode.SETTINGS_INVALID}`,
      `states:${WorkflowValidationIssueCode.START_STATE_MISSING}`,
    ]));
  });

  it("reports state config, transition and graph issues", () => {
    const labels = issueLabels(baseDefinition({
      startAt: "a",
      states: {
        a: { type: WorkflowStateType.TRANSFORM, next: "b", transform: { output: { kind: WorkflowValueKind.LITERAL, literal: 1 } }, http: { connection: "x", method: WorkflowHttpMethod.GET, path: { kind: WorkflowValueKind.LITERAL, literal: "/" }, responseType: WorkflowHttpResponseType.JSON } },
        b: { type: WorkflowStateType.INTENT, next: "ghost" },
        "Bad-Id": { type: WorkflowStateType.END, next: "a", end: { outcome: WorkflowEndOutcome.SUCCEED } },
        c: { type: "WHAT" as WorkflowStateType },
        d: { type: WorkflowStateType.CHOICE, next: "a", choice: { choices: [], default: "ghost" } },
        loop1: { type: WorkflowStateType.TRANSFORM, next: "loop2", transform: { output: { kind: WorkflowValueKind.LITERAL, literal: 1 } } },
        loop2: { type: WorkflowStateType.TRANSFORM, next: "loop1", transform: { output: { kind: WorkflowValueKind.LITERAL, literal: 1 } } },
      },
    }));
    expect(labels).toEqual(expect.arrayContaining([
      `states.a.http:${WorkflowValidationIssueCode.STATE_CONFIG_INVALID}`,
      `states.b.intent:${WorkflowValidationIssueCode.STATE_CONFIG_MISSING}`,
      `states.b.next:${WorkflowValidationIssueCode.TRANSITION_TARGET_MISSING}`,
      `states.Bad-Id:${WorkflowValidationIssueCode.STATE_ID_INVALID}`,
      `states.Bad-Id.next:${WorkflowValidationIssueCode.TRANSITION_NOT_ALLOWED}`,
      `states.c.type:${WorkflowValidationIssueCode.STATE_TYPE_INVALID}`,
      `states.d.next:${WorkflowValidationIssueCode.TRANSITION_NOT_ALLOWED}`,
      `states.d.choice.choices:${WorkflowValidationIssueCode.STATE_CONFIG_INVALID}`,
      `states.d.choice.default:${WorkflowValidationIssueCode.TRANSITION_TARGET_MISSING}`,
      `states.Bad-Id:${WorkflowValidationIssueCode.STATE_UNREACHABLE}`,
      `states.loop1:${WorkflowValidationIssueCode.STATE_UNREACHABLE}`,
      `states:${WorkflowValidationIssueCode.END_UNREACHABLE}`,
    ]));
  });

  it("flags cycles without WAIT and accepts cycles through WAIT", () => {
    const cyclic = baseDefinition({
      startAt: "a",
      states: {
        a: { type: WorkflowStateType.TRANSFORM, next: "b", transform: { output: { kind: WorkflowValueKind.LITERAL, literal: 1 } } },
        b: { type: WorkflowStateType.CHOICE, choice: { choices: [{ id: "again", condition: { path: "input.retry", op: ConditionOperator.TRUE }, next: "a" }], default: "done" } },
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
      },
    });
    expect(issueLabels(cyclic)).toContain(`states.a:${WorkflowValidationIssueCode.CYCLE_WITHOUT_WAIT}`);

    const withWait = baseDefinition({
      startAt: "ask",
      states: {
        ask: { type: WorkflowStateType.WAIT, next: "check", wait: { kind: "HUMAN_TASK" as never, form: { ok: { type: PromptVariableType.BOOLEAN } }, timeoutMs: 1000 } },
        check: { type: WorkflowStateType.CHOICE, choice: { choices: [{ id: "again", condition: { path: "states.ask.output.ok", op: ConditionOperator.FALSE }, next: "ask" }], default: "done" } },
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
      },
    });
    expect(validateWorkflowDefinition(withWait).valid).toBe(true);
  });

  it("gates advanced states and caps", () => {
    const advanced = baseDefinition({
      startAt: "w",
      states: {
        w: { type: WorkflowStateType.WAIT, next: "done", wait: { kind: "DELAY" as never, delayMs: 10, timeoutMs: 100 } },
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
      },
    });
    expect(workflowUsesAdvancedStates(advanced)).toBe(true);
    expect(workflowUsesAdvancedStates(baseDefinition())).toBe(false);
    expect(issueLabels(advanced, { caps: { ...DEFAULT_WORKFLOW_VALIDATION_CAPS, allowAdvancedStates: false } })).toContain(`states.w.type:${WorkflowValidationIssueCode.STATE_ADVANCED_NOT_ALLOWED}`);
    expect(issueLabels(baseDefinition(), { caps: { ...DEFAULT_WORKFLOW_VALIDATION_CAPS, maxStates: 1 } })).toContain(`states:${WorkflowValidationIssueCode.LIMIT_EXCEEDED}`);
  });

  it("validates references: grammar, item scope, unknown state, dominance and defaults", () => {
    const def = baseDefinition({
      startAt: "route",
      states: {
        route: { type: WorkflowStateType.CHOICE, choice: { choices: [{ id: "x", condition: { path: "input.flag", op: ConditionOperator.TRUE }, next: "left" }], default: "right" } },
        left: { type: WorkflowStateType.TRANSFORM, next: "merge", transform: { output: { kind: WorkflowValueKind.LITERAL, literal: "L" } } },
        right: { type: WorkflowStateType.TRANSFORM, next: "merge", transform: { output: { kind: WorkflowValueKind.LITERAL, literal: "R" } } },
        merge: {
          type: WorkflowStateType.TRANSFORM,
          next: "done",
          transform: {
            output: parseWorkflowValueShorthand({
              fromLeft: { $ref: "states.left.output" },
              fromLeftSafe: { $ref: "states.left.output", default: null },
              fromRoute: { $ref: "states.route.output" },
              bad: { $ref: "nowhere.x" },
              item: { $ref: "item.index" },
              unknown: { $ref: "states.ghost.output" },
              later: { $ref: "states.done.output" },
              tpl: { $template: "{{states.left.output}} {{#section}}x{{/section}}" },
            }),
          },
        },
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
      },
    });
    const labels = issueLabels(def);
    expect(labels).toContain(`states.merge.transform.output.fromLeft.ref:${WorkflowValidationIssueCode.REF_STATE_NOT_DOMINATING}`);
    expect(labels).not.toContain(`states.merge.transform.output.fromLeftSafe.ref:${WorkflowValidationIssueCode.REF_STATE_NOT_DOMINATING}`);
    expect(labels).not.toContain(`states.merge.transform.output.fromRoute.ref:${WorkflowValidationIssueCode.REF_STATE_NOT_DOMINATING}`);
    expect(labels).toContain(`states.merge.transform.output.bad.ref:${WorkflowValidationIssueCode.REF_INVALID}`);
    expect(labels).toContain(`states.merge.transform.output.item.ref:${WorkflowValidationIssueCode.REF_INVALID}`);
    expect(labels).toContain(`states.merge.transform.output.unknown.ref:${WorkflowValidationIssueCode.REF_INVALID}`);
    expect(labels).toContain(`states.merge.transform.output.later.ref:${WorkflowValidationIssueCode.REF_STATE_NOT_DOMINATING}`);
    expect(labels).toContain(`states.merge.transform.output.tpl.template:${WorkflowValidationIssueCode.TEMPLATE_INVALID}`);
  });

  it("validates value nodes: kinds, arity, literals", () => {
    const def = baseDefinition({
      states: {
        start: {
          type: WorkflowStateType.TRANSFORM,
          next: "done",
          transform: {
            output: {
              kind: WorkflowValueKind.OBJECT,
              object: {
                badKind: { kind: "NOPE" as WorkflowValueKind },
                badFn: { kind: WorkflowValueKind.FN, fn: "WAT" as WorkflowMappingFunction, args: [] },
                arity: { kind: WorkflowValueKind.FN, fn: WorkflowMappingFunction.TO_UPPER, args: [] },
                arity2: { kind: WorkflowValueKind.FN, fn: WorkflowMappingFunction.NOW_ISO, args: [{ kind: WorkflowValueKind.LITERAL, literal: 1 }] },
                lit: { kind: WorkflowValueKind.LITERAL, literal: { x: 1 } as unknown as string },
                noRef: { kind: WorkflowValueKind.REF },
                noTpl: { kind: WorkflowValueKind.TEMPLATE },
                noObj: { kind: WorkflowValueKind.OBJECT },
                noArr: { kind: WorkflowValueKind.ARRAY },
              },
            },
          },
        },
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
      },
    });
    const labels = issueLabels(def);
    const base = "states.start.transform.output";
    expect(labels).toEqual(expect.arrayContaining([
      `${base}.badKind:${WorkflowValidationIssueCode.VALUE_INVALID}`,
      `${base}.badFn.fn:${WorkflowValidationIssueCode.VALUE_INVALID}`,
      `${base}.arity.args:${WorkflowValidationIssueCode.FUNCTION_ARITY_INVALID}`,
      `${base}.arity2.args:${WorkflowValidationIssueCode.FUNCTION_ARITY_INVALID}`,
      `${base}.lit.literal:${WorkflowValidationIssueCode.VALUE_INVALID}`,
      `${base}.noRef.ref:${WorkflowValidationIssueCode.REF_INVALID}`,
      `${base}.noTpl.template:${WorkflowValidationIssueCode.TEMPLATE_INVALID}`,
      `${base}.noObj.object:${WorkflowValidationIssueCode.VALUE_INVALID}`,
      `${base}.noArr.array:${WorkflowValidationIssueCode.VALUE_INVALID}`,
    ]));
  });

  it("cross-checks intents, connections and credential headers when context is provided", () => {
    const intents: WorkflowValidationIntent[] = [
      { intent: "KNOWN", inputSchema: { text: { type: PromptVariableType.STRING, required: true }, extra: { type: PromptVariableType.STRING } }, outputSchema: { out: { type: PromptVariableType.STRING } } },
    ];
    const def = baseDefinition({
      startAt: "call",
      states: {
        call: { type: WorkflowStateType.INTENT, next: "http", intent: { intent: "KNOWN", vars: { unknownVar: { kind: WorkflowValueKind.LITERAL, literal: "x" } }, inputParts: { kind: WorkflowValueKind.LITERAL, literal: null } } },
        http: { type: WorkflowStateType.HTTP, next: "ghost_intent", http: { connection: "missing", method: "FETCH" as WorkflowHttpMethod, path: { kind: WorkflowValueKind.LITERAL, literal: "/" }, responseType: WorkflowHttpResponseType.JSON, headers: { Authorization: { kind: WorkflowValueKind.LITERAL, literal: "Bearer x" }, "X-Trace": { kind: WorkflowValueKind.LITERAL, literal: "1" } }, expectStatus: [99] } },
        ghost_intent: { type: WorkflowStateType.INTENT, next: "done", intent: { intent: "GHOST", vars: {} } },
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
      },
    });
    const labels = issueLabels(def, { intents, connections: ["crm"] });
    expect(labels).toEqual(expect.arrayContaining([
      `states.call.intent.vars.unknownVar:${WorkflowValidationIssueCode.INTENT_VAR_UNKNOWN}`,
      `states.call.intent.vars.text:${WorkflowValidationIssueCode.INTENT_VAR_MISSING}`,
      `states.call.intent.inputParts:${WorkflowValidationIssueCode.INTENT_INPUT_PARTS_NOT_SUPPORTED}`,
      `states.http.http.connection:${WorkflowValidationIssueCode.CONNECTION_UNKNOWN}`,
      `states.http.http.method:${WorkflowValidationIssueCode.STATE_CONFIG_INVALID}`,
      `states.http.http.headers.Authorization:${WorkflowValidationIssueCode.HTTP_HEADER_FORBIDDEN}`,
      `states.http.http.expectStatus:${WorkflowValidationIssueCode.STATE_CONFIG_INVALID}`,
      `states.ghost_intent.intent.intent:${WorkflowValidationIssueCode.INTENT_UNKNOWN}`,
    ]));
    expect(labels).not.toContain(`states.http.http.headers.X-Trace:${WorkflowValidationIssueCode.HTTP_HEADER_FORBIDDEN}`);
    // Without context the same definition only fails on structure, not on cross-checks.
    expect(issueLabels(def).some((l) => l.includes("INTENT_UNKNOWN") || l.includes("CONNECTION_UNKNOWN"))).toBe(false);
  });

  it("validates nested sub-graphs, item scope and nesting caps", () => {
    const def = baseDefinition({
      startAt: "each",
      states: {
        each: {
          type: WorkflowStateType.FOREACH,
          next: "done",
          foreach: {
            items: parseWorkflowValueShorthand({ $ref: "input.rows" }),
            maxItems: 10,
            concurrency: 2,
            startAt: "inner",
            states: {
              inner: { type: WorkflowStateType.TRANSFORM, next: "inner_end", transform: { output: parseWorkflowValueShorthand({ i: { $ref: "item.index" }, v: { $ref: "item.value.x" } }) } },
              inner_end: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
            },
          },
        },
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
      },
    });
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(true);
    expect(result.stateCount).toBe(4);
    expect(result.nestingDepth).toBe(1);
    expect(issueLabels(def, { caps: { ...DEFAULT_WORKFLOW_VALIDATION_CAPS, maxNestingDepth: 0 } })).toContain(`states.each.foreach.states:${WorkflowValidationIssueCode.LIMIT_EXCEEDED}`);

    const parallel = baseDefinition({
      startAt: "par",
      states: {
        par: { type: WorkflowStateType.PARALLEL, next: "done", parallel: { branches: [{ id: "b1", startAt: "x", states: { x: { type: WorkflowStateType.TRANSFORM, next: "e", transform: { output: { kind: WorkflowValueKind.LITERAL, literal: 1 } } }, e: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } } } }, { id: "b1", startAt: "nope", states: {} }] } },
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
      },
    });
    const labels = issueLabels(parallel);
    expect(labels).toContain(`states.par.parallel.branches[1].id:${WorkflowValidationIssueCode.STATE_ID_INVALID}`);
    expect(labels).toContain(`states.par.parallel.branches[1].states:${WorkflowValidationIssueCode.START_STATE_MISSING}`);
  });

  it("validates constants and date-unit literals", () => {
    const def = baseDefinition({
      constants: { region: "EU", retries: 3, "bad key": 1, obj: { x: 1 } as unknown as string },
      states: {
        start: { type: WorkflowStateType.TRANSFORM, next: "done", transform: { output: parseWorkflowValueShorthand({ r: { $ref: "constants.region" }, later: { $fn: "DATE_ADD", args: [{ $ref: "run.startedAt" }, 1, "WEEKS"] }, ok: { $fn: "DATE_ADD", args: [{ $ref: "run.startedAt" }, 1, "DAYS"] } }) } },
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
      },
    });
    const labels = issueLabels(def);
    expect(labels).toContain(`constants.bad key:${WorkflowValidationIssueCode.CONSTANT_INVALID}`);
    expect(labels).toContain(`constants.obj:${WorkflowValidationIssueCode.CONSTANT_INVALID}`);
    expect(labels).toContain(`states.start.transform.output.later.args[2]:${WorkflowValidationIssueCode.VALUE_INVALID}`);
    expect(labels.filter((l) => l.includes("output.ok"))).toEqual([]);
    expect(labels.filter((l) => l.includes("output.r"))).toEqual([]);
  });

  it("round-trips WAIT value positions through the definition shorthand", () => {
    const shorthand = {
      ...baseDefinition(),
      startAt: "approve",
      states: {
        approve: {
          type: "WAIT",
          next: "done",
          wait: {
            kind: "HUMAN_TASK",
            timeoutMs: 1000,
            form: { ok: { type: "boolean", required: true } },
            assignees: { $ref: "input.approvers" },
            instructions: { $template: "Approve {{input.ticket.id}}" },
            correlation: { ticketId: { $ref: "input.ticket.id" } },
          },
        },
        done: { type: "END", end: { outcome: "SUCCEED" } },
      },
    };
    const parsed = parseWorkflowDefinitionShorthand(shorthand);
    expect(parsed.states.approve.wait?.assignees).toEqual({ kind: WorkflowValueKind.REF, ref: "input.approvers" });
    expect(parsed.states.approve.wait?.correlation?.ticketId).toEqual({ kind: WorkflowValueKind.REF, ref: "input.ticket.id" });
    expect(validateWorkflowDefinition(parsed).valid).toBe(true);
    expect(formatWorkflowDefinitionShorthand(parsed)).toEqual(shorthand);
  });

  it("validates WAIT blocks per kind", () => {
    const def = baseDefinition({
      startAt: "w1",
      states: {
        w1: { type: WorkflowStateType.WAIT, next: "w2", wait: { kind: "DELAY" as never, timeoutMs: 0 } },
        w2: { type: WorkflowStateType.WAIT, next: "w3", wait: { kind: "EXTERNAL_EVENT" as never, timeoutMs: 10 } },
        w3: { type: WorkflowStateType.WAIT, next: "done", wait: { kind: "HUMAN_TASK" as never, timeoutMs: 10 } },
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
      },
    });
    const labels = issueLabels(def);
    expect(labels).toEqual(expect.arrayContaining([
      `states.w1.wait.timeoutMs:${WorkflowValidationIssueCode.STATE_CONFIG_INVALID}`,
      `states.w1.wait.delayMs:${WorkflowValidationIssueCode.STATE_CONFIG_MISSING}`,
      `states.w2.wait.eventKey:${WorkflowValidationIssueCode.STATE_CONFIG_MISSING}`,
      `states.w3.wait.form:${WorkflowValidationIssueCode.STATE_CONFIG_MISSING}`,
    ]));
  });
});

describe("workflow.contract output schema", () => {
  const schema = { approved: { type: PromptVariableType.BOOLEAN, required: true }, total: { type: PromptVariableType.FLOAT, required: true }, notes: { type: PromptVariableType.STRING } };

  it("checks object mappings against the schema and accepts opaque nodes", () => {
    const ok = parseWorkflowValueShorthand({ approved: true, total: { $ref: "input.total" } });
    expect(validateWorkflowValueAgainstSchema(ok, schema, "output")).toEqual([]);
    const bad = parseWorkflowValueShorthand({ approved: true, extra: 1 });
    expect(validateWorkflowValueAgainstSchema(bad, schema, "output").map((i) => `${i.path}:${i.code}`)).toEqual([
      `output.extra:${WorkflowValidationIssueCode.OUTPUT_KEY_UNKNOWN}`,
      `output.total:${WorkflowValidationIssueCode.OUTPUT_KEY_MISSING}`,
    ]);
    expect(validateWorkflowValueAgainstSchema(parseWorkflowValueShorthand(5), schema, "output")[0]?.code).toBe(WorkflowValidationIssueCode.OUTPUT_KEY_MISSING);
    expect(validateWorkflowValueAgainstSchema(parseWorkflowValueShorthand({ $ref: "states.x.output" }), schema, "output")).toEqual([]);
  });

  it("validates definition output and END overrides against outputSchema", () => {
    const good = baseDefinition({
      outputSchema: schema,
      output: parseWorkflowValueShorthand({ approved: true, total: { $ref: "states.start.output" } }),
    });
    expect(validateWorkflowDefinition(good).valid).toBe(true);

    const badMapping = baseDefinition({
      outputSchema: schema,
      output: parseWorkflowValueShorthand({ approved: true, wrong: 1 }),
      states: {
        ...baseDefinition().states,
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED, output: parseWorkflowValueShorthand({ total: 1 }) } },
      },
    });
    const labels = issueLabels(badMapping);
    expect(labels).toContain(`output.wrong:${WorkflowValidationIssueCode.OUTPUT_KEY_UNKNOWN}`);
    expect(labels).toContain(`output.total:${WorkflowValidationIssueCode.OUTPUT_KEY_MISSING}`);
    expect(labels).toContain(`states.done.end.output.approved:${WorkflowValidationIssueCode.OUTPUT_KEY_MISSING}`);

    const noMapping = baseDefinition({ outputSchema: schema });
    expect(issueLabels(noMapping)).toContain(`output:${WorkflowValidationIssueCode.OUTPUT_MAPPING_MISSING}`);

    const endsCovered = baseDefinition({
      outputSchema: schema,
      states: {
        ...baseDefinition().states,
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED, output: parseWorkflowValueShorthand({ approved: true, total: 1 }) } },
      },
    });
    expect(validateWorkflowDefinition(endsCovered).valid).toBe(true);
    expect(issueLabels({ ...good, outputSchema: "nope" as never })).toContain(`outputSchema:${WorkflowValidationIssueCode.OUTPUT_SCHEMA_INVALID}`);
  });

  it("cross-checks SUBWORKFLOW inputs and infers its output schema from the child contract", () => {
    const child = { key: "CHILD", inputSchema: { text: { type: PromptVariableType.STRING, required: true } }, outputSchema: { score: { type: PromptVariableType.FLOAT } } };
    const def = baseDefinition({
      startAt: "call",
      states: {
        call: { type: WorkflowStateType.SUBWORKFLOW, next: "done", subworkflow: { workflowKey: "CHILD", input: { text: { kind: WorkflowValueKind.LITERAL, literal: "x" }, extra: { kind: WorkflowValueKind.LITERAL, literal: 1 } } } },
        self: { type: WorkflowStateType.SUBWORKFLOW, next: "done", subworkflow: { workflowKey: "TEST_FLOW", input: {} } },
        ghost: { type: WorkflowStateType.SUBWORKFLOW, next: "done", subworkflow: { workflowKey: "GHOST", input: {} } },
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
      },
    });
    expect(listWorkflowSubworkflows(def)).toEqual(["CHILD", "GHOST", "TEST_FLOW"]);
    expect(inferWorkflowStateOutputSchema(def.states.call, [], [child])).toEqual(child.outputSchema);
    expect(inferWorkflowStateOutputSchema(def.states.call, [], [])).toBeNull();
    const labels = issueLabels(def, { workflows: [child] });
    expect(labels).toContain(`states.call.subworkflow.input.extra:${WorkflowValidationIssueCode.SUBWORKFLOW_INPUT_UNKNOWN}`);
    expect(labels).toContain(`states.self.subworkflow.workflowKey:${WorkflowValidationIssueCode.STATE_CONFIG_INVALID}`);
    expect(labels).toContain(`states.ghost.subworkflow.workflowKey:${WorkflowValidationIssueCode.SUBWORKFLOW_UNKNOWN}`);
    const missing = baseDefinition({ startAt: "call", states: { call: { type: WorkflowStateType.SUBWORKFLOW, next: "done", subworkflow: { workflowKey: "CHILD", input: {} } }, done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } } } });
    expect(issueLabels(missing, { workflows: [child] })).toContain(`states.call.subworkflow.input.text:${WorkflowValidationIssueCode.SUBWORKFLOW_INPUT_MISSING}`);
  });
});

describe("workflow.contract AGENT state", () => {
  const agentShorthand = {
    ...baseDefinition(),
    constants: { maxBudget: 10 },
    startAt: "research",
    states: {
      research: {
        type: "AGENT",
        next: "done",
        agent: {
          plannerIntent: "RESEARCH_PLANNER",
          goal: { $template: "Find the supplier risk for {{input.supplier}}" },
          context: { budget: { $ref: "constants.maxBudget" } },
          tools: [
            { id: "search_news", kind: "INTENT", intent: "NEWS_SEARCH", description: "Search recent news about a company." },
            { id: "fetch_registry", kind: "STATE", state: "registry_lookup", description: "Look the company up in the official registry." },
            { id: "summarize", kind: "STATE", state: "summarize", description: "Summarize collected evidence.", inputSchema: { notes: { type: "string", required: true } } },
          ],
          maxIterations: 6,
          maxTrackedCalls: 20,
          maxToolErrors: 1,
        },
      },
      registry_lookup: {
        type: "HTTP",
        http: { connection: "registry", method: "GET", path: { $template: "/companies/{{agent.args.name}}" }, responseType: "JSON" },
      },
      summarize: {
        type: "TRANSFORM",
        transform: { output: { iteration: { $ref: "agent.iteration" }, notes: { $ref: "agent.args.notes" }, calls: { $fn: "COUNT", args: [{ $ref: "agent.history" }] } } },
      },
      done: { type: "END", end: { outcome: "SUCCEED", output: { $ref: "states.research.output.result" } } },
    },
  };
  const intents: WorkflowValidationIntent[] = [
    { intent: "RESEARCH_PLANNER", inputSchema: { goal: { type: PromptVariableType.STRING, required: true } } },
    { intent: "NEWS_SEARCH", inputSchema: { query: { type: PromptVariableType.STRING, required: true } } },
  ];

  it("declares AGENT as an advanced, host-executed state with its config block", () => {
    expect(WORKFLOW_ADVANCED_STATE_TYPES).toContain(WorkflowStateType.AGENT);
    expect(isHostExecutedWorkflowState(WorkflowStateType.AGENT)).toBe(true);
    // `TOOL` joins the list on purpose: a capability is written once as a state and is reachable
    // both from a deterministic flow and from a planner, through the `STATE` tool kind.
    expect(WORKFLOW_AGENT_TOOL_STATE_TYPES).toEqual([
      WorkflowStateType.INTENT,
      WorkflowStateType.HTTP,
      WorkflowStateType.TRANSFORM,
      WorkflowStateType.SUBWORKFLOW,
      WorkflowStateType.WAIT,
      WorkflowStateType.TOOL,
    ]);
  });

  it("parses, validates and round-trips an agent definition; tools may read agent.*", () => {
    const definition = parseWorkflowDefinitionShorthand(agentShorthand);
    expect(definition.states.research.agent?.goal.kind).toBe(WorkflowValueKind.TEMPLATE);
    expect(definition.states.research.agent?.context?.budget).toEqual({ kind: WorkflowValueKind.REF, ref: "constants.maxBudget" });
    const result = validateWorkflowDefinition(definition, { intents, connections: ["registry"] });
    expect(result.issues).toEqual([]);
    expect(workflowUsesAdvancedStates(definition)).toBe(true);
    expect(listWorkflowIntents(definition)).toEqual(["NEWS_SEARCH", "RESEARCH_PLANNER"]);
    expect(formatWorkflowDefinitionShorthand(definition)).toEqual(agentShorthand);
  });

  it("resolves agent.* references only while an agent context is present", () => {
    const definition = parseWorkflowDefinitionShorthand(agentShorthand);
    const noAgent = makeCtx({ supplier: "ACME" }, {}, { maxBudget: 10 });
    expect(resolveWorkflowRef("agent.args.name", noAgent)).toBeUndefined();
    const withAgent: WorkflowValueContext = {
      ...noAgent,
      agent: { goal: "g", iteration: 2, args: { name: "ACME", notes: "n" }, history: [{ iteration: 1, tool: "search_news", args: { query: "ACME" }, output: { hits: 3 } }] },
    };
    expect(resolveWorkflowRef("agent.args.name", withAgent)).toBe("ACME");
    expect(resolveWorkflowRef("agent.history[0].output.hits", withAgent)).toBe(3);
    expect(resolveWorkflowRef("agent.notes", withAgent)).toEqual([]);
    expect(resolveWorkflowRef("agent.summary", withAgent)).toBeNull();
    expect(resolveWorkflowRef("agent.notes[1]", { ...withAgent, agent: { ...withAgent.agent!, notes: ["a", "b"], summary: "s" } })).toBe("b");
    expect(resolveWorkflowRef("agent.summary", { ...withAgent, agent: { ...withAgent.agent!, notes: ["a"], summary: "s" } })).toBe("s");
    expect(resolveWorkflowValue(definition.states.registry_lookup.http!.path, withAgent)).toBe("/companies/ACME");
    expect(evaluateLocalWorkflowState(definition.states.summarize, withAgent).output).toEqual({ iteration: 2, notes: "n", calls: 1 });
    expect(selectChoiceNext({ choices: [{ id: "many", condition: { path: "agent.history", op: ConditionOperator.ARRAY_LENGTH_MIN, value1: 1 }, next: "a" }], default: "b" }, withAgent).next).toBe("a");
  });

  it("declares long-horizon bounds, evidence kinds and WAIT tools", () => {
    expect(WorkflowAgentStopReason.TIMEOUT).toBe("TIMEOUT");
    expect(WorkflowAgentStopReason.CANCELED).toBe("CANCELED");
    expect(Object.values(WorkflowEvidenceKind)).toEqual(["URL", "ARTIFACT", "CALL_LOG", "NOTE"]);
    expect(WORKFLOW_AGENT_TOOL_STATE_TYPES).toContain(WorkflowStateType.WAIT);
    expect(DEFAULT_WORKFLOW_VALIDATION_CAPS.maxAgentDurationMs).toBe(24 * 60 * 60 * 1000);

    const longHorizon = parseWorkflowDefinitionShorthand({
      ...agentShorthand,
      states: {
        ...agentShorthand.states,
        research: {
          ...agentShorthand.states.research,
          agent: {
            ...agentShorthand.states.research.agent,
            tools: [
              ...agentShorthand.states.research.agent.tools,
              { id: "ask_reviewer", kind: "STATE", state: "ask_reviewer", description: "Ask the reviewer a question and wait for the answer." },
            ],
            maxDurationMs: 6 * 60 * 60 * 1000,
            maxEstimatedCost: 25,
            historyWindow: 20,
            summarizerIntent: "RESEARCH_PLANNER",
          },
        },
        ask_reviewer: {
          type: "WAIT",
          wait: { kind: "HUMAN_TASK", form: { answer: { type: "string", required: true } }, instructions: { $ref: "agent.args.question" }, timeoutMs: 86_400_000 },
        },
      },
    });
    expect(validateWorkflowDefinition(longHorizon, { intents, connections: ["registry"] }).issues).toEqual([]);
    expect(longHorizon.states.research.agent?.maxEstimatedCost).toBe(25);
    expect(longHorizon.states.research.agent?.summarizerIntent).toBe("RESEARCH_PLANNER");
    expect(parseWorkflowDefinitionShorthand(formatWorkflowDefinitionShorthand(longHorizon))).toEqual(longHorizon);

    const bad = parseWorkflowDefinitionShorthand({
      ...agentShorthand,
      states: {
        ...agentShorthand.states,
        research: {
          ...agentShorthand.states.research,
          agent: { ...agentShorthand.states.research.agent, maxDurationMs: 48 * 60 * 60 * 1000, maxEstimatedCost: 0, historyWindow: 0, summarizerIntent: "NOPE" },
        },
      },
    });
    const labels = validateWorkflowDefinition(bad, { intents, connections: ["registry"] }).issues.map((i) => `${i.path}:${i.code}`);
    expect(labels).toEqual(expect.arrayContaining([
      `states.research.agent.maxDurationMs:${WorkflowValidationIssueCode.STATE_CONFIG_INVALID}`,
      `states.research.agent.maxEstimatedCost:${WorkflowValidationIssueCode.STATE_CONFIG_INVALID}`,
      `states.research.agent.historyWindow:${WorkflowValidationIssueCode.STATE_CONFIG_INVALID}`,
      `states.research.agent.summarizerIntent:${WorkflowValidationIssueCode.INTENT_UNKNOWN}`,
    ]));
  });

  it("reports agent configuration issues", () => {
    const def = parseWorkflowDefinitionShorthand({
      ...agentShorthand,
      states: {
        ...agentShorthand.states,
        research: {
          type: "AGENT",
          next: "done",
          agent: {
            plannerIntent: "GHOST_PLANNER",
            goal: { $ref: "input.supplier" },
            tools: [
              { id: "Bad Id", kind: "INTENT", intent: "GHOST_TOOL", description: "" },
              { id: "dup", kind: "STATE", state: "done", description: "x" },
              { id: "dup", kind: "STATE", description: "x", intent: "NEWS_SEARCH" },
              { id: "nope", kind: "WHAT", description: "x" },
              { id: "mixed", kind: "INTENT", intent: "NEWS_SEARCH", state: "summarize", description: "x" },
            ],
            maxIterations: 999,
            maxTrackedCalls: 0,
            maxToolErrors: -1,
          },
        },
        stray: { type: "TRANSFORM", next: "done", transform: { output: { $ref: "agent.iteration" } } },
      },
      startAt: "stray",
    });
    const labels = issueLabels(def, { intents, connections: ["registry"] });
    const base = "states.research.agent";
    expect(labels).toEqual(expect.arrayContaining([
      `${base}.plannerIntent:${WorkflowValidationIssueCode.INTENT_UNKNOWN}`,
      `${base}.maxIterations:${WorkflowValidationIssueCode.STATE_CONFIG_INVALID}`,
      `${base}.maxTrackedCalls:${WorkflowValidationIssueCode.STATE_CONFIG_INVALID}`,
      `${base}.maxToolErrors:${WorkflowValidationIssueCode.STATE_CONFIG_INVALID}`,
      `${base}.tools[0].id:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      `${base}.tools[0].description:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      `${base}.tools[0].intent:${WorkflowValidationIssueCode.INTENT_UNKNOWN}`,
      `${base}.tools[1].state:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      `${base}.tools[2].id:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      `${base}.tools[2].state:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      `${base}.tools[3].kind:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      `${base}.tools[4].state:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      `states.stray.transform.output.ref:${WorkflowValidationIssueCode.REF_INVALID}`,
    ]));
    expect(issueLabels(parseWorkflowDefinitionShorthand(agentShorthand), { caps: { ...DEFAULT_WORKFLOW_VALIDATION_CAPS, allowAdvancedStates: false } })).toContain(`states.research.type:${WorkflowValidationIssueCode.STATE_ADVANCED_NOT_ALLOWED}`);
    expect(issueLabels(parseWorkflowDefinitionShorthand(agentShorthand), { caps: { ...DEFAULT_WORKFLOW_VALIDATION_CAPS, maxAgentIterations: 3 } })).toContain(`states.research.agent.maxIterations:${WorkflowValidationIssueCode.STATE_CONFIG_INVALID}`);
    const noTools = parseWorkflowDefinitionShorthand({ ...agentShorthand, states: { ...agentShorthand.states, research: { ...agentShorthand.states.research, agent: { ...agentShorthand.states.research.agent, tools: [] } } } });
    expect(issueLabels(noTools)).toContain(`states.research.agent.tools:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`);
  });
});

describe("workflow.contract hashing and listings", () => {
  it("excludes display from the canonical form and the sha256", () => {
    const a = baseDefinition();
    const b: WorkflowDefinition = {
      ...a,
      states: {
        done: { ...a.states.done, display: { label: "End", position: { x: 10, y: 20 } } },
        start: { ...a.states.start, display: { label: "Start" } },
      },
    };
    expect(canonicalizeWorkflowDefinition(b)).toEqual(canonicalizeWorkflowDefinition(a));
    const hashA = computeWorkflowDefinitionSha256(a, sha256Deps);
    expect(computeWorkflowDefinitionSha256(b, sha256Deps)).toBe(hashA);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
    const c: WorkflowDefinition = { ...a, name: "Other" };
    expect(computeWorkflowDefinitionSha256(c, sha256Deps)).not.toBe(hashA);
  });

  it("lists intents and connections and infers output schemas", () => {
    const golden = loadGolden();
    const definition = parseWorkflowDefinitionShorthand(golden.definition);
    expect(listWorkflowIntents(definition)).toEqual(["SUPPORT_RESPONSE_WRITER", "SUPPORT_TICKET_CLASSIFIER"]);
    expect(listWorkflowConnections(definition)).toEqual(["crm", "ticketing"]);
    expect(inferWorkflowStateOutputSchema(definition.states.classify, golden.intents)).toEqual(golden.intents[0].outputSchema);
    expect(inferWorkflowStateOutputSchema(definition.states.fetch_customer, golden.intents)).toBeNull();
    expect(inferWorkflowStateOutputSchema({ ...definition.states.fetch_customer, outputSchema: { a: { type: PromptVariableType.STRING } } }, golden.intents)).toEqual({ a: { type: PromptVariableType.STRING } });
  });
});

describe("workflow.contract golden replay", () => {
  const golden = loadGolden();
  const definition = parseWorkflowDefinitionShorthand(golden.definition);

  it("parses the shorthand definition into a valid typed definition and round-trips it", () => {
    const result = validateWorkflowDefinition(definition, { intents: golden.intents, connections: golden.connections });
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(formatWorkflowDefinitionShorthand(definition)).toEqual(golden.definition);
  });

  for (const goldenCase of golden.cases) {
    it(`replays: ${goldenCase.name}`, () => {
      const run = referenceRun(definition, goldenCase);
      expect(run.failed).toBe(false);
      expect(run.trail).toEqual(goldenCase.expected.trail);
      if (goldenCase.expected.choice) expect(run.choices).toEqual(goldenCase.expected.choice);
      for (const [stateId, vars] of Object.entries(goldenCase.expected.resolvedVars ?? {})) {
        expect(run.resolvedVars[stateId]).toEqual(vars);
      }
      for (const [stateId, http] of Object.entries(goldenCase.expected.resolvedHttp ?? {})) {
        expect(run.resolvedHttp[stateId]).toEqual(http);
      }
      for (const [stateId, status] of Object.entries(goldenCase.expected.stateStatus ?? {})) {
        expect(run.states[stateId]?.status).toBe(status);
      }
      for (const [stateId, output] of Object.entries(goldenCase.expected.transformOutputs ?? {})) {
        expect(run.transformOutputs[stateId]).toEqual(output);
      }
      expect(run.endOutcome).toBe(goldenCase.expected.endOutcome);
      expect(run.runOutput).toEqual(goldenCase.expected.runOutput);
    });
  }
});

describe("workflow.contract agent decision payload (v3.3.0)", () => {
  it("separates what the planner puts on the wire from what the host works with", () => {
    // The wire shape is primitives only. An output schema carrying an open object is not portable:
    // measured against real providers in 2026-09, Anthropic refuses the request outright
    // (`additionalProperties: true` is not supported) and OpenAI answers 200 with the field empty.
    const payload: WorkflowAgentDecisionPayload = {
      action: WorkflowAgentAction.CALL_TOOL,
      tool: "search",
      argsJson: JSON.stringify({ q: "acme" }),
      rationale: "probe",
    };
    for (const value of Object.values(payload)) {
      expect(["string", "number", "boolean"]).toContain(typeof value);
    }

    // The parsed form keeps the structured fields, so hosts and mappings are unchanged.
    const decision: WorkflowAgentDecision = {
      action: payload.action,
      tool: payload.tool,
      args: JSON.parse(String(payload.argsJson)),
      rationale: payload.rationale,
    };
    expect(decision.args).toEqual({ q: "acme" });

    const finish: WorkflowAgentDecisionPayload = { action: WorkflowAgentAction.FINISH, resultJson: JSON.stringify({ ok: true }) };
    expect(JSON.parse(String(finish.resultJson))).toEqual({ ok: true });
  });
});

describe("workflow.contract capability catalog and the TOOL state", () => {
  /**
   * Builds a one-state definition around a `TOOL` config, so each case states only what it changes.
   *
   * @param tool The tool config under test.
   * @returns A definition ready to validate.
   */
  /**
   * A literal value node, which is what a mapping holds; a bare string is not a valid mapping.
   *
   * @param value Scalar to wrap.
   * @returns The node.
   */
  function literal(value: string | number | boolean): Record<string, unknown> {
    return { kind: WorkflowValueKind.LITERAL, literal: value };
  }

  function definitionWith(tool: Record<string, unknown>): WorkflowDefinition {
    return {
      schemaVersion: WorkflowSchemaVersion.V1,
      key: "CAPABILITY_FLOW",
      name: "Capability flow",
      settings: { timeoutMs: 60_000, maxTransitionsPerRun: 50 },
      startAt: "run",
      states: {
        run: { type: WorkflowStateType.TOOL, tool, next: "done" },
        done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
      },
    } as unknown as WorkflowDefinition;
  }

  /**
   * Validates and returns the issue codes, which is all these cases assert on.
   *
   * @param definition Definition to validate.
   * @param connections Connection keys the tenant has.
   * @returns Issue codes, in order.
   */
  function codes(definition: WorkflowDefinition, connections: string[] = []): string[] {
    const result = validateWorkflowDefinition(definition, { connections });
    return result.issues.map((issue) => String(issue.code));
  }

  it("publishes every capability with a version, a broker and both schemas", () => {
    expect(WORKFLOW_CAPABILITIES.length).toBeGreaterThan(0);

    for (const capability of WORKFLOW_CAPABILITIES) {
      expect({ id: capability.id, hasVersion: Boolean(capability.version), hasDescription: Boolean(capability.description) })
        .toEqual({ id: capability.id, hasVersion: true, hasDescription: true });
      expect(Object.keys(capability.inputSchema).length).toBeGreaterThan(0);
      expect(Object.keys(capability.outputSchema).length).toBeGreaterThan(0);

      // A connection-brokered capability without a protocol could not be matched to a connection,
      // and a platform-brokered one with a protocol would imply the tenant configures something.
      if (capability.broker === WorkflowCapabilityBroker.CONNECTION) expect(Boolean(capability.protocol)).toBe(true);
      else expect(capability.protocol).toBeUndefined();
    }

    // Ids are the contract; a duplicate would silently shadow one of them.
    const ids = WORKFLOW_CAPABILITIES.map((capability) => capability.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Nothing may be advertised as runnable that is not in the catalog at all.
    for (const id of WORKFLOW_IMPLEMENTED_CAPABILITIES) expect(findWorkflowCapability(id)).toBeTruthy();
  });

  it("accepts a well-formed platform-brokered capability", () => {
    const definition = definitionWith({ capability: "web.search", args: { query: literal("acme") } });
    expect(codes(definition)).toEqual([]);
  });

  it("rejects a capability that is not in the catalog", () => {
    expect(codes(definitionWith({ capability: "web.scrape", args: {} }))).toEqual(["CAPABILITY_UNKNOWN"]);
  });

  it("flags a catalog capability no runner executes yet", () => {
    // A capability is published ahead of its adapter so an editor can show what is coming; the
    // validator then refuses to let a tenant wire up something that will not run.
    //
    // Every entry in the catalogue happens to have an adapter today, so this branch has no real
    // example to point at - and it is exactly the branch that matters on the day the next capability
    // is published. The implemented list is therefore narrowed for the length of this assertion and
    // put back, rather than the case being deleted for want of a subject.
    const implemented = WORKFLOW_IMPLEMENTED_CAPABILITIES as string[];
    const withdrawn = implemented.splice(implemented.indexOf("mail.send"), 1);
    try {
      const issues = codes(
        definitionWith({ capability: "mail.send", connection: "smtp_main", args: { to: literal("a@b.c"), subject: literal("s"), body: literal("b") } }),
        ["smtp_main"],
      );
      expect(issues).toEqual(["CAPABILITY_NOT_IMPLEMENTED"]);
    } finally {
      implemented.push(...withdrawn);
    }
  });

  it("publishes nothing a runner cannot execute today", () => {
    // The other half of the same rule, and the one that is true right now: an editor offering a
    // capability the runner has no adapter for is a tenant building a workflow that fails on its
    // first run, with nothing in the editor having warned them.
    const unimplemented = WORKFLOW_CAPABILITIES.filter((capability) => !WORKFLOW_IMPLEMENTED_CAPABILITIES.includes(capability.id)).map((capability) => capability.id);
    expect(unimplemented).toEqual([]);
  });

  it("only demands an endpoint for a capability that calls a platform service", () => {
    // `PLATFORM` says whose credentials are spent, not that there is something to point at.
    const services = WORKFLOW_CAPABILITIES.filter((capability) => capability.requiresEndpoint).map((capability) => capability.id);
    expect(services).toEqual(["web.search"]);
    expect(findWorkflowCapability("web.fetch")?.requiresEndpoint).toBeUndefined();
  });

  it("declares nothing implemented that the catalog does not publish", () => {
    const orphans = WORKFLOW_IMPLEMENTED_CAPABILITIES.filter((id) => !WORKFLOW_CAPABILITIES.some((capability) => capability.id === id));
    expect(orphans).toEqual([]);
  });

  it("requires a connection for a connection-brokered capability, and refuses one otherwise", () => {
    const missing = codes(definitionWith({ capability: "mail.send", args: { to: literal("a@b.c"), subject: literal("s"), body: literal("b") } }));
    expect(missing).toContain("STATE_CONFIG_MISSING");

    const unknown = codes(definitionWith({ capability: "mail.send", connection: "nope", args: { to: literal("a@b.c"), subject: literal("s"), body: literal("b") } }), ["smtp_main"]);
    expect(unknown).toContain("CONNECTION_UNKNOWN");

    // A connection on a platform-brokered capability reads as if the tenant controlled the call.
    const spurious = codes(definitionWith({ capability: "web.search", connection: "smtp_main", args: { query: literal("acme") } }), ["smtp_main"]);
    expect(spurious).toEqual(["STATE_CONFIG_INVALID"]);
  });

  it("checks the arguments against the capability schema, both ways", () => {
    expect(codes(definitionWith({ capability: "web.search", args: {} }))).toEqual(["CAPABILITY_ARG_MISSING"]);
    expect(codes(definitionWith({ capability: "web.search", args: { query: literal("acme"), depth: literal(3) } }))).toEqual(["CAPABILITY_ARG_UNKNOWN"]);
  });

  it("parses and formats a TOOL state's arguments like any other mapping", () => {
    // Regression: `tool.args` was not walked by the shorthand parser, so an imported `{ "$ref": ... }`
    // reached the validator unparsed ("unsupported value kind 'undefined'") and a bare scalar was
    // rejected outright. Every other state's mappings were parsed; this one was simply forgotten.
    const shorthand = {
      schemaVersion: 1,
      key: "TOOL_SHORTHAND",
      name: "Tool shorthand",
      settings: { timeoutMs: 60_000, maxTransitionsPerRun: 10 },
      startAt: "search",
      states: {
        search: {
          type: "TOOL",
          next: "done",
          tool: { capability: "web.search", args: { query: { $ref: "input.q" }, maxResults: 8 } },
        },
        done: { type: "END", end: { outcome: "SUCCEED" } },
      },
    } as unknown as Record<string, unknown>;

    const parsed = parseWorkflowDefinitionShorthand(shorthand);
    const args = (parsed.states.search as { tool?: { args?: Record<string, { kind?: string; ref?: string; literal?: unknown }> } }).tool?.args ?? {};
    expect(args.query).toMatchObject({ kind: WorkflowValueKind.REF, ref: "input.q" });
    expect(args.maxResults).toMatchObject({ kind: WorkflowValueKind.LITERAL, literal: 8 });

    // Parsed, it must validate; unparsed it did not.
    expect(validateWorkflowDefinition(parsed, {}).issues).toEqual([]);

    // And it survives the round trip back to shorthand.
    const formatted = formatWorkflowDefinitionShorthand(parsed) as unknown as { states: Record<string, { tool?: { args?: Record<string, unknown> } }> };
    expect(formatted.states.search.tool?.args).toEqual({ query: { $ref: "input.q" }, maxResults: 8 });
  });

  it("infers the output schema from the catalog, so downstream states resolve before any run", () => {
    const state = { type: WorkflowStateType.TOOL, tool: { capability: "web.search", args: { query: literal("acme") } } } as never;
    const inferred = inferWorkflowStateOutputSchema(state);
    expect(Object.keys(inferred ?? {})).toEqual(["results"]);

    // An explicit outputSchema still wins, as it does for every other state type.
    const overridden = { type: WorkflowStateType.TOOL, outputSchema: { custom: { type: PromptVariableType.STRING } }, tool: { capability: "web.search" } } as never;
    expect(Object.keys(inferWorkflowStateOutputSchema(overridden) ?? {})).toEqual(["custom"]);
  });
});

describe("workflow.contract v3.6.0 additions", () => {
  it("marks TOOL as host-executed, so it is never evaluated from the local context", () => {
    // A capability reaches a third party over the network. Treating it as a local state would make
    // the runner "evaluate" it with no I/O and produce an empty output instead of calling anything.
    expect(isHostExecutedWorkflowState(WorkflowStateType.TOOL)).toBe(true);
    expect(isHostExecutedWorkflowState(WorkflowStateType.TRANSFORM)).toBe(false);
  });

  it("defaults a QC sampling policy to something that cannot change control flow by surprise", () => {
    // The enum exists so `onQcFail` is a decision, not a magic string; CONTINUE is the safe default
    // a reader should assume when the field is absent.
    expect(Object.values(WorkflowQcFailAction).sort()).toEqual(["CONTINUE", "FAIL_STATE", "PARK"]);

    const definition = {
      schemaVersion: WorkflowSchemaVersion.V1,
      key: "SAMPLED_FLOW",
      name: "Sampled flow",
      settings: {
        timeoutMs: 60_000,
        maxTransitionsPerRun: 10,
        qcSampling: { everyNth: 5, tools: ["classify"], onQcFail: WorkflowQcFailAction.PARK, assignmentGroupKey: "ops" },
      },
      startAt: "done",
      states: { done: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } } },
    } as unknown as WorkflowDefinition;

    // A sampling policy is settings, not structure: it must not affect whether a definition is valid.
    expect(validateWorkflowDefinition(definition, {}).issues).toEqual([]);
  });
});

describe("parking states and where they may sit", () => {
    /**
     * A minimal definition around one state.
     *
     * @param states States of the definition.
     * @param startAt Entry state.
     * @returns The definition.
     */
    function definitionOf(states: Record<string, unknown>, startAt: string): WorkflowDefinition {
        return {
            schemaVersion: WorkflowSchemaVersion.V1,
            key: "PARK_TEST",
            name: "Park test",
            settings: { timeoutMs: 60_000, maxTransitionsPerRun: 20 },
            startAt,
            states: states as WorkflowDefinition["states"],
        };
    }

    it("workflowCanPark sees a WAIT, an AGENT and an approval gate, at any depth", () => {
        const plain = definitionOf({ a: { type: WorkflowStateType.TRANSFORM, next: "z", transform: { output: { kind: WorkflowValueKind.LITERAL, literal: 1 } } }, z: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } } }, "a");
        expect(workflowCanPark(plain)).toBe(false);

        const waits = definitionOf({ w: { type: WorkflowStateType.WAIT, next: "z", wait: { kind: "DELAY", delayMs: 10, timeoutMs: 1_000 } }, z: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } } }, "w");
        expect(workflowCanPark(waits)).toBe(true);

        // An approval gate parks before the state runs, whatever the state is.
        const gated = definitionOf({ a: { type: WorkflowStateType.TRANSFORM, next: "z", approval: { timeoutMs: 1_000 }, transform: { output: { kind: WorkflowValueKind.LITERAL, literal: 1 } } }, z: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } } }, "a");
        expect(workflowCanPark(gated)).toBe(true);

        // And inside a nested scope, which parks on its own frame since 3.10.0.
        const nested = definitionOf({
            fan: {
                type: WorkflowStateType.PARALLEL,
                next: "z",
                parallel: { branches: [{ id: "b", startAt: "w", states: { w: { type: WorkflowStateType.WAIT, next: "e", wait: { kind: "DELAY", delayMs: 10, timeoutMs: 1_000 } }, e: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } } } }] },
            },
            z: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
        }, "fan");
        expect(workflowCanPark(nested)).toBe(true);
    });

    it("accepts a WAIT inside a branch and an item, and still refuses an AGENT there", () => {
        // Until 3.10.0 both were refused, and the reason given was addressing: a resume block named
        // one state of one graph and could not say "branch b, item 7, state ask". Frames removed
        // that - each scope has its own, each parks on its own, and a resume names the frame it
        // answers. What is left is the agent, which parks on a cursor of its own that a child frame
        // does not carry, so that one is still a publish-time refusal rather than a run-time hang.
        const branchWait = definitionOf({
            fan: {
                type: WorkflowStateType.PARALLEL,
                next: "z",
                parallel: { branches: [{ id: "b", startAt: "w", states: { w: { type: WorkflowStateType.WAIT, next: "e", wait: { kind: "HUMAN_TASK", timeoutMs: 60_000, form: {} } }, e: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } } } }] },
            },
            z: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
        }, "fan");
        expect(validateWorkflowDefinition(branchWait).issues).toEqual([]);

        const itemWait = definitionOf({
            each: {
                type: WorkflowStateType.FOREACH,
                next: "z",
                foreach: {
                    items: { kind: WorkflowValueKind.ARRAY, array: [{ kind: WorkflowValueKind.LITERAL, literal: 1 }] },
                    maxItems: 5,
                    concurrency: 1,
                    startAt: "w",
                    states: { w: { type: WorkflowStateType.WAIT, next: "e", wait: { kind: "DELAY", delayMs: 10, timeoutMs: 60_000 } }, e: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } } },
                },
            },
            z: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
        }, "each");
        expect(validateWorkflowDefinition(itemWait).issues).toEqual([]);

        const branchAgent = definitionOf({
            fan: {
                type: WorkflowStateType.PARALLEL,
                next: "z",
                parallel: { branches: [{ id: "b", startAt: "a", states: { a: { type: WorkflowStateType.AGENT, next: "e", agent: { goal: { kind: WorkflowValueKind.LITERAL, literal: "go" }, maxIterations: 3, tools: [] } }, e: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } } } }] },
            },
            z: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
        }, "fan");
        expect(validateWorkflowDefinition(branchAgent).issues.map((issue) => issue.code)).toContain(WorkflowValidationIssueCode.NESTED_AGENT_NOT_ALLOWED);
    });

    it("does not refuse a SUBWORKFLOW call to a child that can park: a child may park", () => {
        // A child parks on its own frame, like every other nested scope. `canPark` is therefore
        // informational - an editor wants to warn that calling this child can stop the run and put a
        // task in somebody's inbox - and never a refusal.
        const parent = definitionOf({
            call: { type: WorkflowStateType.SUBWORKFLOW, next: "z", subworkflow: { workflowKey: "CHILD", input: {} } },
            z: { type: WorkflowStateType.END, end: { outcome: WorkflowEndOutcome.SUCCEED } },
        }, "call");

        for (const canPark of [true, false, undefined]) {
            const result = validateWorkflowDefinition(parent, { workflows: [{ key: "CHILD", canPark }] });
            expect(result.issues.map((issue) => issue.code)).not.toContain("NESTED_AGENT_NOT_ALLOWED");
        }
    });
});

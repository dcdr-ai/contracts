import {
  ConditionGroup,
  ConditionLeaf,
  DEFAULT_CONDITION_PATH_LIMITS,
  evaluateConditionTreeOnScope,
  validateConditionTree,
} from "./conditions.contract";
import { ExecuteIntentRequest } from "./execution.contract";
import { IntentContract } from "./intent.contract";
import { PromptVariable, PromptVariableType } from "./prompts.contract";
import { Sha256HexDeps, stableJsonStringify } from "./utils.contract";

/**
 * Workflow contract: a declarative state machine composing intents, HTTP calls, choices and
 * transforms, plus pure helpers to validate, hash and walk definitions.
 *
 * Design rules
 * - One `WorkflowState` interface discriminated by `type` with one optional config block per type
 *   (enums + interfaces, no `type` aliases / unions).
 * - Values fed to states are `WorkflowValueNode` trees (literal / ref / fn / template / object /
 *   array). The `$ref` / `$fn` / `$template` JSON shorthand documented for authors is accepted at
 *   the boundary by `parseWorkflowValueShorthand` and produced by `formatWorkflowValueShorthand`.
 * - Editor layout lives inline (`display`) and is excluded from the definition hash.
 * - Nothing here performs I/O.
 *
 * Boundary note
 * - Run inputs and state outputs are untrusted JSON, hence `unknown` in the evaluation context.
 */

const LOG_SOURCE = "workflow.contract";

/** Definition schema version carried inside every definition. */
export enum WorkflowSchemaVersion {
  V1 = 1,
}

/**
 * Node kinds of the state machine.
 *
 * Notes
 * - `INTENT`, `HTTP`, `CHOICE`, `TRANSFORM`, `END` are the base catalog.
 * - `PARALLEL`, `FOREACH`, `WAIT`, `SUBWORKFLOW` are advanced states (capability-gated).
 */
export enum WorkflowStateType {
  INTENT = "INTENT",
  HTTP = "HTTP",
  CHOICE = "CHOICE",
  TRANSFORM = "TRANSFORM",
  END = "END",
  PARALLEL = "PARALLEL",
  FOREACH = "FOREACH",
  WAIT = "WAIT",
  SUBWORKFLOW = "SUBWORKFLOW",
  /** Bounded agentic loop: a planner intent picks tools from a closed set until it finishes or a bound is hit. */
  AGENT = "AGENT",
  /** Runs one capability of the published catalog with a typed argument form (see `WORKFLOW_CAPABILITIES`). */
  TOOL = "TOOL",
}

/** States that require the advanced-steps capability. */
export const WORKFLOW_ADVANCED_STATE_TYPES: readonly WorkflowStateType[] = [
  WorkflowStateType.PARALLEL,
  WorkflowStateType.FOREACH,
  WorkflowStateType.WAIT,
  WorkflowStateType.SUBWORKFLOW,
  WorkflowStateType.AGENT,
];

/** What an `AGENT` tool points at. */
export enum WorkflowAgentToolKind {
  /** An intent of the tenant registry, called with the arguments the planner produced. */
  INTENT = "INTENT",
  /** A state of the same scope (`INTENT`, `HTTP`, `TRANSFORM` or `SUBWORKFLOW`) executed as a tool; its mappings read `agent.args.*`. */
  STATE = "STATE",
  /**
   * Every tool an `MCP` connection advertises, discovered at run time and optionally narrowed by
   * name. One entry expands into as many catalog entries as the server exposes, which is why it
   * cannot be enumerated when the workflow is authored.
   */
  MCP = "MCP",
}

/** Decision the planner intent must return on every iteration. */
export enum WorkflowAgentAction {
  CALL_TOOL = "CALL_TOOL",
  FINISH = "FINISH",
}

/** Why an `AGENT` state stopped. */
export enum WorkflowAgentStopReason {
  FINISHED = "FINISHED",
  MAX_ITERATIONS = "MAX_ITERATIONS",
  /** `maxTrackedCalls` or `maxEstimatedCost` reached. */
  BUDGET_EXHAUSTED = "BUDGET_EXHAUSTED",
  TOO_MANY_TOOL_ERRORS = "TOO_MANY_TOOL_ERRORS",
  PLANNER_ERROR = "PLANNER_ERROR",
  /** `maxDurationMs` reached. */
  TIMEOUT = "TIMEOUT",
  /** The run was canceled by an operator while the loop was active. */
  CANCELED = "CANCELED",
}

/** What a piece of evidence points at. */
export enum WorkflowEvidenceKind {
  /** A URL the host fetched (`ref` is the URL). */
  URL = "URL",
  /** A stored file registered through the host (`ref` is the artifact id). */
  ARTIFACT = "ARTIFACT",
  /** A governed model call (`ref` is the gateway request id). */
  CALL_LOG = "CALL_LOG",
  /** Free text recorded by the planner or a human (`ref` is the note itself). */
  NOTE = "NOTE",
}

/** State types a `STATE` tool may point at. */
export const WORKFLOW_AGENT_TOOL_STATE_TYPES: readonly WorkflowStateType[] = [
  WorkflowStateType.INTENT,
  WorkflowStateType.HTTP,
  WorkflowStateType.TRANSFORM,
  WorkflowStateType.SUBWORKFLOW,
  /** Lets the planner ask a human or wait for an event; the run parks until it is resumed. */
  WorkflowStateType.WAIT,
  /**
   * A published capability. This is what keeps the catalog out of the state-type list: a capability
   * is written once as a `TOOL` state and is reachable both from a deterministic flow and from a
   * planner, through the `STATE` tool kind that already exists.
   */
  WorkflowStateType.TOOL,
];

/** What a host does when a state fails after its retries. */
export enum WorkflowStateErrorAction {
  /** Fail the whole run (default). */
  FAIL_RUN = "FAIL_RUN",
  /** Record the error, set the state output to `null`, continue with `next`. */
  CONTINUE = "CONTINUE",
  /** Record the error and jump to `onError.next`. */
  GOTO = "GOTO",
}

/** Retry backoff strategies for a state. */
export enum WorkflowRetryBackoff {
  FIXED = "FIXED",
  EXPONENTIAL = "EXPONENTIAL",
}

/**
 * Transport a workflow connection speaks.
 *
 * A connection is a destination the tenant approved, with its credentials, so the transport is a
 * property of the destination and everything specific to it lives in its own settings block. Adding
 * a transport is then a settings shape plus a runner, never another column or another entity.
 *
 * Notes
 * - Values are persisted by the control plane; never rename them.
 * - Declared ahead of the implementations on purpose; `WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS`
 *   says which ones actually execute today, so an editor never offers a dead transport.
 * - Plain `FTP` is deliberately absent: it moves credentials and payloads in clear text, and real
 *   deployments use `SFTP`.
 */
export enum WorkflowConnectionProtocol {
  /** Outbound HTTP(S); what `HTTP` states call. */
  HTTP = "HTTP",
  /** Model Context Protocol server: a discovered catalog of tools an `AGENT` may call. */
  MCP = "MCP",
  /** Mail relay for outbound messages. */
  SMTP = "SMTP",
  /** File exchange over SSH. */
  SFTP = "SFTP",
}

/** Protocols with a runner implementation behind them. */
export const WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS: WorkflowConnectionProtocol[] = [
  WorkflowConnectionProtocol.HTTP,
];

/**
 * What every connection carries whatever its transport.
 *
 * The control plane stores `allowedHosts` and the credentials reference as its own columns and
 * interpolates them into the settings block it hands the runner, so a runner receives one
 * self-contained object and never has to join anything.
 */
export interface WorkflowConnectionCommonSettings {
  /**
   * Destinations the egress guard accepts. The tenant-approved boundary of this connection; the
   * control plane defaults it from the endpoint host when the tenant declares none.
   */
  allowedHosts: string[];
  /** Wall-clock budget of a single operation. */
  timeoutMs: number;
  /**
   * Whether this connection needs secrets. The runner fetches them per run through
   * `GET /api/workflows/:runId/connection/:key`; they never travel in the descriptor.
   */
  requiresCredentials?: boolean;
}

/** `HTTP` connection settings. */
export interface WorkflowHttpConnectionSettings extends WorkflowConnectionCommonSettings {
  /** Absolute base URL every `HTTP` state path is resolved against. */
  baseUrl: string;
  maxResponseBytes: number;
  /** Allow plain `http://` (self-hosted deployments only; ignored in cloud). */
  allowInsecure?: boolean;
}

/** `MCP` connection settings. */
export interface WorkflowMcpConnectionSettings extends WorkflowConnectionCommonSettings {
  /** Absolute URL of the MCP server endpoint. */
  serverUrl: string;
  maxResponseBytes: number;
  /**
   * Tools the tenant approves from this server, by name. Empty or absent means every tool the
   * server advertises; an `AGENT` may narrow this further, never widen it.
   */
  allowedTools?: string[];
}

/** `SMTP` connection settings. */
export interface WorkflowSmtpConnectionSettings extends WorkflowConnectionCommonSettings {
  host: string;
  port: number;
  /** Implicit TLS (typically `465`); `false` still upgrades through STARTTLS when offered. */
  secure: boolean;
  /** Envelope sender used when a message carries none. */
  fromAddress: string;
}

/** `SFTP` connection settings. */
export interface WorkflowSftpConnectionSettings extends WorkflowConnectionCommonSettings {
  host: string;
  port: number;
  /** Directory every path is resolved against, so a workflow stays inside its own tree. */
  basePath: string;
}

/**
 * Settings of a connection: exactly one block, matching its `protocol`.
 *
 * Shaped like `WorkflowState` (one optional block per type) rather than as a union, so it follows
 * the same discrimination rule the rest of this contract uses.
 */
export interface WorkflowConnectionSettings {
  http?: WorkflowHttpConnectionSettings;
  mcp?: WorkflowMcpConnectionSettings;
  smtp?: WorkflowSmtpConnectionSettings;
  sftp?: WorkflowSftpConnectionSettings;
}

/** Settings block a protocol must fill, mirroring `WORKFLOW_STATE_CONFIG_FIELDS`. */
export const WORKFLOW_CONNECTION_SETTINGS_FIELDS: Record<WorkflowConnectionProtocol, keyof WorkflowConnectionSettings> = {
  [WorkflowConnectionProtocol.HTTP]: "http",
  [WorkflowConnectionProtocol.MCP]: "mcp",
  [WorkflowConnectionProtocol.SMTP]: "smtp",
  [WorkflowConnectionProtocol.SFTP]: "sftp",
};

/**
 * Who holds the credentials a capability runs with.
 *
 * The distinction is what decides whether a `TOOL` state needs a `connection`, and it is a real
 * split rather than a convenience: a platform-brokered capability runs on our account and is billed
 * per call, while a connection-brokered one reaches the tenant's own server with the tenant's own
 * secrets and costs us nothing.
 */
export enum WorkflowCapabilityBroker {
  /** We run it with our own credentials and bill the call. The tenant configures nothing. */
  PLATFORM = "PLATFORM",
  /** The tenant supplies a connection of the capability's protocol. */
  CONNECTION = "CONNECTION",
}

/**
 * One capability of the published catalog.
 *
 * A capability is a *typed* action ("search the web", "send an email"), as opposed to the `HTTP`
 * state, which is the untyped escape hatch where the tenant maps a URL and a body by hand. That is
 * the whole point: the tenant fills a form we designed, and a planner gets an `inputSchema` it can
 * satisfy without knowing anything about transports.
 *
 * Capabilities are versioned independently of the package: `version` moves when the argument or
 * result shape changes, so a workflow pinned to an older revision keeps validating.
 */
export interface WorkflowCapability {
  /** Stable dotted id, e.g. `web.search`. Never reused for a different meaning. */
  id: string;
  /** Revision of this capability's own contract, independent of the package version. */
  version: string;
  /** One line, in English. A planner reads this to decide whether the tool fits. */
  description: string;
  broker: WorkflowCapabilityBroker;
  /** Transport the connection must speak; set only for `CONNECTION` capabilities. */
  protocol?: WorkflowConnectionProtocol;
  /** Arguments the tenant form (or the planner) must produce. */
  inputSchema: Record<string, PromptVariable>;
  /** Shape of the result, so downstream states can reference it without running the flow. */
  outputSchema: Record<string, PromptVariable>;
}

/**
 * The catalog we publish.
 *
 * Deliberately small: every entry is a contract we have to keep working for every tenant that wired
 * it into a workflow, so a capability is added when it earns its place, not because a provider
 * happens to expose an endpoint.
 */
export const WORKFLOW_CAPABILITIES: readonly WorkflowCapability[] = [
  {
    id: "web.search",
    version: "1.0.0",
    description: "Searches the public web and returns ranked results with title, url and snippet.",
    broker: WorkflowCapabilityBroker.PLATFORM,
    inputSchema: {
      query: new PromptVariable(PromptVariableType.STRING, true, "What to search for, as a person would type it."),
      maxResults: new PromptVariable(PromptVariableType.INTEGER, false, "How many results to return (1-10, default 5).", undefined, undefined, undefined, undefined, 1, 10),
    },
    outputSchema: {
      results: new PromptVariable(PromptVariableType.ARRAY, true, "Ranked results, best first.", PromptVariableType.OBJECT, {
        title: new PromptVariable(PromptVariableType.STRING, true, "Result title."),
        url: new PromptVariable(PromptVariableType.STRING, true, "Absolute result URL."),
        snippet: new PromptVariable(PromptVariableType.STRING, false, "Extract of the page around the match."),
      }),
    },
  },
  {
    id: "mail.send",
    version: "1.0.0",
    description: "Sends an email through the tenant's own SMTP server.",
    broker: WorkflowCapabilityBroker.CONNECTION,
    protocol: WorkflowConnectionProtocol.SMTP,
    inputSchema: {
      to: new PromptVariable(PromptVariableType.ARRAY, true, "Recipient addresses.", PromptVariableType.STRING),
      subject: new PromptVariable(PromptVariableType.STRING, true, "Subject line."),
      body: new PromptVariable(PromptVariableType.STRING, true, "Message body."),
      html: new PromptVariable(PromptVariableType.BOOLEAN, false, "Whether the body is HTML rather than plain text."),
      cc: new PromptVariable(PromptVariableType.ARRAY, false, "Addresses in copy.", PromptVariableType.STRING),
    },
    outputSchema: {
      messageId: new PromptVariable(PromptVariableType.STRING, true, "Identifier the SMTP server assigned to the message."),
      accepted: new PromptVariable(PromptVariableType.ARRAY, true, "Addresses the server accepted.", PromptVariableType.STRING),
    },
  },
];

/**
 * Capabilities a runner can actually execute today.
 *
 * Same idea as `WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS`: an editor may show the rest so a tenant
 * can see what is coming, but it must not let them wire up something that will not run.
 */
export const WORKFLOW_IMPLEMENTED_CAPABILITIES: readonly string[] = ["web.search"];

/**
 * Looks a capability up by id.
 *
 * @param id Capability id.
 * @returns The capability, or `undefined` when the id is not in the catalog.
 */
export function findWorkflowCapability(id: string | null | undefined): WorkflowCapability | undefined {
  const key = String(id ?? "").trim();
  if (!key) return undefined;
  return WORKFLOW_CAPABILITIES.find((capability) => capability.id === key);
}

/**
 * One tool discovered on an MCP server at run time (v3.6.0).
 *
 * An `MCP` agent tool entry expands into as many of these as the server advertises, which is why it
 * cannot be enumerated when the workflow is authored. The runner discovers them through `tools/list`
 * and narrows them by the connection allowlist and the agent's own list before they ever reach a
 * planner, so this is the shape a planner sees, not the raw server payload.
 */
export interface WorkflowMcpDiscoveredTool {
  /** Name as the server advertises it, used verbatim in the `tools/call` request. */
  name: string;
  /** Description the planner reads to decide whether the tool fits. */
  description?: string;
  /** JSON Schema of the arguments, as published by the server. */
  inputSchema?: Record<string, unknown>;
}

/**
 * `TOOL` state configuration: run one capability of the catalog.
 *
 * Why this is one state type and not one per capability: for a planner a tool is only
 * `{id, description, inputSchema}`, so the extension point is the catalog, not the state machine.
 * A state type per capability would be a treadmill of contracts to version.
 */
export interface WorkflowToolStateConfig {
  /** Capability id, from `WORKFLOW_CAPABILITIES`. */
  capability: string;
  /**
   * Connection key. Required when the capability is `CONNECTION`-brokered, and rejected when it is
   * `PLATFORM`-brokered, where the credentials are ours and a tenant connection would be ignored.
   */
  connection?: string;
  /** Arguments, validated against the capability's `inputSchema`. */
  args?: Record<string, WorkflowValueNode>;
}

/** HTTP methods an `HTTP` state may use. */
export enum WorkflowHttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
}

/** How an `HTTP` state interprets the response body. */
export enum WorkflowHttpResponseType {
  JSON = "JSON",
  TEXT = "TEXT",
}

/** Terminal outcome of an `END` state. */
export enum WorkflowEndOutcome {
  SUCCEED = "SUCCEED",
  FAIL = "FAIL",
}

/** What a `WAIT` state waits for. */
export enum WorkflowWaitKind {
  DELAY = "DELAY",
  EXTERNAL_EVENT = "EXTERNAL_EVENT",
  HUMAN_TASK = "HUMAN_TASK",
}

/**
 * Closed catalog of value-mapping functions.
 *
 * Notes
 * - Every function is pure and total: unexpected argument types yield `null`, never throw.
 * - Arity is declared in `WORKFLOW_MAPPING_FUNCTION_META` and enforced by the validator.
 */
export enum WorkflowMappingFunction {
  CONCAT = "CONCAT",
  COALESCE = "COALESCE",
  TO_UPPER = "TO_UPPER",
  TO_LOWER = "TO_LOWER",
  TRIM = "TRIM",
  TO_NUMBER = "TO_NUMBER",
  TO_STRING = "TO_STRING",
  TO_BOOLEAN = "TO_BOOLEAN",
  LENGTH = "LENGTH",
  NOW_ISO = "NOW_ISO",
  JSON_STRINGIFY = "JSON_STRINGIFY",
  JSON_PARSE = "JSON_PARSE",
  PICK = "PICK",
  OMIT = "OMIT",
  FIRST = "FIRST",
  LAST = "LAST",
  JOIN = "JOIN",
  SPLIT = "SPLIT",
  ROUND = "ROUND",
  SUM = "SUM",
  COUNT = "COUNT",

  // Arithmetic
  ADD = "ADD",
  SUBTRACT = "SUBTRACT",
  MULTIPLY = "MULTIPLY",
  DIVIDE = "DIVIDE",
  MODULO = "MODULO",
  MIN = "MIN",
  MAX = "MAX",
  ABS = "ABS",
  FLOOR = "FLOOR",
  CEIL = "CEIL",
  AVERAGE = "AVERAGE",

  // Logic and comparison (booleans usable by IF)
  IF = "IF",
  EQ = "EQ",
  NEQ = "NEQ",
  GT = "GT",
  GTE = "GTE",
  LT = "LT",
  LTE = "LTE",
  AND = "AND",
  OR = "OR",
  NOT = "NOT",
  IS_NULL = "IS_NULL",
  IS_EMPTY = "IS_EMPTY",
  INCLUDES = "INCLUDES",

  // Strings
  REPLACE = "REPLACE",
  SUBSTRING = "SUBSTRING",
  PAD_START = "PAD_START",
  PAD_END = "PAD_END",

  // Arrays and objects
  PLUCK = "PLUCK",
  MERGE = "MERGE",
  KEYS = "KEYS",
  VALUES = "VALUES",
  GET = "GET",
  SLICE = "SLICE",
  UNIQUE = "UNIQUE",
  FLATTEN = "FLATTEN",
  SORT = "SORT",
  REVERSE = "REVERSE",
  FILTER_BY = "FILTER_BY",
  FIND_BY = "FIND_BY",
  RANGE = "RANGE",

  // Dates (ISO-8601 strings)
  DATE_ADD = "DATE_ADD",
  DATE_DIFF = "DATE_DIFF",
  FORMAT_DATE = "FORMAT_DATE",
  PARSE_DATE = "PARSE_DATE",

  // Encoding
  BASE64_ENCODE = "BASE64_ENCODE",
  BASE64_DECODE = "BASE64_DECODE",
  URL_ENCODE = "URL_ENCODE",
  URL_DECODE = "URL_DECODE",
}

/** Time units accepted by `DATE_ADD` / `DATE_DIFF`. */
export enum WorkflowDateUnit {
  MILLISECONDS = "MILLISECONDS",
  SECONDS = "SECONDS",
  MINUTES = "MINUTES",
  HOURS = "HOURS",
  DAYS = "DAYS",
}

/** Milliseconds per `WorkflowDateUnit`. */
export const WORKFLOW_DATE_UNIT_MS: Record<WorkflowDateUnit, number> = {
  [WorkflowDateUnit.MILLISECONDS]: 1,
  [WorkflowDateUnit.SECONDS]: 1000,
  [WorkflowDateUnit.MINUTES]: 60_000,
  [WorkflowDateUnit.HOURS]: 3_600_000,
  [WorkflowDateUnit.DAYS]: 86_400_000,
}

/** Kinds of nodes in a value-mapping tree. */
export enum WorkflowValueKind {
  LITERAL = "LITERAL",
  REF = "REF",
  FN = "FN",
  TEMPLATE = "TEMPLATE",
  OBJECT = "OBJECT",
  ARRAY = "ARRAY",
}

/** Roots a `$ref` path may start with. */
export enum WorkflowRefRoot {
  INPUT = "input",
  STATES = "states",
  RUN = "run",
  WORKFLOW = "workflow",
  ITEM = "item",
  /** Definition-level constants (`WorkflowDefinition.constants`). */
  CONSTANTS = "constants",
  /** Agent loop context (`agent.goal`, `agent.iteration`, `agent.args.*`, `agent.history`, `agent.notes`, `agent.summary`); only inside `AGENT` states and their tools. */
  AGENT = "agent",
}

/** Wildcard segment in reference paths: `states.list.output.items[*].id` plucks `id` from every element. */
export const WORKFLOW_REF_WILDCARD = "*";

/** Stable validation issue codes for workflow definitions. */
export enum WorkflowValidationIssueCode {
  DEFINITION_INVALID = "DEFINITION_INVALID",
  KEY_INVALID = "KEY_INVALID",
  SETTINGS_INVALID = "SETTINGS_INVALID",
  START_STATE_MISSING = "START_STATE_MISSING",
  STATE_ID_INVALID = "STATE_ID_INVALID",
  STATE_TYPE_INVALID = "STATE_TYPE_INVALID",
  STATE_CONFIG_MISSING = "STATE_CONFIG_MISSING",
  STATE_CONFIG_INVALID = "STATE_CONFIG_INVALID",
  STATE_ADVANCED_NOT_ALLOWED = "STATE_ADVANCED_NOT_ALLOWED",
  TRANSITION_TARGET_MISSING = "TRANSITION_TARGET_MISSING",
  TRANSITION_MISSING = "TRANSITION_MISSING",
  TRANSITION_NOT_ALLOWED = "TRANSITION_NOT_ALLOWED",
  STATE_UNREACHABLE = "STATE_UNREACHABLE",
  END_UNREACHABLE = "END_UNREACHABLE",
  CYCLE_WITHOUT_WAIT = "CYCLE_WITHOUT_WAIT",
  CONDITION_INVALID = "CONDITION_INVALID",
  VALUE_INVALID = "VALUE_INVALID",
  REF_INVALID = "REF_INVALID",
  REF_STATE_NOT_DOMINATING = "REF_STATE_NOT_DOMINATING",
  TEMPLATE_INVALID = "TEMPLATE_INVALID",
  FUNCTION_ARITY_INVALID = "FUNCTION_ARITY_INVALID",
  INTENT_UNKNOWN = "INTENT_UNKNOWN",
  INTENT_VAR_UNKNOWN = "INTENT_VAR_UNKNOWN",
  INTENT_VAR_MISSING = "INTENT_VAR_MISSING",
  INTENT_INPUT_PARTS_NOT_SUPPORTED = "INTENT_INPUT_PARTS_NOT_SUPPORTED",
  CONNECTION_UNKNOWN = "CONNECTION_UNKNOWN",
  /** `TOOL` state naming a capability that is not in the published catalog. */
  CAPABILITY_UNKNOWN = "CAPABILITY_UNKNOWN",
  /** `TOOL` state naming a catalog capability no runner executes yet. */
  CAPABILITY_NOT_IMPLEMENTED = "CAPABILITY_NOT_IMPLEMENTED",
  /** `TOOL` argument that the capability does not declare. */
  CAPABILITY_ARG_UNKNOWN = "CAPABILITY_ARG_UNKNOWN",
  /** Required `TOOL` argument left unmapped. */
  CAPABILITY_ARG_MISSING = "CAPABILITY_ARG_MISSING",
  HTTP_HEADER_FORBIDDEN = "HTTP_HEADER_FORBIDDEN",
  CONSTANT_INVALID = "CONSTANT_INVALID",
  AGENT_TOOL_INVALID = "AGENT_TOOL_INVALID",
  OUTPUT_SCHEMA_INVALID = "OUTPUT_SCHEMA_INVALID",
  OUTPUT_MAPPING_MISSING = "OUTPUT_MAPPING_MISSING",
  OUTPUT_KEY_UNKNOWN = "OUTPUT_KEY_UNKNOWN",
  OUTPUT_KEY_MISSING = "OUTPUT_KEY_MISSING",
  SUBWORKFLOW_UNKNOWN = "SUBWORKFLOW_UNKNOWN",
  SUBWORKFLOW_INPUT_UNKNOWN = "SUBWORKFLOW_INPUT_UNKNOWN",
  SUBWORKFLOW_INPUT_MISSING = "SUBWORKFLOW_INPUT_MISSING",
  LIMIT_EXCEEDED = "LIMIT_EXCEEDED",
}

/**
 * A literal, reference, function call, template, object or array in a value mapping.
 *
 * Exactly one payload field must be set, matching `kind`:
 * - `LITERAL`: `literal`
 * - `REF`: `ref` (+ optional `default`)
 * - `FN`: `fn` + `args`
 * - `TEMPLATE`: `template`
 * - `OBJECT`: `object`
 * - `ARRAY`: `array`
 */
export interface WorkflowValueNode {
  kind: WorkflowValueKind;

  /** `LITERAL` payload. */
  literal?: string | number | boolean | null;

  /** `REF` payload: path such as `input.ticket.text` or `states.classify.output.severity`. */
  ref?: string;

  /** `REF` fallback when the path resolves to `undefined`. */
  default?: string | number | boolean | null;

  /** `FN` payload: function name. */
  fn?: WorkflowMappingFunction;

  /** `FN` payload: arguments. */
  args?: WorkflowValueNode[];

  /** `TEMPLATE` payload: Mustache-style text with `{{path}}` placeholders. */
  template?: string;

  /** `OBJECT` payload. */
  object?: Record<string, WorkflowValueNode>;

  /** `ARRAY` payload. */
  array?: WorkflowValueNode[];
}

/** Arity bounds of a mapping function. */
export interface WorkflowMappingFunctionMeta {
  fn: WorkflowMappingFunction;
  minArgs: number;
  /** `null` = unbounded. */
  maxArgs: number | null;
}

/** Single source of truth for mapping-function arity. */
export const WORKFLOW_MAPPING_FUNCTION_META: Record<WorkflowMappingFunction, WorkflowMappingFunctionMeta> = {
  [WorkflowMappingFunction.CONCAT]: { fn: WorkflowMappingFunction.CONCAT, minArgs: 1, maxArgs: null },
  [WorkflowMappingFunction.COALESCE]: { fn: WorkflowMappingFunction.COALESCE, minArgs: 1, maxArgs: null },
  [WorkflowMappingFunction.TO_UPPER]: { fn: WorkflowMappingFunction.TO_UPPER, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.TO_LOWER]: { fn: WorkflowMappingFunction.TO_LOWER, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.TRIM]: { fn: WorkflowMappingFunction.TRIM, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.TO_NUMBER]: { fn: WorkflowMappingFunction.TO_NUMBER, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.TO_STRING]: { fn: WorkflowMappingFunction.TO_STRING, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.TO_BOOLEAN]: { fn: WorkflowMappingFunction.TO_BOOLEAN, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.LENGTH]: { fn: WorkflowMappingFunction.LENGTH, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.NOW_ISO]: { fn: WorkflowMappingFunction.NOW_ISO, minArgs: 0, maxArgs: 0 },
  [WorkflowMappingFunction.JSON_STRINGIFY]: { fn: WorkflowMappingFunction.JSON_STRINGIFY, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.JSON_PARSE]: { fn: WorkflowMappingFunction.JSON_PARSE, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.PICK]: { fn: WorkflowMappingFunction.PICK, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.OMIT]: { fn: WorkflowMappingFunction.OMIT, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.FIRST]: { fn: WorkflowMappingFunction.FIRST, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.LAST]: { fn: WorkflowMappingFunction.LAST, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.JOIN]: { fn: WorkflowMappingFunction.JOIN, minArgs: 1, maxArgs: 2 },
  [WorkflowMappingFunction.SPLIT]: { fn: WorkflowMappingFunction.SPLIT, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.ROUND]: { fn: WorkflowMappingFunction.ROUND, minArgs: 1, maxArgs: 2 },
  [WorkflowMappingFunction.SUM]: { fn: WorkflowMappingFunction.SUM, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.COUNT]: { fn: WorkflowMappingFunction.COUNT, minArgs: 1, maxArgs: 1 },

  [WorkflowMappingFunction.ADD]: { fn: WorkflowMappingFunction.ADD, minArgs: 2, maxArgs: null },
  [WorkflowMappingFunction.SUBTRACT]: { fn: WorkflowMappingFunction.SUBTRACT, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.MULTIPLY]: { fn: WorkflowMappingFunction.MULTIPLY, minArgs: 2, maxArgs: null },
  [WorkflowMappingFunction.DIVIDE]: { fn: WorkflowMappingFunction.DIVIDE, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.MODULO]: { fn: WorkflowMappingFunction.MODULO, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.MIN]: { fn: WorkflowMappingFunction.MIN, minArgs: 1, maxArgs: null },
  [WorkflowMappingFunction.MAX]: { fn: WorkflowMappingFunction.MAX, minArgs: 1, maxArgs: null },
  [WorkflowMappingFunction.ABS]: { fn: WorkflowMappingFunction.ABS, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.FLOOR]: { fn: WorkflowMappingFunction.FLOOR, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.CEIL]: { fn: WorkflowMappingFunction.CEIL, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.AVERAGE]: { fn: WorkflowMappingFunction.AVERAGE, minArgs: 1, maxArgs: 1 },

  [WorkflowMappingFunction.IF]: { fn: WorkflowMappingFunction.IF, minArgs: 3, maxArgs: 3 },
  [WorkflowMappingFunction.EQ]: { fn: WorkflowMappingFunction.EQ, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.NEQ]: { fn: WorkflowMappingFunction.NEQ, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.GT]: { fn: WorkflowMappingFunction.GT, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.GTE]: { fn: WorkflowMappingFunction.GTE, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.LT]: { fn: WorkflowMappingFunction.LT, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.LTE]: { fn: WorkflowMappingFunction.LTE, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.AND]: { fn: WorkflowMappingFunction.AND, minArgs: 1, maxArgs: null },
  [WorkflowMappingFunction.OR]: { fn: WorkflowMappingFunction.OR, minArgs: 1, maxArgs: null },
  [WorkflowMappingFunction.NOT]: { fn: WorkflowMappingFunction.NOT, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.IS_NULL]: { fn: WorkflowMappingFunction.IS_NULL, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.IS_EMPTY]: { fn: WorkflowMappingFunction.IS_EMPTY, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.INCLUDES]: { fn: WorkflowMappingFunction.INCLUDES, minArgs: 2, maxArgs: 2 },

  [WorkflowMappingFunction.REPLACE]: { fn: WorkflowMappingFunction.REPLACE, minArgs: 3, maxArgs: 3 },
  [WorkflowMappingFunction.SUBSTRING]: { fn: WorkflowMappingFunction.SUBSTRING, minArgs: 2, maxArgs: 3 },
  [WorkflowMappingFunction.PAD_START]: { fn: WorkflowMappingFunction.PAD_START, minArgs: 2, maxArgs: 3 },
  [WorkflowMappingFunction.PAD_END]: { fn: WorkflowMappingFunction.PAD_END, minArgs: 2, maxArgs: 3 },

  [WorkflowMappingFunction.PLUCK]: { fn: WorkflowMappingFunction.PLUCK, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.MERGE]: { fn: WorkflowMappingFunction.MERGE, minArgs: 1, maxArgs: null },
  [WorkflowMappingFunction.KEYS]: { fn: WorkflowMappingFunction.KEYS, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.VALUES]: { fn: WorkflowMappingFunction.VALUES, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.GET]: { fn: WorkflowMappingFunction.GET, minArgs: 2, maxArgs: 3 },
  [WorkflowMappingFunction.SLICE]: { fn: WorkflowMappingFunction.SLICE, minArgs: 2, maxArgs: 3 },
  [WorkflowMappingFunction.UNIQUE]: { fn: WorkflowMappingFunction.UNIQUE, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.FLATTEN]: { fn: WorkflowMappingFunction.FLATTEN, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.SORT]: { fn: WorkflowMappingFunction.SORT, minArgs: 1, maxArgs: 3 },
  [WorkflowMappingFunction.REVERSE]: { fn: WorkflowMappingFunction.REVERSE, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.FILTER_BY]: { fn: WorkflowMappingFunction.FILTER_BY, minArgs: 3, maxArgs: 3 },
  [WorkflowMappingFunction.FIND_BY]: { fn: WorkflowMappingFunction.FIND_BY, minArgs: 3, maxArgs: 3 },
  [WorkflowMappingFunction.RANGE]: { fn: WorkflowMappingFunction.RANGE, minArgs: 1, maxArgs: 2 },

  [WorkflowMappingFunction.DATE_ADD]: { fn: WorkflowMappingFunction.DATE_ADD, minArgs: 3, maxArgs: 3 },
  [WorkflowMappingFunction.DATE_DIFF]: { fn: WorkflowMappingFunction.DATE_DIFF, minArgs: 3, maxArgs: 3 },
  [WorkflowMappingFunction.FORMAT_DATE]: { fn: WorkflowMappingFunction.FORMAT_DATE, minArgs: 2, maxArgs: 2 },
  [WorkflowMappingFunction.PARSE_DATE]: { fn: WorkflowMappingFunction.PARSE_DATE, minArgs: 1, maxArgs: 1 },

  [WorkflowMappingFunction.BASE64_ENCODE]: { fn: WorkflowMappingFunction.BASE64_ENCODE, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.BASE64_DECODE]: { fn: WorkflowMappingFunction.BASE64_DECODE, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.URL_ENCODE]: { fn: WorkflowMappingFunction.URL_ENCODE, minArgs: 1, maxArgs: 1 },
  [WorkflowMappingFunction.URL_DECODE]: { fn: WorkflowMappingFunction.URL_DECODE, minArgs: 1, maxArgs: 1 },
};

/** Maximum array length `RANGE` will build. */
export const WORKFLOW_RANGE_MAX_LENGTH = 10_000;

/** Defense-in-depth limits for value trees and reference paths. */
export interface WorkflowValueLimits {
  /** Maximum nesting depth of a value tree. */
  maxDepth: number;
  /** Maximum nodes in a value tree. */
  maxNodes: number;
  /** Maximum `$ref` path length. */
  maxRefLength: number;
  /** Maximum `$ref` path segments. */
  maxRefSegments: number;
  /** Maximum template length. */
  maxTemplateLength: number;
}

/** Default value limits. */
export const DEFAULT_WORKFLOW_VALUE_LIMITS: WorkflowValueLimits = {
  maxDepth: 10,
  maxNodes: 500,
  maxRefLength: DEFAULT_CONDITION_PATH_LIMITS.maxPathLength,
  maxRefSegments: DEFAULT_CONDITION_PATH_LIMITS.maxDepth,
  maxTemplateLength: 4000,
};

/**
 * Presentation metadata; editors and requester-facing views read it, hosts ignore it, and it is
 * excluded from the definition hash.
 */
export interface WorkflowStateDisplay {
  label?: string;
  description?: string;
  /** PrimeIcons name. */
  icon?: string;
  /** Graph editor layout. */
  position?: WorkflowPosition;
  /** Shown in the requester-facing tracker (Apps). */
  requesterVisible?: boolean;
  /** Friendly label for that tracker. */
  requesterLabel?: string;
}

/** 2D position in the graph editor. */
export interface WorkflowPosition {
  x: number;
  y: number;
}

/** Per-state retry policy (state-level, distinct from the intent retry policy). */
export interface WorkflowRetryPolicy {
  maxAttempts: number;
  backoff: WorkflowRetryBackoff;
  backoffMs: number;
  backoffCapMs?: number;
  /** Declares the state idempotent so hosts may retry non-idempotent transports (HTTP POST). */
  safe?: boolean;
}

/** What to do when a state fails after its retries. */
export interface WorkflowStateErrorPolicy {
  action: WorkflowStateErrorAction;
  /** Target state for `GOTO`. */
  next?: string;
}

/** `INTENT` state configuration. */
export interface WorkflowIntentStateConfig {
  /** Intent key in the tenant registry. */
  intent: string;
  /** Prompt variables; validated against the intent `inputSchema` at publish time. */
  vars: Record<string, WorkflowValueNode>;
  /** Mapping resolving to `ExecutionInputPart[]` (asset references from input or previous states). */
  inputParts?: WorkflowValueNode;
  /** Optional routing hints, same shape as the execution request. */
  routing?: ExecuteIntentRequest["routing"];
  /** Forwarded as `ExecuteIntentRequest.context` (keeps `CONDITION_ON_CONTEXT` routing usable). */
  context?: Record<string, WorkflowValueNode>;
}

/** `HTTP` state configuration. */
export interface WorkflowHttpStateConfig {
  /** Connection key; the connection owns the base URL and the credentials. */
  connection: string;
  method: WorkflowHttpMethod;
  /** Relative path resolved against the connection base URL. */
  path: WorkflowValueNode;
  query?: Record<string, WorkflowValueNode>;
  /** Non-secret headers only; credential headers are rejected by the validator. */
  headers?: Record<string, WorkflowValueNode>;
  body?: WorkflowValueNode;
  responseType: WorkflowHttpResponseType;
  /** Accepted status codes; defaults to 2xx. */
  expectStatus?: number[];
}

/** One branch of a `CHOICE` state; first matching case wins. */
export interface WorkflowChoiceCase {
  id: string;
  condition: ConditionLeaf | ConditionGroup<ConditionLeaf>;
  next: string;
  display?: WorkflowStateDisplay;
}

/** `CHOICE` state configuration. */
export interface WorkflowChoiceStateConfig {
  choices: WorkflowChoiceCase[];
  /** Mandatory fallback target: no silent dead ends. */
  default: string;
}

/** `TRANSFORM` state configuration. */
export interface WorkflowTransformStateConfig {
  output: WorkflowValueNode;
}

/** `END` state configuration. */
export interface WorkflowEndStateConfig {
  outcome: WorkflowEndOutcome;
  /** Overrides `WorkflowDefinition.output`. */
  output?: WorkflowValueNode;
  /** Stable error code reported when `outcome` is `FAIL`. */
  errorCode?: string;
  /** Error message mapping when `outcome` is `FAIL`. */
  errorMessage?: WorkflowValueNode;
}

/** `WAIT` state configuration. */
export interface WorkflowWaitStateConfig {
  kind: WorkflowWaitKind;
  /** `DELAY`: milliseconds to wait. */
  delayMs?: number;
  /** `EXTERNAL_EVENT`: event key the resume call must carry. */
  eventKey?: string;
  /** `HUMAN_TASK`: typed payload the assignee fills; becomes the state output. */
  form?: Record<string, PromptVariable>;
  /** `HUMAN_TASK`: inbox routing hint (group key). */
  assignmentGroupKey?: string;
  /** `HUMAN_TASK`: mapping resolving to assignee identifiers (user ids or emails). */
  assignees?: WorkflowValueNode;
  /** `HUMAN_TASK`: mapping resolving to the instructions shown to the assignee. */
  instructions?: WorkflowValueNode;
  /** `HUMAN_TASK`: notify the requester when the task is created. */
  notifyRequester?: boolean;
  /**
   * `EXTERNAL_EVENT`: values the resume event payload must match (each key is compared with the
   * same key of the event payload). Lets many parked runs wait on the same `eventKey`.
   */
  correlation?: Record<string, WorkflowValueNode>;
  /** Maximum wait before `onError` applies. */
  timeoutMs: number;
}

/** One branch of a `PARALLEL` state: a nested sub-graph. */
export interface WorkflowParallelBranch {
  id: string;
  startAt: string;
  states: Record<string, WorkflowState>;
}

/**
 * `PARALLEL` state configuration.
 *
 * Output shape (`WorkflowParallelOutput`): `{ branches: { <branchId>: <branch run output> } }`.
 */
export interface WorkflowParallelStateConfig {
  branches: WorkflowParallelBranch[];
  /** Fail the state as soon as one branch fails (default `true`); otherwise wait for all. */
  failFast?: boolean;
}

/** Output recorded for a completed `PARALLEL` state. */
export interface WorkflowParallelOutput {
  branches: Record<string, unknown>;
}

/**
 * `FOREACH` state configuration.
 *
 * Output shape (`WorkflowForeachOutput`): `{ items: [<item run output>...], count, failed }`.
 */
export interface WorkflowForeachStateConfig {
  /** Mapping resolving to the array to iterate. */
  items: WorkflowValueNode;
  maxItems: number;
  concurrency: number;
  startAt: string;
  states: Record<string, WorkflowState>;
  /** Fail the state as soon as one item fails (default `true`); otherwise record `null` for it. */
  failFast?: boolean;
}

/** Output recorded for a completed `FOREACH` state. */
export interface WorkflowForeachOutput {
  items: unknown[];
  count: number;
  failed: number;
}

/** `SUBWORKFLOW` state configuration. */
export interface WorkflowSubworkflowStateConfig {
  workflowKey: string;
  /** Pinned version; omitted = published version. */
  version?: number;
  input: Record<string, WorkflowValueNode>;
}

/** One tool the planner of an `AGENT` state may call. */
export interface WorkflowAgentTool {
  /** Tool name presented to the planner (`^[a-z][a-z0-9_]*$`, unique within the state). */
  id: string;
  kind: WorkflowAgentToolKind;
  /** `INTENT` kind: intent key in the tenant registry. */
  intent?: string;
  /** `STATE` kind: state id in the same scope (see `WORKFLOW_AGENT_TOOL_STATE_TYPES`). */
  state?: string;
  /** Natural-language description the planner uses to pick the tool. */
  description: string;
  /** Arguments the planner must produce; defaults to the intent `inputSchema` for `INTENT` tools. */
  inputSchema?: Record<string, PromptVariable>;
}

/**
 * `AGENT` state configuration: a bounded plan-act loop.
 *
 * Loop (executed by the host)
 * 1. Call `plannerIntent` with `goal`, the tool catalog, `agent.history` and `context`; it must return a
 *    `WorkflowAgentDecision`.
 * 2. `CALL_TOOL` → run the tool with `args`, append `{ tool, args, output | error }` to `agent.history`,
 *    go to 1. `FINISH` → the state output is `WorkflowAgentOutput` with `result`.
 * 3. Stop with the matching `WorkflowAgentStopReason` when `maxIterations`, `maxTrackedCalls` or
 *    `maxToolErrors` is hit; the state then fails unless `finishOnBound` is true.
 *
 * Output shape: `WorkflowAgentOutput`.
 */
export interface WorkflowAgentStateConfig {
  /** Intent that decides the next action; its output must satisfy `WorkflowAgentDecision`. */
  plannerIntent: string;
  /** Mapping resolving to the goal handed to the planner (text or structured). */
  goal: WorkflowValueNode;
  /** Closed tool catalog; the planner cannot call anything else. */
  tools: WorkflowAgentTool[];
  /** Hard cap on planner iterations. */
  maxIterations: number;
  /** Optional budget in tracked calls (planner + tool intents) for the whole loop. */
  maxTrackedCalls?: number;
  /** Tool failures tolerated before the loop stops (default 0). */
  maxToolErrors?: number;
  /** When a bound is hit, finish with the last known state instead of failing (default `false`). */
  finishOnBound?: boolean;
  /** Wall-clock budget for the whole loop (capped by `WorkflowValidationCaps.maxAgentDurationMs`). */
  maxDurationMs?: number;
  /** Money budget for the whole loop, in the host's cost unit; exceeding it stops with `BUDGET_EXHAUSTED`. */
  maxEstimatedCost?: number;
  /** Only the last N trace entries are handed to the planner (older ones are summarized when `summarizerIntent` is set). */
  historyWindow?: number;
  /** Intent that compacts trace entries outside the window into `agent.summary`. */
  summarizerIntent?: string;
  /** Extra planner context (business data, constraints). */
  context?: Record<string, WorkflowValueNode>;
}

/** One piece of evidence attached to a step, an iteration or a decision. */
export interface WorkflowEvidence {
  kind: WorkflowEvidenceKind;
  /** URL, artifact id, gateway request id or note text depending on `kind`. */
  ref: string;
  title?: string;
  /** Hex sha256 of the referenced content when the host computed it. */
  sha256?: string;
  /** ISO-8601 */
  capturedAt?: string;
  stateId?: string;
  iteration?: number;
}

/**
 * What the planner intent puts on the wire each iteration.
 *
 * Separate from {@link WorkflowAgentDecision} on purpose: `args` and `result` are open by nature, and
 * an output schema carrying an open object is not portable across providers. Measured on real
 * providers in 2026-09: Anthropic refuses the request (`additionalProperties: true` is not
 * supported), OpenAI answers `200` with the field silently empty, and only Grok and Gemini return it
 * intact. Carrying them as JSON strings keeps the decision schema made of primitives, so every
 * provider can enforce it structurally; the host parses them back into the typed decision.
 */
export interface WorkflowAgentDecisionPayload {
  action: WorkflowAgentAction;
  /** `CALL_TOOL`: tool id from the catalog. */
  tool?: string;
  /** `CALL_TOOL`: arguments as a JSON object string, matching the tool `inputSchema`. */
  argsJson?: string;
  /** `FINISH`: final result as a JSON string. */
  resultJson?: string;
  /** Optional short explanation recorded in the trace. */
  rationale?: string;
  /** Scratchpad note persisted with the iteration and exposed as `agent.notes[]`. */
  notes?: string;
  /** Evidence declared by the planner (citations, sources). */
  evidence?: WorkflowEvidence[];
}

/**
 * The planner decision as the host works with it, once
 * {@link WorkflowAgentDecisionPayload} has been parsed.
 */
export interface WorkflowAgentDecision {
  action: WorkflowAgentAction;
  /** `CALL_TOOL`: tool id from the catalog. */
  tool?: string;
  /** `CALL_TOOL`: arguments matching the tool `inputSchema`. */
  args?: Record<string, unknown>;
  /** `FINISH`: final result of the loop. */
  result?: unknown;
  /** Optional short explanation recorded in the trace. */
  rationale?: string;
  /** Scratchpad note persisted with the iteration and exposed as `agent.notes[]`. */
  notes?: string;
  /** Evidence declared by the planner (citations, sources); hosts may cross-check it against the trace. */
  evidence?: WorkflowEvidence[];
}

/** One recorded planner step, exposed to tools as `agent.history[]`. */
export interface WorkflowAgentTraceEntry {
  iteration: number;
  tool: string;
  args: Record<string, unknown>;
  output?: unknown;
  error?: WorkflowStateError;
  rationale?: string;
  notes?: string;
  /** Evidence captured by the host while executing the tool plus evidence declared by the planner. */
  evidence?: WorkflowEvidence[];
}

/** Output recorded for a completed `AGENT` state. */
export interface WorkflowAgentOutput {
  result: unknown;
  stopReason: WorkflowAgentStopReason;
  iterations: number;
  trackedCalls: number;
  trace: WorkflowAgentTraceEntry[];
}

/** `agent.*` reference context, present only while a host runs an `AGENT` state or one of its tools. */
export interface WorkflowAgentRefContext {
  goal: unknown;
  iteration: number;
  /** Arguments of the tool call being executed (empty while planning). */
  args: Record<string, unknown>;
  history: WorkflowAgentTraceEntry[];
  /** Planner notes so far, oldest first. */
  notes?: string[];
  /** Compacted history produced by `summarizerIntent`, when any. */
  summary?: string;
}

/**
 * One node of the state machine.
 *
 * Exactly one config block must be set, matching `type` (see `WORKFLOW_STATE_CONFIG_FIELDS`).
 */
export interface WorkflowState {
  type: WorkflowStateType;
  display?: WorkflowStateDisplay;
  /** Successor state id; required unless `type` is `CHOICE` or `END`. */
  next?: string;
  onError?: WorkflowStateErrorPolicy;
  retry?: WorkflowRetryPolicy;
  timeoutMs?: number;
  /** Declared output shape; `INTENT` states inherit the intent `outputSchema` when omitted. */
  outputSchema?: Record<string, PromptVariable>;
  /** Human approval required before the state executes (any type but `END`, v3.1.1). */
  approval?: WorkflowStateApproval;

  intent?: WorkflowIntentStateConfig;
  http?: WorkflowHttpStateConfig;
  choice?: WorkflowChoiceStateConfig;
  transform?: WorkflowTransformStateConfig;
  end?: WorkflowEndStateConfig;
  wait?: WorkflowWaitStateConfig;
  parallel?: WorkflowParallelStateConfig;
  foreach?: WorkflowForeachStateConfig;
  subworkflow?: WorkflowSubworkflowStateConfig;
  agent?: WorkflowAgentStateConfig;
  tool?: WorkflowToolStateConfig;
}

/**
 * Human approval gate evaluated before a state executes (v3.1.1).
 *
 * The runner parks the run (`WAITING`, `HUMAN_TASK` semantics, `WorkflowRunnerWaitDetails.approval`)
 * right before executing the state; the resume payload is the fixed {@link WORKFLOW_APPROVAL_FORM}
 * (`approved`, optional `comment`). An approval executes the state as usual; a rejection fails the
 * state with the error code {@link WORKFLOW_APPROVAL_REJECTED_CODE}, so the state `onError` policy
 * decides what happens next. A timeout applies `onError` like any other wait.
 */
export interface WorkflowStateApproval {
  /** Inbox routing hint (group key). */
  assignmentGroupKey?: string;
  /** Mapping resolving to approver identifiers (user ids or emails). */
  assignees?: WorkflowValueNode;
  /** Mapping resolving to the text shown to the approver. */
  instructions?: WorkflowValueNode;
  /** Notify the requester when the gate opens. */
  notifyRequester?: boolean;
  /** Maximum wait for the decision before `onError` applies. */
  timeoutMs: number;
}

/** Payload of an approval decision (`WorkflowRunnerResumeState.resumePayload` of an approval gate). */
export interface WorkflowApprovalDecision {
  approved: boolean;
  comment?: string;
}

/** Fixed form of an approval decision (what the resume payload is validated against). */
export const WORKFLOW_APPROVAL_FORM: Record<string, PromptVariable> = {
  approved: { type: PromptVariableType.BOOLEAN, required: true, description: "Approve the state execution." },
  comment: { type: PromptVariableType.STRING, required: false, description: "Optional note of the approver." },
};

/** Error code of a state whose approval gate was rejected. */
export const WORKFLOW_APPROVAL_REJECTED_CODE = "APPROVAL_REJECTED";

/** Config block field name per state type. */
export const WORKFLOW_STATE_CONFIG_FIELDS: Record<WorkflowStateType, keyof WorkflowState> = {
  [WorkflowStateType.INTENT]: "intent",
  [WorkflowStateType.HTTP]: "http",
  [WorkflowStateType.CHOICE]: "choice",
  [WorkflowStateType.TRANSFORM]: "transform",
  [WorkflowStateType.END]: "end",
  [WorkflowStateType.WAIT]: "wait",
  [WorkflowStateType.PARALLEL]: "parallel",
  [WorkflowStateType.FOREACH]: "foreach",
  [WorkflowStateType.SUBWORKFLOW]: "subworkflow",
  [WorkflowStateType.AGENT]: "agent",
  [WorkflowStateType.TOOL]: "tool",
};

/**
 * Run-level settings.
 *
 * A definition never says *how* it runs: every run executes in the dedicated workflow runner, and
 * whether a caller waits for the result is a property of the trigger, not of the workflow.
 */
export interface WorkflowSettings {
  /** Whole-run timeout. */
  timeoutMs: number;
  /** Loop guard: maximum state executions per run. */
  maxTransitionsPerRun: number;
  /** Default error policy for states that declare none (`FAIL_RUN` when omitted). */
  onError?: WorkflowStateErrorPolicy;
  /** Optional quality sampling of the run's model calls (v3.6.0). */
  qcSampling?: WorkflowQcSamplingPolicy;
}

/** What a failed quality sample does to the run. */
export enum WorkflowQcFailAction {
  /** Record the failure and let the run continue; the sample is a measurement, not a gate. */
  CONTINUE = "CONTINUE",
  /** Park the run for a human to look at, with `HUMAN_TASK` semantics. */
  PARK = "PARK",
  /** Fail the sampled state, so its own `onError` policy decides what happens next. */
  FAIL_STATE = "FAIL_STATE",
}

/**
 * Quality sampling of a workflow's model calls (v3.6.0).
 *
 * Sampling exists because checking every call is not affordable and checking none is not credible.
 * A sampled step enters the QC queue that already exists for intent calls, so nothing new has to be
 * built to review it; what this policy adds is *which* calls get sampled and what a failure does.
 *
 * `everyNth` and `tools` compose as a union: a step is sampled if either rule selects it, which lets
 * a tenant watch one risky tool closely while sampling the rest thinly.
 */
export interface WorkflowQcSamplingPolicy {
  /** Sample one call in every N. `1` samples everything; `0` or absent disables the rule. */
  everyNth?: number;
  /**
   * Always sample calls made by these tools or states, whatever `everyNth` says. Ids are state ids,
   * or capability ids for a `TOOL` state.
   */
  tools?: string[];
  /** What a failed sample does; `CONTINUE` when omitted, so enabling sampling never changes control flow by surprise. */
  onQcFail?: WorkflowQcFailAction;
  /** Inbox routing hint for `PARK`, mirroring `WorkflowStateApproval.assignmentGroupKey`. */
  assignmentGroupKey?: string;
}

/** The declarative workflow. */
export interface WorkflowDefinition {
  schemaVersion: WorkflowSchemaVersion;
  /** `^[A-Z][A-Z0-9_-]*$` (same rule as intents). */
  key: string;
  name: string;
  description?: string;
  /** Typed run input; `ASSET` variables allowed. */
  input?: Record<string, PromptVariable>;
  /** Definition-level scalar constants, exposed to references as `constants.*`. */
  constants?: Record<string, string | number | boolean | null>;
  /**
   * Typed run output: the contract callers, `SUBWORKFLOW` parents and result views rely on.
   * When declared, `output` and every `END.output` are validated against it at publish time and
   * the resolved run output is validated against it by the host when the run finishes.
   */
  outputSchema?: Record<string, PromptVariable>;
  /** Default run output mapping (must satisfy `outputSchema`); an `END` state may override it. */
  output?: WorkflowValueNode;
  settings: WorkflowSettings;
  startAt: string;
  states: Record<string, WorkflowState>;
}

/**
 * Published workflow as handed to hosts (runner, editors): identity, immutable hash and definition.
 */
export interface WorkflowContract {
  id: string;
  key: string;
  version: number;
  /** `computeWorkflowDefinitionSha256` of `definition`. */
  sha256: string;
  active: boolean;
  definition: WorkflowDefinition;
}

/** Host caps applied by the validator (typically derived from tenant entitlements). */
export interface WorkflowValidationCaps {
  maxStates: number;
  /** Maximum nesting of `PARALLEL` / `FOREACH` sub-graphs. */
  maxNestingDepth: number;
  maxTransitionsPerRun: number;
  maxTimeoutMs: number;
  allowAdvancedStates: boolean;
  /** Maximum `AGENT.maxIterations` a definition may declare. */
  maxAgentIterations: number;
  /** Maximum `AGENT.maxDurationMs` a definition may declare. */
  maxAgentDurationMs: number;
}

/** Default caps used when the host passes none. */
export const DEFAULT_WORKFLOW_VALIDATION_CAPS: WorkflowValidationCaps = {
  maxStates: 100,
  maxNestingDepth: 3,
  maxTransitionsPerRun: 200,
  maxTimeoutMs: 24 * 60 * 60 * 1000,
  allowAdvancedStates: true,
  maxAgentIterations: 25,
  maxAgentDurationMs: 24 * 60 * 60 * 1000,
};

/** Minimal intent description the validator needs (a subset of `IntentContract`). */
export interface WorkflowValidationIntent {
  intent: string;
  inputSchema?: Record<string, PromptVariable>;
  outputSchema?: Record<string, PromptVariable>;
}

/** Minimal description of another published workflow (for `SUBWORKFLOW` cross-checks). */
export interface WorkflowValidationWorkflow {
  key: string;
  inputSchema?: Record<string, PromptVariable>;
  outputSchema?: Record<string, PromptVariable>;
}

/** Everything the validator may cross-check a definition against. */
export interface WorkflowValidationContext {
  /** Known intents; when omitted, intent references are not checked. */
  intents?: WorkflowValidationIntent[];
  /** Known workflows (for `SUBWORKFLOW` states); when omitted, sub-workflow references are not checked. */
  workflows?: WorkflowValidationWorkflow[];
  /** Known connection keys; when omitted, connection references are not checked. */
  connections?: string[];
  caps?: WorkflowValidationCaps;
  valueLimits?: WorkflowValueLimits;
}

/** One validation finding addressed by a JSON-ish path (`states.classify.intent.vars.ticket`). */
export interface WorkflowValidationIssue {
  path: string;
  code: WorkflowValidationIssueCode;
  message: string;
}

/** Result of `validateWorkflowDefinition`. */
export interface WorkflowValidationResult {
  valid: boolean;
  issues: WorkflowValidationIssue[];
  /** Total states including nested sub-graphs. */
  stateCount: number;
  /** Deepest sub-graph nesting reached (0 = flat). */
  nestingDepth: number;
}

/** Status of a state execution as seen by value references. */
export enum WorkflowStateRunStatus {
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED",
}

/** Snapshot of one executed state, exposed to references as `states.<id>`. */
export interface WorkflowStateSnapshot {
  status: WorkflowStateRunStatus;
  output: unknown;
}

/** Run metadata exposed to references as `run.*`. */
export interface WorkflowRunRefContext {
  id: string;
  startedAt?: string;
  attempt?: number;
  requester?: Record<string, unknown>;
}

/** Workflow metadata exposed to references as `workflow.*`. */
export interface WorkflowRefContext {
  key: string;
  version: number;
}

/** `FOREACH` iteration metadata exposed as `item.*`. */
export interface WorkflowItemRefContext {
  value: unknown;
  index: number;
}

/** Evaluation context for value resolution and choice evaluation. */
export interface WorkflowValueContext {
  input: Record<string, unknown>;
  states: Record<string, WorkflowStateSnapshot>;
  /** Definition constants (`constants.*`); hosts copy `WorkflowDefinition.constants` here. */
  constants?: Record<string, string | number | boolean | null>;
  run: WorkflowRunRefContext;
  workflow: WorkflowRefContext;
  item?: WorkflowItemRefContext;
  agent?: WorkflowAgentRefContext;
  /** Clock used by `NOW_ISO`; defaults to `Date.now`. */
  now?: () => number;
  limits?: WorkflowValueLimits;
}

/** Outcome of executing one state (reported by the host for I/O states, computed locally otherwise). */
export enum WorkflowStateOutcomeStatus {
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

/** What the walker decided after a state outcome. */
export enum WorkflowTransitionKind {
  /** Move to `next`. */
  CONTINUE = "CONTINUE",
  /** An `END` state was reached; `runOutput` / `endOutcome` are set. */
  END = "END",
  /** The state failed and `onError` routed the run (`CONTINUE` with null output or `GOTO`). */
  ERROR_HANDLED = "ERROR_HANDLED",
  /** The state failed and the run must fail. */
  FAIL = "FAIL",
}

/** Error carried by a failed state outcome. */
export interface WorkflowStateError {
  code: string;
  message: string;
}

/** Result of executing (host) or evaluating (contracts) one state. */
export interface WorkflowStateOutcome {
  status: WorkflowStateOutcomeStatus;
  output?: unknown;
  error?: WorkflowStateError;
  /** Matching `CHOICE` case id (`null` = default branch). */
  caseId?: string | null;
}

/** Decision returned by `resolveWorkflowTransition`. */
export interface WorkflowTransition {
  kind: WorkflowTransitionKind;
  /** Successor state id for `CONTINUE` / `ERROR_HANDLED`. */
  next?: string;
  /** Snapshot the host must record for the executed state. */
  snapshot: WorkflowStateSnapshot;
  /** `END`: terminal outcome. */
  endOutcome?: WorkflowEndOutcome;
  /** `END`: resolved run output. */
  runOutput?: unknown;
  /** `END` with `FAIL` outcome, or `FAIL`: the error to report. */
  error?: WorkflowStateError;
  /** `CHOICE`: matching case id (`null` = default). */
  caseId?: string | null;
}

/** Result of `selectChoiceNext`. */
export interface WorkflowChoiceSelection {
  next: string;
  /** Matching case id, or `null` when the default branch was taken. */
  caseId: string | null;
}

interface RefPathParts {
  root: WorkflowRefRoot;
  segments: string[];
}

interface GraphValidationScope {
  states: Record<string, WorkflowState>;
  startAt: string;
  /** Address prefix for issues. */
  path: string;
  /** State ids from enclosing scopes that are visible to `$ref`s (dominating the container). */
  outerVisibleStates: Set<string>;
  nesting: number;
}

interface GraphValidationAccumulator {
  issues: WorkflowValidationIssue[];
  stateCount: number;
  nestingDepth: number;
}

const STATE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const WORKFLOW_KEY_PATTERN = /^[A-Z][A-Z0-9_-]*$/;
const TEMPLATE_PLACEHOLDER_PATTERN = /\{\{\{?\s*([^{}]*?)\s*\}?\}\}/g;
const TEMPLATE_SECTION_PATTERN = /\{\{\s*[#^/>!&]/;
const FORBIDDEN_HTTP_HEADERS: readonly string[] = [
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
];

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
 * Returns true for the scalar literals the DSL accepts.
 */
function isScalarLiteral(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

/**
 * Splits a reference path into its root and segments.
 *
 * Grammar
 * - `root.seg.seg[0].seg` — dot-separated segments, optional `[index]` suffixes on any segment.
 * - Returns `null` when the path is malformed or exceeds the limits.
 */
export function parseWorkflowRefPath(
  path: string,
  limits: WorkflowValueLimits = DEFAULT_WORKFLOW_VALUE_LIMITS,
): RefPathParts | null {
  const p = String(path ?? "").trim();
  if (!p || p.length > limits.maxRefLength) return null;

  const segments: string[] = [];
  for (const rawSegment of p.split(".")) {
    const segment = rawSegment.trim();
    if (!segment) return null;
    const match = /^([A-Za-z_$][A-Za-z0-9_$-]*)((?:\[(?:\d+|\*)\])*)$/.exec(segment);
    if (!match) return null;
    segments.push(match[1]);
    const indexes = match[2];
    if (indexes) {
      for (const idx of indexes.match(/\d+|\*/g) ?? []) {
        segments.push(idx);
      }
    }
  }
  if (segments.length === 0 || segments.length > limits.maxRefSegments) return null;

  const root = segments[0];
  if (!(Object.values(WorkflowRefRoot) as string[]).includes(root)) return null;

  return { root: root as WorkflowRefRoot, segments: segments.slice(1) };
}

/**
 * Walks `segments` from `root`, entering plain objects by key and arrays by numeric index.
 * Returns `undefined` when the path cannot be followed.
 */
function walkSegments(root: unknown, segments: string[]): unknown {
  let cur: unknown = root;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === WORKFLOW_REF_WILDCARD) {
      // `[*]` maps the remaining path over every element; missing elements are dropped.
      if (!Array.isArray(cur)) return undefined;
      const rest = segments.slice(i + 1);
      return cur.map((element) => walkSegments(element, rest)).filter((v) => v !== undefined);
    }
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
 * Resolves a reference path against the evaluation context.
 *
 * Roots
 * - `input.*`, `states.<id>.output.*`, `states.<id>.status`, `run.*`, `workflow.*`, `item.value.*` / `item.index`.
 * - Returns `undefined` for unknown roots, malformed paths and missing values.
 */
/**
 * Projects the agent context onto the `agent.*` reference root.
 */
function agentScopeOf(agent: WorkflowAgentRefContext): Record<string, unknown> {
  return {
    goal: agent.goal,
    iteration: agent.iteration,
    args: agent.args,
    history: agent.history,
    notes: agent.notes ?? [],
    summary: agent.summary ?? null,
  };
}

export function resolveWorkflowRef(path: string, ctx: WorkflowValueContext): unknown {
  const parsed = parseWorkflowRefPath(path, ctx.limits ?? DEFAULT_WORKFLOW_VALUE_LIMITS);
  if (!parsed) return undefined;

  switch (parsed.root) {
    case WorkflowRefRoot.INPUT:
      return walkSegments(ctx.input, parsed.segments);
    case WorkflowRefRoot.STATES: {
      const [stateId, ...rest] = parsed.segments;
      if (!stateId) return undefined;
      const snapshot = ctx.states[stateId];
      if (!snapshot) return undefined;
      return walkSegments({ status: snapshot.status, output: snapshot.output }, rest);
    }
    case WorkflowRefRoot.RUN:
      return walkSegments(ctx.run, parsed.segments);
    case WorkflowRefRoot.WORKFLOW:
      return walkSegments(ctx.workflow, parsed.segments);
    case WorkflowRefRoot.ITEM:
      if (!ctx.item) return undefined;
      return walkSegments({ value: ctx.item.value, index: ctx.item.index }, parsed.segments);
    case WorkflowRefRoot.CONSTANTS:
      return walkSegments(ctx.constants ?? {}, parsed.segments);
    case WorkflowRefRoot.AGENT:
      if (!ctx.agent) return undefined;
      return walkSegments(
        agentScopeOf(ctx.agent),
        parsed.segments,
      );
    default:
      return undefined;
  }
}

/**
 * Converts a resolved value to the text form used by templates and `CONCAT`.
 */
function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return stableJsonStringify(value);
}

/**
 * Renders a Mustache-style template: `{{path}}` and `{{{path}}}` placeholders are replaced by the
 * referenced value's text form (empty when missing).
 *
 * Notes
 * - Only variable interpolation is supported (no sections, partials or comments); the validator
 *   rejects templates that use them.
 * - No HTML escaping: workflow templates feed prompts and payloads, not HTML.
 */
export function renderWorkflowTemplate(template: string, ctx: WorkflowValueContext): string {
  return String(template ?? "").replace(TEMPLATE_PLACEHOLDER_PATTERN, (_match, rawPath: string) =>
    toText(resolveWorkflowRef(rawPath, ctx)),
  );
}

/**
 * Lists the placeholder paths used by a template (used by the validator).
 */
export function listWorkflowTemplateRefs(template: string): string[] {
  const out: string[] = [];
  for (const match of String(template ?? "").matchAll(TEMPLATE_PLACEHOLDER_PATTERN)) {
    out.push(match[1].trim());
  }
  return out;
}

/**
 * Coerces a value to a finite number, or `null`.
 */
function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return null;
}

/**
 * Applies one mapping function to already-resolved arguments.
 *
 * Notes
 * - Pure and total: wrong argument types yield `null` rather than throwing, so a bad upstream value
 *   never crashes a run; the validator guards arity at publish time.
 */
export function applyWorkflowMappingFunction(
  fn: WorkflowMappingFunction,
  args: unknown[],
  now: () => number = Date.now,
): unknown {
  switch (fn) {
    case WorkflowMappingFunction.CONCAT:
      return args.map(toText).join("");
    case WorkflowMappingFunction.COALESCE:
      return args.find((a) => a !== null && a !== undefined && a !== "") ?? null;
    case WorkflowMappingFunction.TO_UPPER:
      return typeof args[0] === "string" ? args[0].toUpperCase() : null;
    case WorkflowMappingFunction.TO_LOWER:
      return typeof args[0] === "string" ? args[0].toLowerCase() : null;
    case WorkflowMappingFunction.TRIM:
      return typeof args[0] === "string" ? args[0].trim() : null;
    case WorkflowMappingFunction.TO_NUMBER:
      return toNumberOrNull(args[0]);
    case WorkflowMappingFunction.TO_STRING:
      return args[0] === null || args[0] === undefined ? null : toText(args[0]);
    case WorkflowMappingFunction.TO_BOOLEAN: {
      const v = args[0];
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v !== 0;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true" || s === "1" || s === "yes") return true;
        if (s === "false" || s === "0" || s === "no" || s === "") return false;
      }
      return null;
    }
    case WorkflowMappingFunction.LENGTH: {
      const v = args[0];
      if (typeof v === "string" || Array.isArray(v)) return v.length;
      if (isPlainObject(v)) return Object.keys(v).length;
      return null;
    }
    case WorkflowMappingFunction.NOW_ISO:
      return new Date(now()).toISOString();
    case WorkflowMappingFunction.JSON_STRINGIFY:
      return args[0] === undefined ? null : stableJsonStringify(args[0]);
    case WorkflowMappingFunction.JSON_PARSE: {
      if (typeof args[0] !== "string") return null;
      try {
        return JSON.parse(args[0]) as unknown;
      } catch {
        return null;
      }
    }
    case WorkflowMappingFunction.PICK:
    case WorkflowMappingFunction.OMIT: {
      const source = args[0];
      const keys = args[1];
      if (!isPlainObject(source) || !Array.isArray(keys)) return null;
      const wanted = new Set(keys.map(toText));
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(source)) {
        const keep = fn === WorkflowMappingFunction.PICK ? wanted.has(k) : !wanted.has(k);
        if (keep) out[k] = v;
      }
      return out;
    }
    case WorkflowMappingFunction.FIRST:
      return Array.isArray(args[0]) && args[0].length > 0 ? args[0][0] : null;
    case WorkflowMappingFunction.LAST:
      return Array.isArray(args[0]) && args[0].length > 0 ? args[0][args[0].length - 1] : null;
    case WorkflowMappingFunction.JOIN:
      return Array.isArray(args[0]) ? args[0].map(toText).join(args.length > 1 ? toText(args[1]) : ",") : null;
    case WorkflowMappingFunction.SPLIT:
      return typeof args[0] === "string" ? args[0].split(toText(args[1])) : null;
    case WorkflowMappingFunction.ROUND: {
      const n = toNumberOrNull(args[0]);
      if (n === null) return null;
      const digits = args.length > 1 ? toNumberOrNull(args[1]) ?? 0 : 0;
      const factor = Math.pow(10, Math.max(0, Math.min(12, Math.trunc(digits))));
      return Math.round(n * factor) / factor;
    }
    case WorkflowMappingFunction.SUM: {
      if (!Array.isArray(args[0])) return null;
      let total = 0;
      for (const v of args[0]) {
        const n = toNumberOrNull(v);
        if (n === null) return null;
        total += n;
      }
      return total;
    }
    case WorkflowMappingFunction.COUNT:
      return Array.isArray(args[0]) ? args[0].length : null;

    case WorkflowMappingFunction.ADD:
    case WorkflowMappingFunction.MULTIPLY: {
      const numbers = args.map(toNumberOrNull);
      if (numbers.some((n) => n === null)) return null;
      return (numbers as number[]).reduce((acc, n) => (fn === WorkflowMappingFunction.ADD ? acc + n : acc * n));
    }
    case WorkflowMappingFunction.SUBTRACT:
    case WorkflowMappingFunction.DIVIDE:
    case WorkflowMappingFunction.MODULO: {
      const a = toNumberOrNull(args[0]);
      const b = toNumberOrNull(args[1]);
      if (a === null || b === null) return null;
      if (fn === WorkflowMappingFunction.SUBTRACT) return a - b;
      if (b === 0) return null;
      return fn === WorkflowMappingFunction.DIVIDE ? a / b : a % b;
    }
    case WorkflowMappingFunction.MIN:
    case WorkflowMappingFunction.MAX: {
      const source = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      const numbers = source.map(toNumberOrNull);
      if (numbers.length === 0 || numbers.some((n) => n === null)) return null;
      return fn === WorkflowMappingFunction.MIN ? Math.min(...(numbers as number[])) : Math.max(...(numbers as number[]));
    }
    case WorkflowMappingFunction.ABS:
    case WorkflowMappingFunction.FLOOR:
    case WorkflowMappingFunction.CEIL: {
      const n = toNumberOrNull(args[0]);
      if (n === null) return null;
      if (fn === WorkflowMappingFunction.ABS) return Math.abs(n);
      return fn === WorkflowMappingFunction.FLOOR ? Math.floor(n) : Math.ceil(n);
    }
    case WorkflowMappingFunction.AVERAGE: {
      if (!Array.isArray(args[0]) || args[0].length === 0) return null;
      const numbers = args[0].map(toNumberOrNull);
      if (numbers.some((n) => n === null)) return null;
      return (numbers as number[]).reduce((acc, n) => acc + n, 0) / numbers.length;
    }

    case WorkflowMappingFunction.IF:
      return isTruthy(args[0]) ? args[1] : args[2];
    case WorkflowMappingFunction.EQ:
      return looseEquals(args[0], args[1]);
    case WorkflowMappingFunction.NEQ:
      return !looseEquals(args[0], args[1]);
    case WorkflowMappingFunction.GT:
    case WorkflowMappingFunction.GTE:
    case WorkflowMappingFunction.LT:
    case WorkflowMappingFunction.LTE: {
      const cmp = compareValues(args[0], args[1]);
      if (cmp === null) return null;
      if (fn === WorkflowMappingFunction.GT) return cmp > 0;
      if (fn === WorkflowMappingFunction.GTE) return cmp >= 0;
      if (fn === WorkflowMappingFunction.LT) return cmp < 0;
      return cmp <= 0;
    }
    case WorkflowMappingFunction.AND:
      return args.every(isTruthy);
    case WorkflowMappingFunction.OR:
      return args.some(isTruthy);
    case WorkflowMappingFunction.NOT:
      return !isTruthy(args[0]);
    case WorkflowMappingFunction.IS_NULL:
      return args[0] === null || args[0] === undefined;
    case WorkflowMappingFunction.IS_EMPTY: {
      const v = args[0];
      if (v === null || v === undefined) return true;
      if (typeof v === "string" || Array.isArray(v)) return v.length === 0;
      if (isPlainObject(v)) return Object.keys(v).length === 0;
      return false;
    }
    case WorkflowMappingFunction.INCLUDES: {
      const haystack = args[0];
      if (typeof haystack === "string") return haystack.includes(toText(args[1]));
      if (Array.isArray(haystack)) return haystack.some((element) => looseEquals(element, args[1]));
      return null;
    }

    case WorkflowMappingFunction.REPLACE: {
      if (typeof args[0] !== "string") return null;
      const search = toText(args[1]);
      if (!search) return args[0];
      return args[0].split(search).join(toText(args[2]));
    }
    case WorkflowMappingFunction.SUBSTRING: {
      if (typeof args[0] !== "string") return null;
      const start = toNumberOrNull(args[1]);
      if (start === null) return null;
      const length = args.length > 2 ? toNumberOrNull(args[2]) : null;
      const from = Math.max(0, Math.trunc(start));
      return length === null ? args[0].slice(from) : args[0].slice(from, from + Math.max(0, Math.trunc(length)));
    }
    case WorkflowMappingFunction.PAD_START:
    case WorkflowMappingFunction.PAD_END: {
      const text = args[0] === null || args[0] === undefined ? null : toText(args[0]);
      const width = toNumberOrNull(args[1]);
      if (text === null || width === null) return null;
      const fill = args.length > 2 ? toText(args[2]) || " " : " ";
      const target = Math.min(1000, Math.max(0, Math.trunc(width)));
      return fn === WorkflowMappingFunction.PAD_START ? text.padStart(target, fill) : text.padEnd(target, fill);
    }

    case WorkflowMappingFunction.PLUCK: {
      if (!Array.isArray(args[0])) return null;
      const keyPath = toText(args[1]).split(".").filter((seg) => seg.length > 0);
      return args[0].map((element) => walkSegments(element, keyPath)).map((v) => (v === undefined ? null : v));
    }
    case WorkflowMappingFunction.MERGE: {
      const out: Record<string, unknown> = {};
      for (const source of args) {
        if (isPlainObject(source)) Object.assign(out, source);
      }
      return out;
    }
    case WorkflowMappingFunction.KEYS:
      return isPlainObject(args[0]) ? Object.keys(args[0]) : null;
    case WorkflowMappingFunction.VALUES:
      return isPlainObject(args[0]) ? Object.values(args[0]) : null;
    case WorkflowMappingFunction.GET: {
      const keyPath = toText(args[1]).split(".").filter((seg) => seg.length > 0);
      const found = walkSegments(args[0], keyPath);
      if (found !== undefined) return found;
      return args.length > 2 ? args[2] : null;
    }
    case WorkflowMappingFunction.SLICE: {
      const source = args[0];
      if (typeof source !== "string" && !Array.isArray(source)) return null;
      const start = toNumberOrNull(args[1]);
      if (start === null) return null;
      const end = args.length > 2 ? toNumberOrNull(args[2]) : null;
      return end === null ? source.slice(Math.trunc(start)) : source.slice(Math.trunc(start), Math.trunc(end));
    }
    case WorkflowMappingFunction.UNIQUE: {
      if (!Array.isArray(args[0])) return null;
      const seen = new Set<string>();
      const out: unknown[] = [];
      for (const element of args[0]) {
        const key = stableJsonStringify(element);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(element);
      }
      return out;
    }
    case WorkflowMappingFunction.FLATTEN: {
      if (!Array.isArray(args[0])) return null;
      const out: unknown[] = [];
      for (const element of args[0]) {
        if (Array.isArray(element)) out.push(...element);
        else out.push(element);
      }
      return out;
    }
    case WorkflowMappingFunction.SORT: {
      if (!Array.isArray(args[0])) return null;
      const keyPath = args.length > 1 && args[1] !== null && args[1] !== undefined ? toText(args[1]).split(".").filter((seg) => seg.length > 0) : [];
      const descending = args.length > 2 && isTruthy(args[2]);
      const sorted = [...args[0]].sort((a, b) => {
        const va = keyPath.length ? walkSegments(a, keyPath) : a;
        const vb = keyPath.length ? walkSegments(b, keyPath) : b;
        const cmp = compareValues(va, vb) ?? 0;
        return descending ? -cmp : cmp;
      });
      return sorted;
    }
    case WorkflowMappingFunction.REVERSE:
      if (typeof args[0] === "string") return Array.from(args[0]).reverse().join("");
      return Array.isArray(args[0]) ? [...args[0]].reverse() : null;
    case WorkflowMappingFunction.FILTER_BY:
    case WorkflowMappingFunction.FIND_BY: {
      if (!Array.isArray(args[0])) return null;
      const keyPath = toText(args[1]).split(".").filter((seg) => seg.length > 0);
      const matches = args[0].filter((element) => looseEquals(walkSegments(element, keyPath), args[2]));
      if (fn === WorkflowMappingFunction.FILTER_BY) return matches;
      return matches.length > 0 ? matches[0] : null;
    }
    case WorkflowMappingFunction.RANGE: {
      const a = toNumberOrNull(args[0]);
      if (a === null) return null;
      const b = args.length > 1 ? toNumberOrNull(args[1]) : null;
      const start = b === null ? 0 : Math.trunc(a);
      const end = b === null ? Math.trunc(a) : Math.trunc(b);
      if (end < start) return [];
      const length = Math.min(WORKFLOW_RANGE_MAX_LENGTH, end - start);
      return Array.from({ length }, (_v, i) => start + i);
    }

    case WorkflowMappingFunction.DATE_ADD: {
      const base = toTimestamp(args[0]);
      const amount = toNumberOrNull(args[1]);
      const unit = toDateUnit(args[2]);
      if (base === null || amount === null || unit === null) return null;
      return new Date(base + amount * WORKFLOW_DATE_UNIT_MS[unit]).toISOString();
    }
    case WorkflowMappingFunction.DATE_DIFF: {
      const a = toTimestamp(args[0]);
      const b = toTimestamp(args[1]);
      const unit = toDateUnit(args[2]);
      if (a === null || b === null || unit === null) return null;
      return (a - b) / WORKFLOW_DATE_UNIT_MS[unit];
    }
    case WorkflowMappingFunction.FORMAT_DATE: {
      const ts = toTimestamp(args[0]);
      if (ts === null || typeof args[1] !== "string") return null;
      return formatUtcDate(new Date(ts), args[1]);
    }
    case WorkflowMappingFunction.PARSE_DATE: {
      const ts = toTimestamp(args[0]);
      return ts === null ? null : new Date(ts).toISOString();
    }

    case WorkflowMappingFunction.BASE64_ENCODE:
      return typeof args[0] === "string" ? utf8ToBase64(args[0]) : null;
    case WorkflowMappingFunction.BASE64_DECODE:
      return typeof args[0] === "string" ? base64ToUtf8(args[0]) : null;
    case WorkflowMappingFunction.URL_ENCODE:
      return args[0] === null || args[0] === undefined ? null : encodeURIComponent(toText(args[0]));
    case WorkflowMappingFunction.URL_DECODE: {
      if (typeof args[0] !== "string") return null;
      try {
        return decodeURIComponent(args[0]);
      } catch {
        return null;
      }
    }
    default:
      return null;
  }
}

/**
 * Truthiness used by `IF` / `AND` / `OR` / `NOT`: `false`, `null`, `undefined`, `0`, `NaN`, `""`,
 * empty arrays and empty objects are false.
 */
function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return true;
}

/**
 * Equality used by `EQ` / `NEQ` / `INCLUDES` / `FILTER_BY`: scalars compare by value with
 * number/string coercion (`"1"` equals `1`), everything else by stable JSON.
 */
function looseEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  const na = typeof a === "number" || typeof a === "string" ? toNumberOrNull(a) : null;
  const nb = typeof b === "number" || typeof b === "string" ? toNumberOrNull(b) : null;
  if (na !== null && nb !== null && (typeof a === "number" || typeof b === "number")) return na === nb;
  if (typeof a !== "object" && typeof b !== "object") return String(a) === String(b);
  return stableJsonStringify(a) === stableJsonStringify(b);
}

/**
 * Ordering used by comparisons and `SORT`: numbers numerically (strings coerced when both parse),
 * otherwise strings lexicographically; `null` for incomparable pairs.
 */
function compareValues(a: unknown, b: unknown): number | null {
  const na = toNumberOrNull(a);
  const nb = toNumberOrNull(b);
  if (na !== null && nb !== null && typeof a !== "boolean" && typeof b !== "boolean") return na < nb ? -1 : na > nb ? 1 : 0;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? 1 : -1;
  return null;
}

/**
 * Parses an ISO-8601 string or epoch milliseconds into a timestamp; `null` when invalid.
 */
function toTimestamp(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

/**
 * Parses a `WorkflowDateUnit` value; `null` when unknown.
 */
function toDateUnit(value: unknown): WorkflowDateUnit | null {
  return typeof value === "string" && (Object.values(WorkflowDateUnit) as string[]).includes(value)
    ? (value as WorkflowDateUnit)
    : null;
}

/**
 * Formats a date in UTC with the tokens `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`, `SSS`; other
 * characters are copied verbatim.
 */
function formatUtcDate(date: Date, pattern: string): string {
  const pad = (n: number, width: number): string => String(n).padStart(width, "0");
  return pattern
    .replace(/YYYY/g, pad(date.getUTCFullYear(), 4))
    .replace(/SSS/g, pad(date.getUTCMilliseconds(), 3))
    .replace(/MM/g, pad(date.getUTCMonth() + 1, 2))
    .replace(/DD/g, pad(date.getUTCDate(), 2))
    .replace(/HH/g, pad(date.getUTCHours(), 2))
    .replace(/mm/g, pad(date.getUTCMinutes(), 2))
    .replace(/ss/g, pad(date.getUTCSeconds(), 2));
}

/**
 * UTF-8 to Base64 without Node-only APIs (works in browsers and Node).
 */
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Base64 to UTF-8; `null` when the input is not valid Base64.
 */
function base64ToUtf8(text: string): string | null {
  try {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Resolves a value tree against the evaluation context.
 *
 * Behavior
 * - `REF` resolving to `undefined` yields `default` when set, otherwise `null`.
 * - Objects and arrays are rebuilt recursively; functions receive resolved arguments.
 * - Never throws for data problems; malformed nodes (unknown kind, missing payload) throw an
 *   `Error` because they are definition bugs the validator should have caught.
 */
export function resolveWorkflowValue(node: WorkflowValueNode, ctx: WorkflowValueContext): unknown {
  const limits = ctx.limits ?? DEFAULT_WORKFLOW_VALUE_LIMITS;
  const counter = { nodes: 0 };
  return resolveWorkflowValueInternal(node, ctx, limits, counter, 0);
}

/**
 * Recursive worker for `resolveWorkflowValue`.
 */
function resolveWorkflowValueInternal(
  node: WorkflowValueNode,
  ctx: WorkflowValueContext,
  limits: WorkflowValueLimits,
  counter: { nodes: number },
  depth: number,
): unknown {
  counter.nodes++;
  if (counter.nodes > limits.maxNodes) {
    throw new Error(`[${LOG_SOURCE}] Value tree is too large (maxNodes=${limits.maxNodes})`);
  }
  if (depth > limits.maxDepth) {
    throw new Error(`[${LOG_SOURCE}] Value tree is too deep (maxDepth=${limits.maxDepth})`);
  }
  if (!isPlainObject(node)) {
    throw new Error(`[${LOG_SOURCE}] Value node must be an object`);
  }

  switch (node.kind) {
    case WorkflowValueKind.LITERAL:
      return node.literal === undefined ? null : node.literal;
    case WorkflowValueKind.REF: {
      const resolved = resolveWorkflowRef(String(node.ref ?? ""), ctx);
      if (resolved !== undefined) return resolved;
      return node.default === undefined ? null : node.default;
    }
    case WorkflowValueKind.FN: {
      if (!node.fn) throw new Error(`[${LOG_SOURCE}] FN node is missing fn`);
      const args = (node.args ?? []).map((arg) =>
        resolveWorkflowValueInternal(arg, ctx, limits, counter, depth + 1),
      );
      return applyWorkflowMappingFunction(node.fn, args, ctx.now ?? Date.now);
    }
    case WorkflowValueKind.TEMPLATE:
      return renderWorkflowTemplate(String(node.template ?? ""), ctx);
    case WorkflowValueKind.OBJECT: {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node.object ?? {})) {
        out[key] = resolveWorkflowValueInternal(child, ctx, limits, counter, depth + 1);
      }
      return out;
    }
    case WorkflowValueKind.ARRAY:
      return (node.array ?? []).map((child) =>
        resolveWorkflowValueInternal(child, ctx, limits, counter, depth + 1),
      );
    default:
      throw new Error(`[${LOG_SOURCE}] Unsupported value node kind: ${String(node.kind)}`);
  }
}

/**
 * Resolves a record of value nodes (state `vars`, `query`, `headers`...).
 */
export function resolveWorkflowValueRecord(
  record: Record<string, WorkflowValueNode> | undefined,
  ctx: WorkflowValueContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, node] of Object.entries(record ?? {})) {
    out[key] = resolveWorkflowValue(node, ctx);
  }
  return out;
}

/**
 * Parses the author-facing JSON shorthand into a typed value tree.
 *
 * Shorthand
 * - scalars → `LITERAL`
 * - `{ "$ref": "path", "default"?: scalar }` → `REF`
 * - `{ "$fn": "NAME", "args": [...] }` → `FN`
 * - `{ "$template": "text {{path}}" }` → `TEMPLATE`
 * - any other object → `OBJECT` (values parsed recursively)
 * - arrays → `ARRAY`
 *
 * Notes
 * - Already-typed nodes (objects with a `kind` from `WorkflowValueKind` and no `$` keys) pass through.
 * - Throws `Error` on shapes that cannot be interpreted; call it at the boundary.
 */
export function parseWorkflowValueShorthand(json: unknown): WorkflowValueNode {
  if (isScalarLiteral(json)) {
    return { kind: WorkflowValueKind.LITERAL, literal: json };
  }
  if (json === undefined) {
    return { kind: WorkflowValueKind.LITERAL, literal: null };
  }
  if (Array.isArray(json)) {
    return { kind: WorkflowValueKind.ARRAY, array: json.map(parseWorkflowValueShorthand) };
  }
  if (!isPlainObject(json)) {
    throw new Error(`[${LOG_SOURCE}] Unsupported value shorthand: ${typeof json}`);
  }

  if (typeof json.$ref === "string") {
    const node: WorkflowValueNode = { kind: WorkflowValueKind.REF, ref: json.$ref };
    if (json.default !== undefined) {
      if (!isScalarLiteral(json.default)) {
        throw new Error(`[${LOG_SOURCE}] $ref default must be a scalar`);
      }
      node.default = json.default;
    }
    return node;
  }
  if (typeof json.$fn === "string") {
    const args = Array.isArray(json.args) ? json.args : [];
    return {
      kind: WorkflowValueKind.FN,
      fn: json.$fn as WorkflowMappingFunction,
      args: args.map(parseWorkflowValueShorthand),
    };
  }
  if (typeof json.$template === "string") {
    return { kind: WorkflowValueKind.TEMPLATE, template: json.$template };
  }
  if (
    typeof json.kind === "string" &&
    (Object.values(WorkflowValueKind) as string[]).includes(json.kind) &&
    !Object.keys(json).some((k) => k.startsWith("$"))
  ) {
    return json as unknown as WorkflowValueNode;
  }

  const object: Record<string, WorkflowValueNode> = {};
  for (const [key, value] of Object.entries(json)) {
    object[key] = parseWorkflowValueShorthand(value);
  }
  return { kind: WorkflowValueKind.OBJECT, object };
}

/**
 * Produces the author-facing JSON shorthand from a typed value tree (inverse of the parser).
 */
export function formatWorkflowValueShorthand(node: WorkflowValueNode): unknown {
  switch (node.kind) {
    case WorkflowValueKind.LITERAL:
      return node.literal === undefined ? null : node.literal;
    case WorkflowValueKind.REF: {
      const out: Record<string, unknown> = { $ref: node.ref ?? "" };
      if (node.default !== undefined) out.default = node.default;
      return out;
    }
    case WorkflowValueKind.FN:
      return { $fn: node.fn, args: (node.args ?? []).map(formatWorkflowValueShorthand) };
    case WorkflowValueKind.TEMPLATE:
      return { $template: node.template ?? "" };
    case WorkflowValueKind.OBJECT: {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node.object ?? {})) {
        out[key] = formatWorkflowValueShorthand(child);
      }
      return out;
    }
    case WorkflowValueKind.ARRAY:
      return (node.array ?? []).map(formatWorkflowValueShorthand);
    default:
      return null;
  }
}

/**
 * Picks the successor of a `CHOICE` state: the first case whose condition matches, else `default`.
 *
 * Notes
 * - Conditions are evaluated against the same reference roots as values (`input`, `states`, `run`,
 *   `workflow`, `item`), using the shared condition evaluator; misconfigured conditions throw
 *   `ExecutionError(CONFIG_ERROR)` like everywhere else.
 */
export function selectChoiceNext(
  choice: WorkflowChoiceStateConfig,
  ctx: WorkflowValueContext,
  subjectForError?: string,
): WorkflowChoiceSelection {
  const scope = buildConditionScope(ctx);
  for (const item of choice.choices ?? []) {
    if (evaluateConditionTreeOnScope(scope, item.condition, { subjectForError })) {
      return { next: item.next, caseId: item.id };
    }
  }
  return { next: choice.default, caseId: null };
}

/**
 * Builds the object condition paths are resolved against (`input.*`, `states.<id>.output.*`...).
 */
export function buildConditionScope(ctx: WorkflowValueContext): Record<string, unknown> {
  const states: Record<string, unknown> = {};
  for (const [id, snapshot] of Object.entries(ctx.states ?? {})) {
    states[id] = { status: snapshot.status, output: snapshot.output };
  }
  const scope: Record<string, unknown> = {
    input: ctx.input,
    states,
    run: ctx.run,
    workflow: ctx.workflow,
    constants: ctx.constants ?? {},
  };
  if (ctx.item) scope.item = { value: ctx.item.value, index: ctx.item.index };
  if (ctx.agent) scope.agent = agentScopeOf(ctx.agent);
  return scope;
}

/**
 * Returns true when a state is executed by the host (I/O, waiting, fan-out) rather than evaluated
 * locally by `evaluateLocalWorkflowState`.
 */
export function isHostExecutedWorkflowState(type: WorkflowStateType): boolean {
  return (
    type === WorkflowStateType.INTENT ||
    type === WorkflowStateType.HTTP ||
    type === WorkflowStateType.WAIT ||
    type === WorkflowStateType.PARALLEL ||
    type === WorkflowStateType.FOREACH ||
    type === WorkflowStateType.SUBWORKFLOW ||
    type === WorkflowStateType.AGENT ||
    // A capability reaches a third party over the network, so it belongs to the host like `HTTP`
    // does; it can never be evaluated locally from the context.
    type === WorkflowStateType.TOOL
  );
}

/**
 * Evaluates a state that needs no I/O (`CHOICE`, `TRANSFORM`, `END`).
 *
 * Notes
 * - `CHOICE` outputs the matching case id and sets `caseId`.
 * - `TRANSFORM` outputs the resolved mapping.
 * - `END` outputs the resolved `end.output` (or `null`); the run-level output is resolved by
 *   `resolveWorkflowTransition`.
 * - Throws for host-executed state types.
 */
export function evaluateLocalWorkflowState(
  state: WorkflowState,
  ctx: WorkflowValueContext,
  subjectForError?: string,
): WorkflowStateOutcome {
  switch (state.type) {
    case WorkflowStateType.CHOICE: {
      if (!state.choice) throw new Error(`[${LOG_SOURCE}] CHOICE state is missing its choice block`);
      const selection = selectChoiceNext(state.choice, ctx, subjectForError);
      return { status: WorkflowStateOutcomeStatus.COMPLETED, output: selection.caseId, caseId: selection.caseId };
    }
    case WorkflowStateType.TRANSFORM: {
      if (!state.transform) throw new Error(`[${LOG_SOURCE}] TRANSFORM state is missing its transform block`);
      return { status: WorkflowStateOutcomeStatus.COMPLETED, output: resolveWorkflowValue(state.transform.output, ctx) };
    }
    case WorkflowStateType.END: {
      if (!state.end) throw new Error(`[${LOG_SOURCE}] END state is missing its end block`);
      const output = state.end.output ? resolveWorkflowValue(state.end.output, ctx) : null;
      return { status: WorkflowStateOutcomeStatus.COMPLETED, output };
    }
    default:
      throw new Error(`[${LOG_SOURCE}] State type ${String(state.type)} is executed by the host, not evaluated locally`);
  }
}

/**
 * Decides where the run goes after a state outcome.
 *
 * Contract for hosts
 * - For host-executed states, call it with the outcome you observed; for local states, call
 *   `evaluateLocalWorkflowState` first and pass its outcome.
 * - Record `snapshot` under `states.<stateId>` before continuing (it is what later references see).
 * - `END`: finish the run with `endOutcome` / `runOutput` / `error`.
 * - `FAIL`: fail the run with `error`.
 * - Loop guard (`settings.maxTransitionsPerRun`) is the host's responsibility because only the host
 *   counts executed transitions across resumes.
 */
export function resolveWorkflowTransition(
  definition: WorkflowDefinition,
  stateId: string,
  outcome: WorkflowStateOutcome,
  ctx: WorkflowValueContext,
): WorkflowTransition {
  const state = definition.states[stateId];
  if (!state) throw new Error(`[${LOG_SOURCE}] Unknown state '${stateId}'`);

  if (outcome.status === WorkflowStateOutcomeStatus.FAILED) {
    const error: WorkflowStateError = outcome.error ?? { code: "STATE_FAILED", message: `State '${stateId}' failed` };
    const snapshot: WorkflowStateSnapshot = { status: WorkflowStateRunStatus.FAILED, output: null };
    const policy = state.onError ?? definition.settings.onError;
    const action = policy?.action ?? WorkflowStateErrorAction.FAIL_RUN;
    if (action === WorkflowStateErrorAction.CONTINUE && state.next) {
      return { kind: WorkflowTransitionKind.ERROR_HANDLED, next: state.next, snapshot, error };
    }
    if (action === WorkflowStateErrorAction.GOTO && policy?.next) {
      return { kind: WorkflowTransitionKind.ERROR_HANDLED, next: policy.next, snapshot, error };
    }
    return { kind: WorkflowTransitionKind.FAIL, snapshot, error };
  }

  const snapshot: WorkflowStateSnapshot = {
    status: WorkflowStateRunStatus.COMPLETED,
    output: outcome.output === undefined ? null : outcome.output,
  };

  switch (state.type) {
    case WorkflowStateType.END: {
      const end = state.end;
      if (!end) throw new Error(`[${LOG_SOURCE}] END state '${stateId}' is missing its end block`);
      const ctxWithSelf: WorkflowValueContext = { ...ctx, states: { ...ctx.states, [stateId]: snapshot } };
      const runOutput = end.output
        ? snapshot.output
        : definition.output
          ? resolveWorkflowValue(definition.output, ctxWithSelf)
          : lastCompletedOutput(ctx);
      if (end.outcome === WorkflowEndOutcome.FAIL) {
        const message = end.errorMessage ? toText(resolveWorkflowValue(end.errorMessage, ctxWithSelf)) : `Workflow ended in FAIL state '${stateId}'`;
        return {
          kind: WorkflowTransitionKind.END,
          snapshot,
          endOutcome: WorkflowEndOutcome.FAIL,
          runOutput,
          error: { code: end.errorCode ?? "WORKFLOW_FAILED", message },
        };
      }
      return { kind: WorkflowTransitionKind.END, snapshot, endOutcome: WorkflowEndOutcome.SUCCEED, runOutput };
    }
    case WorkflowStateType.CHOICE: {
      const choice = state.choice;
      if (!choice) throw new Error(`[${LOG_SOURCE}] CHOICE state '${stateId}' is missing its choice block`);
      const caseId = outcome.caseId === undefined ? null : outcome.caseId;
      const target = caseId === null ? choice.default : choice.choices.find((c) => c.id === caseId)?.next ?? choice.default;
      return { kind: WorkflowTransitionKind.CONTINUE, next: target, snapshot, caseId };
    }
    default: {
      if (!state.next) throw new Error(`[${LOG_SOURCE}] State '${stateId}' has no next`);
      return { kind: WorkflowTransitionKind.CONTINUE, next: state.next, snapshot };
    }
  }
}

/**
 * Output of the most recently recorded completed state (fallback run output when nothing is mapped).
 */
function lastCompletedOutput(ctx: WorkflowValueContext): unknown {
  const entries = Object.values(ctx.states ?? {});
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].status === WorkflowStateRunStatus.COMPLETED) return entries[i].output;
  }
  return null;
}

/**
 * Converts an author-facing definition (value positions in `$ref`/`$fn`/`$template` shorthand)
 * into the typed definition. Non-value positions are copied as-is; validate afterwards.
 */
export function parseWorkflowDefinitionShorthand(json: unknown): WorkflowDefinition {
  if (!isPlainObject(json)) throw new Error(`[${LOG_SOURCE}] Definition must be an object`);
  const out: Record<string, unknown> = { ...json };
  if (json.output !== undefined) out.output = parseWorkflowValueShorthand(json.output);
  if (isPlainObject(json.states)) out.states = parseStatesShorthand(json.states);
  return out as unknown as WorkflowDefinition;
}

/**
 * Converts a typed definition into the author-facing shorthand (inverse of the parser).
 */
export function formatWorkflowDefinitionShorthand(definition: WorkflowDefinition): unknown {
  const out: Record<string, unknown> = { ...definition };
  if (definition.output !== undefined) out.output = formatWorkflowValueShorthand(definition.output);
  out.states = formatStatesShorthand(definition.states);
  return out;
}

/**
 * Parses every value position of a states map (recursing into sub-graphs).
 */
function parseStatesShorthand(states: Record<string, unknown>): Record<string, WorkflowState> {
  const out: Record<string, WorkflowState> = {};
  for (const [id, raw] of Object.entries(states)) {
    if (!isPlainObject(raw)) continue;
    const state: Record<string, unknown> = { ...raw };
    const parseRecord = (record: unknown): Record<string, WorkflowValueNode> | undefined => {
      if (!isPlainObject(record)) return undefined;
      const r: Record<string, WorkflowValueNode> = {};
      for (const [k, v] of Object.entries(record)) r[k] = parseWorkflowValueShorthand(v);
      return r;
    };
    if (isPlainObject(raw.intent)) {
      state.intent = {
        ...raw.intent,
        vars: parseRecord(raw.intent.vars) ?? {},
        context: parseRecord(raw.intent.context),
        inputParts: raw.intent.inputParts === undefined ? undefined : parseWorkflowValueShorthand(raw.intent.inputParts),
      };
    }
    if (isPlainObject(raw.http)) {
      state.http = {
        ...raw.http,
        path: raw.http.path === undefined ? undefined : parseWorkflowValueShorthand(raw.http.path),
        query: parseRecord(raw.http.query),
        headers: parseRecord(raw.http.headers),
        body: raw.http.body === undefined ? undefined : parseWorkflowValueShorthand(raw.http.body),
      };
    }
    if (isPlainObject(raw.transform)) {
      state.transform = { ...raw.transform, output: parseWorkflowValueShorthand(raw.transform.output) };
    }
    if (isPlainObject(raw.end)) {
      state.end = {
        ...raw.end,
        output: raw.end.output === undefined ? undefined : parseWorkflowValueShorthand(raw.end.output),
        errorMessage: raw.end.errorMessage === undefined ? undefined : parseWorkflowValueShorthand(raw.end.errorMessage),
      };
    }
    if (isPlainObject(raw.wait)) {
      state.wait = {
        ...raw.wait,
        assignees: raw.wait.assignees === undefined ? undefined : parseWorkflowValueShorthand(raw.wait.assignees),
        instructions: raw.wait.instructions === undefined ? undefined : parseWorkflowValueShorthand(raw.wait.instructions),
        correlation: parseRecord(raw.wait.correlation),
      };
    }
    if (isPlainObject(raw.approval)) {
      state.approval = {
        ...raw.approval,
        assignees: raw.approval.assignees === undefined ? undefined : parseWorkflowValueShorthand(raw.approval.assignees),
        instructions: raw.approval.instructions === undefined ? undefined : parseWorkflowValueShorthand(raw.approval.instructions),
      };
    }
    if (isPlainObject(raw.foreach)) {
      state.foreach = {
        ...raw.foreach,
        items: raw.foreach.items === undefined ? undefined : parseWorkflowValueShorthand(raw.foreach.items),
        states: isPlainObject(raw.foreach.states) ? parseStatesShorthand(raw.foreach.states) : raw.foreach.states,
      };
    }
    if (isPlainObject(raw.parallel) && Array.isArray(raw.parallel.branches)) {
      state.parallel = {
        ...raw.parallel,
        branches: raw.parallel.branches.map((b: unknown) =>
          isPlainObject(b) && isPlainObject(b.states) ? { ...b, states: parseStatesShorthand(b.states) } : b,
        ),
      };
    }
    if (isPlainObject(raw.subworkflow)) {
      state.subworkflow = { ...raw.subworkflow, input: parseRecord(raw.subworkflow.input) ?? {} };
    }
    if (isPlainObject(raw.agent)) {
      state.agent = {
        ...raw.agent,
        goal: raw.agent.goal === undefined ? undefined : parseWorkflowValueShorthand(raw.agent.goal),
        context: parseRecord(raw.agent.context),
      };
    }
    stripUndefined(state);
    out[id] = state as unknown as WorkflowState;
  }
  return out;
}

/**
 * Formats every value position of a states map (recursing into sub-graphs).
 */
function formatStatesShorthand(states: Record<string, WorkflowState>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const formatRecord = (record: Record<string, WorkflowValueNode> | undefined): Record<string, unknown> | undefined => {
    if (!record) return undefined;
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) r[k] = formatWorkflowValueShorthand(v);
    return r;
  };
  for (const [id, state] of Object.entries(states ?? {})) {
    const raw: Record<string, unknown> = { ...state };
    if (state.intent) {
      raw.intent = {
        ...state.intent,
        vars: formatRecord(state.intent.vars),
        context: formatRecord(state.intent.context),
        inputParts: state.intent.inputParts ? formatWorkflowValueShorthand(state.intent.inputParts) : undefined,
      };
    }
    if (state.http) {
      raw.http = {
        ...state.http,
        path: formatWorkflowValueShorthand(state.http.path),
        query: formatRecord(state.http.query),
        headers: formatRecord(state.http.headers),
        body: state.http.body ? formatWorkflowValueShorthand(state.http.body) : undefined,
      };
    }
    if (state.transform) raw.transform = { output: formatWorkflowValueShorthand(state.transform.output) };
    if (state.end) {
      raw.end = {
        ...state.end,
        output: state.end.output ? formatWorkflowValueShorthand(state.end.output) : undefined,
        errorMessage: state.end.errorMessage ? formatWorkflowValueShorthand(state.end.errorMessage) : undefined,
      };
    }
    if (state.wait) {
      raw.wait = {
        ...state.wait,
        assignees: state.wait.assignees ? formatWorkflowValueShorthand(state.wait.assignees) : undefined,
        instructions: state.wait.instructions ? formatWorkflowValueShorthand(state.wait.instructions) : undefined,
        correlation: formatRecord(state.wait.correlation),
      };
    }
    if (state.approval) {
      raw.approval = {
        ...state.approval,
        assignees: state.approval.assignees ? formatWorkflowValueShorthand(state.approval.assignees) : undefined,
        instructions: state.approval.instructions ? formatWorkflowValueShorthand(state.approval.instructions) : undefined,
      };
    }
    if (state.foreach) {
      raw.foreach = { ...state.foreach, items: formatWorkflowValueShorthand(state.foreach.items), states: formatStatesShorthand(state.foreach.states) };
    }
    if (state.parallel) {
      raw.parallel = { branches: state.parallel.branches.map((b) => ({ ...b, states: formatStatesShorthand(b.states) })) };
    }
    if (state.subworkflow) raw.subworkflow = { ...state.subworkflow, input: formatRecord(state.subworkflow.input) };
    if (state.agent) raw.agent = { ...state.agent, goal: formatWorkflowValueShorthand(state.agent.goal), context: formatRecord(state.agent.context) };
    stripUndefined(raw);
    for (const key of Object.keys(raw)) {
      const block = raw[key];
      if (isPlainObject(block)) stripUndefined(block);
    }
    out[id] = raw;
  }
  return out;
}

/**
 * Removes `undefined` properties in place (keeps JSON round-trips clean).
 */
function stripUndefined(target: Record<string, unknown>): void {
  for (const key of Object.keys(target)) {
    if (target[key] === undefined) delete target[key];
  }
}

/**
 * Returns the state's declared output schema, inheriting the intent `outputSchema` for `INTENT`
 * states that declare none. `null` when unknown.
 */
export function inferWorkflowStateOutputSchema(
  state: WorkflowState,
  intents: WorkflowValidationIntent[] = [],
  workflows: WorkflowValidationWorkflow[] = [],
): Record<string, PromptVariable> | null {
  if (state.outputSchema) return state.outputSchema;
  if (state.type === WorkflowStateType.INTENT && state.intent) {
    const found = intents.find((i) => i.intent === state.intent?.intent);
    return found?.outputSchema ?? null;
  }
  if (state.type === WorkflowStateType.SUBWORKFLOW && state.subworkflow) {
    const found = workflows.find((w) => w.key === state.subworkflow?.workflowKey);
    return found?.outputSchema ?? null;
  }
  if (state.type === WorkflowStateType.WAIT && state.wait?.form) return state.wait.form;
  if (state.type === WorkflowStateType.TOOL && state.tool) {
    // The result shape is ours and fixed, so a downstream state can reference it before the workflow
    // has ever run - which is the whole reason a capability beats a hand-mapped HTTP call.
    return findWorkflowCapability(state.tool.capability)?.outputSchema ?? null;
  }
  return null;
}

/**
 * Lists every sub-workflow key referenced by the definition, including nested sub-graphs (deduplicated, sorted).
 */
export function listWorkflowSubworkflows(definition: WorkflowDefinition): string[] {
  const out = new Set<string>();
  forEachWorkflowState(definition.states, (state) => {
    if (state.type === WorkflowStateType.SUBWORKFLOW && state.subworkflow?.workflowKey) out.add(state.subworkflow.workflowKey);
  });
  return Array.from(out).sort();
}

/**
 * Statically checks a value mapping against a prompt-variable schema.
 *
 * Rules
 * - Only `OBJECT` nodes can be checked: unknown keys and missing required keys are reported.
 * - `LITERAL` / `ARRAY` nodes can never satisfy an object schema and are reported.
 * - `REF` / `FN` / `TEMPLATE` nodes are opaque at publish time and are accepted (the host validates
 *   the resolved value at run time).
 */
export function validateWorkflowValueAgainstSchema(
  node: WorkflowValueNode,
  schema: Record<string, PromptVariable>,
  path: string,
): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  if (!isPlainObject(node)) return issues;
  if (node.kind === WorkflowValueKind.LITERAL || node.kind === WorkflowValueKind.ARRAY) {
    issues.push({ path, code: WorkflowValidationIssueCode.OUTPUT_KEY_MISSING, message: "An object mapping is required to satisfy the declared schema." });
    return issues;
  }
  if (node.kind !== WorkflowValueKind.OBJECT || !isPlainObject(node.object)) return issues;
  for (const key of Object.keys(node.object)) {
    if (!(key in schema)) {
      issues.push({ path: `${path}.${key}`, code: WorkflowValidationIssueCode.OUTPUT_KEY_UNKNOWN, message: `Key '${key}' is not declared in the schema.` });
    }
  }
  for (const [key, variable] of Object.entries(schema)) {
    if (variable?.required && !(key in node.object)) {
      issues.push({ path: `${path}.${key}`, code: WorkflowValidationIssueCode.OUTPUT_KEY_MISSING, message: `Required key '${key}' is not mapped.` });
    }
  }
  return issues;
}

/**
 * Lists every intent key referenced by the definition, including nested sub-graphs (deduplicated, sorted).
 */
export function listWorkflowIntents(definition: WorkflowDefinition): string[] {
  const out = new Set<string>();
  forEachWorkflowState(definition.states, (state) => {
    if (state.type === WorkflowStateType.INTENT && state.intent?.intent) out.add(state.intent.intent);
    if (state.type === WorkflowStateType.AGENT && state.agent) {
      if (state.agent.plannerIntent) out.add(state.agent.plannerIntent);
      for (const tool of state.agent.tools ?? []) {
        if (tool?.kind === WorkflowAgentToolKind.INTENT && tool.intent) out.add(tool.intent);
      }
    }
  });
  return Array.from(out).sort();
}

/**
 * Lists every connection key referenced by the definition, including nested sub-graphs (deduplicated, sorted).
 */
export function listWorkflowConnections(definition: WorkflowDefinition): string[] {
  const out = new Set<string>();
  forEachWorkflowState(definition.states, (state) => {
    if (state.type === WorkflowStateType.HTTP && state.http?.connection) out.add(state.http.connection);
  });
  return Array.from(out).sort();
}

/**
 * Returns true when the definition uses any advanced state type.
 */
export function workflowUsesAdvancedStates(definition: WorkflowDefinition): boolean {
  let found = false;
  forEachWorkflowState(definition.states, (state) => {
    if (WORKFLOW_ADVANCED_STATE_TYPES.includes(state.type)) found = true;
  });
  return found;
}

/**
 * Visits every state, descending into `PARALLEL` branches and `FOREACH` bodies.
 */
export function forEachWorkflowState(
  states: Record<string, WorkflowState>,
  visit: (state: WorkflowState, id: string) => void,
): void {
  for (const [id, state] of Object.entries(states ?? {})) {
    if (!isPlainObject(state)) continue;
    visit(state, id);
    for (const branch of state.parallel?.branches ?? []) {
      forEachWorkflowState(branch.states, visit);
    }
    if (state.foreach?.states) forEachWorkflowState(state.foreach.states, visit);
  }
}

/**
 * Returns a deep copy of the definition without any `display` block, in canonical key order.
 *
 * Notes
 * - This is the hashed representation: moving nodes in the editor never creates a new version.
 */
export function canonicalizeWorkflowDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  const stripped = stripDisplay(definition) as WorkflowDefinition;
  return JSON.parse(stableJsonStringify(stripped)) as WorkflowDefinition;
}

/**
 * Recursively removes `display` keys from plain objects.
 */
function stripDisplay(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripDisplay);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "display") continue;
    out[key] = stripDisplay(child);
  }
  return out;
}

/**
 * Stable JSON of the canonical definition (input of the sha256).
 */
export function canonicalWorkflowDefinitionJson(definition: WorkflowDefinition): string {
  return stableJsonStringify(canonicalizeWorkflowDefinition(definition));
}

/**
 * SHA-256 hex of the canonical definition (display excluded, keys sorted).
 *
 * @param definition Definition to hash.
 * @param deps Hash implementation (contracts stay dependency-free; hosts inject `crypto`).
 */
export function computeWorkflowDefinitionSha256(definition: WorkflowDefinition, deps: Sha256HexDeps): string {
  return deps.sha256Hex(canonicalWorkflowDefinitionJson(definition));
}

/**
 * Narrows an `IntentContract[]` to what the validator needs.
 */
export function toWorkflowValidationIntents(intents: IntentContract[]): WorkflowValidationIntent[] {
  return intents.map((i) => ({ intent: i.intent, inputSchema: i.inputSchema, outputSchema: i.outputSchema }));
}

/**
 * Validates a workflow definition without throwing.
 *
 * Checks
 * - Shape: schema version, key pattern, settings within caps, `startAt` exists, state ids pattern,
 *   exactly one config block per state matching `type`, advanced states gated by caps.
 * - Graph: every transition targets an existing state of the same scope, every state reachable
 *   from `startAt`, at least one `END` reachable, cycles only through `WAIT` states, `next`
 *   present unless `CHOICE`/`END` (and absent on `END`).
 * - Values: node kinds/payloads, function arity, `$ref` grammar and roots, `item.*` only inside
 *   `FOREACH`, `states.<id>` references only to states that dominate the referencing state (or
 *   carry a `default`), templates without sections, size/depth limits.
 * - Cross-checks (when context provided): intent exists, `vars` keys ⊆ `inputSchema`, required
 *   vars mapped, `inputParts` only when the intent declares an `asset` variable, connection exists,
 *   forbidden credential headers.
 */
export function validateWorkflowDefinition(
  definition: WorkflowDefinition,
  context: WorkflowValidationContext = {},
): WorkflowValidationResult {
  const caps = context.caps ?? DEFAULT_WORKFLOW_VALIDATION_CAPS;
  const valueLimits = context.valueLimits ?? DEFAULT_WORKFLOW_VALUE_LIMITS;
  const acc: GraphValidationAccumulator = { issues: [], stateCount: 0, nestingDepth: 0 };
  const push = (path: string, code: WorkflowValidationIssueCode, message: string): void => {
    acc.issues.push({ path, code, message });
  };

  if (!isPlainObject(definition)) {
    push("definition", WorkflowValidationIssueCode.DEFINITION_INVALID, "Definition must be an object.");
    return { valid: false, issues: acc.issues, stateCount: 0, nestingDepth: 0 };
  }

  if (definition.schemaVersion !== WorkflowSchemaVersion.V1) {
    push("schemaVersion", WorkflowValidationIssueCode.DEFINITION_INVALID, `Unsupported schemaVersion '${String(definition.schemaVersion)}'.`);
  }
  if (typeof definition.key !== "string" || !WORKFLOW_KEY_PATTERN.test(definition.key)) {
    push("key", WorkflowValidationIssueCode.KEY_INVALID, "Workflow key must match ^[A-Z][A-Z0-9_-]*$.");
  }
  if (typeof definition.name !== "string" || !definition.name.trim()) {
    push("name", WorkflowValidationIssueCode.DEFINITION_INVALID, "Workflow name is required.");
  }

  const settings = definition.settings;
  if (!isPlainObject(settings)) {
    push("settings", WorkflowValidationIssueCode.SETTINGS_INVALID, "Settings are required.");
  } else {
    if (!isPositiveInteger(settings.timeoutMs) || settings.timeoutMs > caps.maxTimeoutMs) {
      push("settings.timeoutMs", WorkflowValidationIssueCode.SETTINGS_INVALID, `timeoutMs must be a positive integer <= ${caps.maxTimeoutMs}.`);
    }
    if (!isPositiveInteger(settings.maxTransitionsPerRun) || settings.maxTransitionsPerRun > caps.maxTransitionsPerRun) {
      push("settings.maxTransitionsPerRun", WorkflowValidationIssueCode.SETTINGS_INVALID, `maxTransitionsPerRun must be a positive integer <= ${caps.maxTransitionsPerRun}.`);
    }
    if (settings.onError !== undefined) {
      if (!isPlainObject(settings.onError) || !(Object.values(WorkflowStateErrorAction) as string[]).includes(String(settings.onError.action))) {
        push("settings.onError.action", WorkflowValidationIssueCode.SETTINGS_INVALID, "settings.onError requires a known action.");
      } else if (settings.onError.action === WorkflowStateErrorAction.GOTO) {
        if (!settings.onError.next) {
          push("settings.onError.next", WorkflowValidationIssueCode.TRANSITION_MISSING, "settings.onError GOTO requires next.");
        } else if (!isPlainObject(definition.states) || !definition.states[settings.onError.next]) {
          push("settings.onError.next", WorkflowValidationIssueCode.TRANSITION_TARGET_MISSING, `settings.onError next '${settings.onError.next}' does not name a top-level state.`);
        }
      }
    }
  }

  if (definition.constants !== undefined) {
    if (!isPlainObject(definition.constants)) {
      push("constants", WorkflowValidationIssueCode.CONSTANT_INVALID, "constants must be a record of scalars.");
    } else {
      for (const [key, value] of Object.entries(definition.constants)) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
          push(`constants.${key}`, WorkflowValidationIssueCode.CONSTANT_INVALID, "Constant names must match ^[A-Za-z_][A-Za-z0-9_]*$.");
        }
        if (!isScalarLiteral(value)) {
          push(`constants.${key}`, WorkflowValidationIssueCode.CONSTANT_INVALID, "Constants must be strings, finite numbers, booleans or null.");
        }
      }
    }
  }

  if (definition.input !== undefined && !isPlainObject(definition.input)) {
    push("input", WorkflowValidationIssueCode.DEFINITION_INVALID, "input must be a record of prompt variables.");
  }

  if (!isPlainObject(definition.states)) {
    push("states", WorkflowValidationIssueCode.DEFINITION_INVALID, "states must be an object.");
    return { valid: false, issues: acc.issues, stateCount: 0, nestingDepth: 0 };
  }

  const scope: GraphValidationScope = {
    states: definition.states,
    startAt: definition.startAt,
    path: "states",
    outerVisibleStates: new Set<string>(),
    nesting: 0,
  };
  validateGraphScope(definition, scope, context, caps, valueLimits, acc, false);

  if (definition.output !== undefined) {
    validateValueNode(definition.output, "output", {
      definition,
      context,
      limits: valueLimits,
      visibleStates: collectAllStateIds(definition.states),
      insideForeach: false,
      insideAgent: false,
      acc,
    });
  }

  if (definition.outputSchema !== undefined) {
    if (!isPlainObject(definition.outputSchema)) {
      push("outputSchema", WorkflowValidationIssueCode.OUTPUT_SCHEMA_INVALID, "outputSchema must be a record of prompt variables.");
    } else {
      const schema = definition.outputSchema;
      const endOverrides: string[] = [];
      for (const [id, state] of Object.entries(definition.states)) {
        if (isPlainObject(state) && state.type === WorkflowStateType.END && state.end?.output !== undefined) {
          endOverrides.push(id);
          acc.issues.push(...validateWorkflowValueAgainstSchema(state.end.output, schema, `states.${id}.end.output`));
        }
      }
      if (definition.output !== undefined) {
        acc.issues.push(...validateWorkflowValueAgainstSchema(definition.output, schema, "output"));
      } else {
        const endsWithoutMapping = Object.entries(definition.states)
          .filter(([, state]) => isPlainObject(state) && state.type === WorkflowStateType.END && state.end?.outcome === WorkflowEndOutcome.SUCCEED && state.end?.output === undefined)
          .map(([id]) => id);
        if (endsWithoutMapping.length > 0) {
          push("output", WorkflowValidationIssueCode.OUTPUT_MAPPING_MISSING, `outputSchema is declared but no output mapping covers END state(s) ${endsWithoutMapping.join(", ")}.`);
        }
      }
    }
  }

  if (acc.stateCount > caps.maxStates) {
    push("states", WorkflowValidationIssueCode.LIMIT_EXCEEDED, `Workflow has ${acc.stateCount} states; the maximum is ${caps.maxStates}.`);
  }

  return {
    valid: acc.issues.length === 0,
    issues: acc.issues,
    stateCount: acc.stateCount,
    nestingDepth: acc.nestingDepth,
  };
}

/**
 * Returns true for positive integers.
 */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Collects every state id of a graph, including nested sub-graphs.
 */
function collectAllStateIds(states: Record<string, WorkflowState>): Set<string> {
  const out = new Set<string>();
  forEachWorkflowState(states, (_state, id) => out.add(id));
  return out;
}

interface ValueValidationArgs {
  definition: WorkflowDefinition;
  context: WorkflowValidationContext;
  limits: WorkflowValueLimits;
  /** States a `states.<id>` reference may target from this position. */
  visibleStates: Set<string>;
  insideForeach: boolean;
  /** True inside an `AGENT` state or a state used as one of its tools (`agent.*` allowed). */
  insideAgent: boolean;
  acc: GraphValidationAccumulator;
}

/**
 * Lists the direct successors of a state within its scope (`next`, choice targets, error target).
 */
function successorsOf(state: WorkflowState): string[] {
  const out: string[] = [];
  if (state.next) out.push(state.next);
  // AGENT tools are entered from the agent (as tool calls), so they count as successors for
  // reachability and dominance even though the walker never follows a transition into them.
  for (const tool of state.agent?.tools ?? []) {
    if (tool?.kind === WorkflowAgentToolKind.STATE && typeof tool.state === "string") out.push(tool.state);
  }
  if (state.choice) {
    for (const c of state.choice.choices ?? []) if (c?.next) out.push(c.next);
    if (state.choice.default) out.push(state.choice.default);
  }
  if (state.onError?.action === WorkflowStateErrorAction.GOTO && state.onError.next) out.push(state.onError.next);
  return out;
}

/**
 * Computes, for every state, the set of states that appear on every path from `startAt` to it
 * (dominators, iterative dataflow). Unreachable states get an empty set.
 */
export function computeDominators(states: Record<string, WorkflowState>, startAt: string): Map<string, Set<string>> {
  const ids = Object.keys(states);
  const preds = new Map<string, Set<string>>();
  for (const id of ids) preds.set(id, new Set());
  for (const id of ids) {
    for (const succ of successorsOf(states[id])) {
      if (preds.has(succ)) preds.get(succ)?.add(id);
    }
  }

  const reachable = new Set<string>();
  const stack = [startAt];
  while (stack.length) {
    const cur = stack.pop() as string;
    if (reachable.has(cur) || !states[cur]) continue;
    reachable.add(cur);
    for (const succ of successorsOf(states[cur])) stack.push(succ);
  }

  const dom = new Map<string, Set<string>>();
  for (const id of ids) {
    dom.set(id, id === startAt ? new Set([id]) : new Set(reachable));
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of reachable) {
      if (id === startAt) continue;
      const predSets = Array.from(preds.get(id) ?? []).filter((p) => reachable.has(p)).map((p) => dom.get(p) as Set<string>);
      let next: Set<string>;
      if (predSets.length === 0) {
        next = new Set([id]);
      } else {
        next = new Set(predSets[0]);
        for (const ps of predSets.slice(1)) {
          for (const x of Array.from(next)) if (!ps.has(x)) next.delete(x);
        }
        next.add(id);
      }
      const prev = dom.get(id) as Set<string>;
      if (prev.size !== next.size || Array.from(next).some((x) => !prev.has(x))) {
        dom.set(id, next);
        changed = true;
      }
    }
  }
  for (const id of ids) if (!reachable.has(id)) dom.set(id, new Set());
  return dom;
}

/**
 * Detects cycles (via DFS back edges) that do not pass through a `WAIT` state.
 * Returns one representative cycle per offending back edge.
 */
function findCyclesWithoutWait(states: Record<string, WorkflowState>, startAt: string): string[][] {
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const pathStack: string[] = [];
  const cycles: string[][] = [];

  const dfs = (id: string): void => {
    color.set(id, GREY);
    pathStack.push(id);
    for (const succ of successorsOf(states[id])) {
      if (!states[succ]) continue;
      const c = color.get(succ) ?? WHITE;
      if (c === WHITE) {
        dfs(succ);
      } else if (c === GREY) {
        const cycle = pathStack.slice(pathStack.indexOf(succ));
        if (!cycle.some((sid) => states[sid]?.type === WorkflowStateType.WAIT)) cycles.push(cycle);
      }
    }
    pathStack.pop();
    color.set(id, BLACK);
  };
  if (states[startAt]) dfs(startAt);
  return cycles;
}

/**
 * Validates one graph scope (top level, a `PARALLEL` branch or a `FOREACH` body).
 */
function validateGraphScope(
  definition: WorkflowDefinition,
  scope: GraphValidationScope,
  context: WorkflowValidationContext,
  caps: WorkflowValidationCaps,
  limits: WorkflowValueLimits,
  acc: GraphValidationAccumulator,
  insideForeach: boolean,
): void {
  const push = (path: string, code: WorkflowValidationIssueCode, message: string): void => {
    acc.issues.push({ path, code, message });
  };
  const states = scope.states;
  const ids = Object.keys(states);
  acc.nestingDepth = Math.max(acc.nestingDepth, scope.nesting);

  if (typeof scope.startAt !== "string" || !states[scope.startAt]) {
    push(`${scope.path}`, WorkflowValidationIssueCode.START_STATE_MISSING, `startAt '${String(scope.startAt)}' does not name a state in this scope.`);
  }
  if (ids.length === 0) {
    push(scope.path, WorkflowValidationIssueCode.DEFINITION_INVALID, "A graph must declare at least one state.");
    return;
  }

  const dominators = computeDominators(states, scope.startAt);

  // States used as AGENT tools may read `agent.*`.
  const toolStates = new Set<string>();
  for (const id of ids) {
    const agent = states[id]?.agent;
    for (const tool of agent?.tools ?? []) {
      if (tool?.kind === WorkflowAgentToolKind.STATE && typeof tool.state === "string") toolStates.add(tool.state);
    }
  }

  for (const id of ids) {
    acc.stateCount++;
    const state = states[id];
    const statePath = `${scope.path}.${id}`;

    if (!STATE_ID_PATTERN.test(id)) {
      push(statePath, WorkflowValidationIssueCode.STATE_ID_INVALID, "State id must match ^[a-z][a-z0-9_]*$.");
    }
    if (!isPlainObject(state)) {
      push(statePath, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "State must be an object.");
      continue;
    }
    if (!(Object.values(WorkflowStateType) as string[]).includes(String(state.type))) {
      push(`${statePath}.type`, WorkflowValidationIssueCode.STATE_TYPE_INVALID, `Unsupported state type '${String(state.type)}'.`);
      continue;
    }
    if (WORKFLOW_ADVANCED_STATE_TYPES.includes(state.type) && !caps.allowAdvancedStates) {
      push(`${statePath}.type`, WorkflowValidationIssueCode.STATE_ADVANCED_NOT_ALLOWED, `State type '${state.type}' requires the advanced workflow capability.`);
    }

    const configField = WORKFLOW_STATE_CONFIG_FIELDS[state.type];
    if (!isPlainObject(state[configField])) {
      push(`${statePath}.${configField}`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, `State of type '${state.type}' requires the '${configField}' block.`);
    }
    for (const [type, field] of Object.entries(WORKFLOW_STATE_CONFIG_FIELDS)) {
      if (field !== configField && state[field as keyof WorkflowState] !== undefined) {
        push(`${statePath}.${field}`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, `Block '${field}' belongs to type '${type}', not '${state.type}'.`);
      }
    }

    // Transitions.
    // States used as AGENT tools are invoked by the agent, so they may omit `next` (it is never followed).
    const needsNext = state.type !== WorkflowStateType.CHOICE && state.type !== WorkflowStateType.END && !toolStates.has(id);
    if (needsNext && !state.next) {
      push(`${statePath}.next`, WorkflowValidationIssueCode.TRANSITION_MISSING, `State '${id}' must declare next.`);
    }
    if (state.type === WorkflowStateType.END && state.next) {
      push(`${statePath}.next`, WorkflowValidationIssueCode.TRANSITION_NOT_ALLOWED, "END states cannot declare next.");
    }
    if (state.type === WorkflowStateType.CHOICE && state.next) {
      push(`${statePath}.next`, WorkflowValidationIssueCode.TRANSITION_NOT_ALLOWED, "CHOICE states route through choices/default, not next.");
    }
    if (state.next && !states[state.next]) {
      push(`${statePath}.next`, WorkflowValidationIssueCode.TRANSITION_TARGET_MISSING, `next '${state.next}' does not name a state in this scope.`);
    }
    if (state.onError) {
      if (!(Object.values(WorkflowStateErrorAction) as string[]).includes(String(state.onError.action))) {
        push(`${statePath}.onError.action`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, `Unsupported onError action '${String(state.onError.action)}'.`);
      } else if (state.onError.action === WorkflowStateErrorAction.GOTO) {
        if (!state.onError.next) {
          push(`${statePath}.onError.next`, WorkflowValidationIssueCode.TRANSITION_MISSING, "onError GOTO requires next.");
        } else if (!states[state.onError.next]) {
          push(`${statePath}.onError.next`, WorkflowValidationIssueCode.TRANSITION_TARGET_MISSING, `onError next '${state.onError.next}' does not name a state in this scope.`);
        }
      }
    }
    if (state.retry) {
      if (!isPositiveInteger(state.retry.maxAttempts) || !isPositiveInteger(state.retry.backoffMs) || !(Object.values(WorkflowRetryBackoff) as string[]).includes(String(state.retry.backoff))) {
        push(`${statePath}.retry`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "retry requires maxAttempts >= 1, backoffMs >= 1 and a known backoff strategy.");
      }
    }
    if (state.timeoutMs !== undefined && !isPositiveInteger(state.timeoutMs)) {
      push(`${statePath}.timeoutMs`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "timeoutMs must be a positive integer.");
    }

    // Values visible from this state: dominators in this scope (excluding itself) + outer visible.
    const visible = new Set<string>(scope.outerVisibleStates);
    for (const d of dominators.get(id) ?? []) if (d !== id) visible.add(d);
    const valueArgs: ValueValidationArgs = {
      definition,
      context,
      limits,
      visibleStates: visible,
      insideForeach,
      insideAgent: state.type === WorkflowStateType.AGENT || toolStates.has(id),
      acc,
    };

    if (state.approval !== undefined) validateApprovalGate(state, `${statePath}.approval`, valueArgs);

    switch (state.type) {
      case WorkflowStateType.INTENT:
        if (state.intent) validateIntentState(state.intent, `${statePath}.intent`, valueArgs);
        break;
      case WorkflowStateType.HTTP:
        if (state.http) validateHttpState(state.http, `${statePath}.http`, valueArgs);
        break;
      case WorkflowStateType.CHOICE:
        if (state.choice) validateChoiceState(state.choice, `${statePath}.choice`, states, valueArgs);
        break;
      case WorkflowStateType.TRANSFORM:
        if (state.transform) {
          if (state.transform.output === undefined) {
            push(`${statePath}.transform.output`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "TRANSFORM requires output.");
          } else {
            validateValueNode(state.transform.output, `${statePath}.transform.output`, valueArgs);
          }
        }
        break;
      case WorkflowStateType.END:
        if (state.end) {
          if (!(Object.values(WorkflowEndOutcome) as string[]).includes(String(state.end.outcome))) {
            push(`${statePath}.end.outcome`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, `Unsupported END outcome '${String(state.end.outcome)}'.`);
          }
          if (state.end.output !== undefined) validateValueNode(state.end.output, `${statePath}.end.output`, valueArgs);
          if (state.end.errorMessage !== undefined) validateValueNode(state.end.errorMessage, `${statePath}.end.errorMessage`, valueArgs);
        }
        break;
      case WorkflowStateType.WAIT:
        if (state.wait) {
          validateWaitState(state.wait, `${statePath}.wait`, acc);
          if (state.wait.assignees !== undefined) validateValueNode(state.wait.assignees, `${statePath}.wait.assignees`, valueArgs);
          if (state.wait.instructions !== undefined) validateValueNode(state.wait.instructions, `${statePath}.wait.instructions`, valueArgs);
          if (state.wait.correlation !== undefined) validateValueRecord(state.wait.correlation, `${statePath}.wait.correlation`, valueArgs);
        }
        break;
      case WorkflowStateType.PARALLEL:
        if (state.parallel) {
          if (!Array.isArray(state.parallel.branches) || state.parallel.branches.length === 0) {
            push(`${statePath}.parallel.branches`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "PARALLEL requires at least one branch.");
          } else {
            const seen = new Set<string>();
            state.parallel.branches.forEach((branch, index) => {
              const branchPath = `${statePath}.parallel.branches[${index}]`;
              if (!branch?.id || !STATE_ID_PATTERN.test(branch.id) || seen.has(branch.id)) {
                push(`${branchPath}.id`, WorkflowValidationIssueCode.STATE_ID_INVALID, "Branch id must be unique and match ^[a-z][a-z0-9_]*$.");
              }
              seen.add(branch?.id);
              if (!isPlainObject(branch?.states)) {
                push(`${branchPath}.states`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "Branch requires states.");
                return;
              }
              enterNestedScope(definition, { states: branch.states, startAt: branch.startAt, path: `${branchPath}.states`, outerVisibleStates: visible, nesting: scope.nesting + 1 }, context, caps, limits, acc, insideForeach);
            });
          }
        }
        break;
      case WorkflowStateType.FOREACH:
        if (state.foreach) {
          if (state.foreach.items === undefined) {
            push(`${statePath}.foreach.items`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "FOREACH requires items.");
          } else {
            validateValueNode(state.foreach.items, `${statePath}.foreach.items`, valueArgs);
          }
          if (!isPositiveInteger(state.foreach.maxItems) || !isPositiveInteger(state.foreach.concurrency)) {
            push(`${statePath}.foreach`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "FOREACH requires maxItems >= 1 and concurrency >= 1.");
          }
          if (!isPlainObject(state.foreach.states)) {
            push(`${statePath}.foreach.states`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "FOREACH requires states.");
          } else {
            enterNestedScope(definition, { states: state.foreach.states, startAt: state.foreach.startAt, path: `${statePath}.foreach.states`, outerVisibleStates: visible, nesting: scope.nesting + 1 }, context, caps, limits, acc, true);
          }
        }
        break;
      case WorkflowStateType.AGENT:
        if (state.agent) validateAgentState(state.agent, `${statePath}.agent`, states, caps, valueArgs);
        break;
      case WorkflowStateType.TOOL:
        if (state.tool) validateToolState(state.tool, `${statePath}.tool`, valueArgs);
        break;
      case WorkflowStateType.SUBWORKFLOW:
        if (state.subworkflow) {
          if (typeof state.subworkflow.workflowKey !== "string" || !WORKFLOW_KEY_PATTERN.test(state.subworkflow.workflowKey)) {
            push(`${statePath}.subworkflow.workflowKey`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "SUBWORKFLOW requires a valid workflowKey.");
          } else if (state.subworkflow.workflowKey === definition.key) {
            push(`${statePath}.subworkflow.workflowKey`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "A workflow cannot call itself as a SUBWORKFLOW.");
          }
          validateValueRecord(state.subworkflow.input, `${statePath}.subworkflow.input`, valueArgs);
          const knownWorkflows = context.workflows;
          if (knownWorkflows && typeof state.subworkflow.workflowKey === "string") {
            const child = knownWorkflows.find((w) => w.key === state.subworkflow?.workflowKey);
            if (!child) {
              push(`${statePath}.subworkflow.workflowKey`, WorkflowValidationIssueCode.SUBWORKFLOW_UNKNOWN, `Workflow '${state.subworkflow.workflowKey}' is not published.`);
            } else {
              const childInput = child.inputSchema ?? {};
              const inputKeys = isPlainObject(state.subworkflow.input) ? Object.keys(state.subworkflow.input) : [];
              for (const key of inputKeys) {
                if (!(key in childInput)) {
                  push(`${statePath}.subworkflow.input.${key}`, WorkflowValidationIssueCode.SUBWORKFLOW_INPUT_UNKNOWN, `Workflow '${child.key}' has no input '${key}'.`);
                }
              }
              for (const [key, variable] of Object.entries(childInput)) {
                if (variable?.required && !inputKeys.includes(key)) {
                  push(`${statePath}.subworkflow.input.${key}`, WorkflowValidationIssueCode.SUBWORKFLOW_INPUT_MISSING, `Workflow '${child.key}' requires input '${key}'.`);
                }
              }
            }
          }
        }
        break;
      default:
        break;
    }
  }

  // Reachability and terminal coverage (only for a syntactically sane scope).
  const reachable = new Set<string>();
  const stack = [scope.startAt];
  if (scope.nesting === 0 && definition.settings?.onError?.action === WorkflowStateErrorAction.GOTO && definition.settings.onError.next) {
    stack.push(definition.settings.onError.next);
  }
  while (stack.length) {
    const cur = stack.pop() as string;
    if (reachable.has(cur) || !states[cur]) continue;
    reachable.add(cur);
    for (const succ of successorsOf(states[cur])) stack.push(succ);
  }
  for (const id of ids) {
    if (!reachable.has(id)) {
      push(`${scope.path}.${id}`, WorkflowValidationIssueCode.STATE_UNREACHABLE, `State '${id}' is not reachable from startAt.`);
    }
  }
  const endReachable = Array.from(reachable).some((id) => states[id]?.type === WorkflowStateType.END);
  if (!endReachable && scope.nesting === 0) {
    push(scope.path, WorkflowValidationIssueCode.END_UNREACHABLE, "No END state is reachable from startAt.");
  }
  for (const cycle of findCyclesWithoutWait(states, scope.startAt)) {
    push(`${scope.path}.${cycle[0]}`, WorkflowValidationIssueCode.CYCLE_WITHOUT_WAIT, `Cycle ${cycle.join(" -> ")} -> ${cycle[0]} does not pass through a WAIT state.`);
  }
}

/**
 * Validates a nested sub-graph, enforcing the nesting cap.
 */
function enterNestedScope(
  definition: WorkflowDefinition,
  scope: GraphValidationScope,
  context: WorkflowValidationContext,
  caps: WorkflowValidationCaps,
  limits: WorkflowValueLimits,
  acc: GraphValidationAccumulator,
  insideForeach: boolean,
): void {
  if (scope.nesting > caps.maxNestingDepth) {
    acc.issues.push({
      path: scope.path,
      code: WorkflowValidationIssueCode.LIMIT_EXCEEDED,
      message: `Sub-graph nesting exceeds the maximum depth (${caps.maxNestingDepth}).`,
    });
    return;
  }
  validateGraphScope(definition, scope, context, caps, limits, acc, insideForeach);
}

/**
 * Validates an `INTENT` state block.
 */
function validateIntentState(config: WorkflowIntentStateConfig, path: string, args: ValueValidationArgs): void {
  const push = (p: string, code: WorkflowValidationIssueCode, message: string): void => {
    args.acc.issues.push({ path: p, code, message });
  };
  if (typeof config.intent !== "string" || !config.intent.trim()) {
    push(`${path}.intent`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "INTENT requires intent.");
    return;
  }
  if (!isPlainObject(config.vars)) {
    push(`${path}.vars`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "INTENT requires vars.");
  } else {
    validateValueRecord(config.vars, `${path}.vars`, args);
  }
  if (config.context !== undefined) validateValueRecord(config.context, `${path}.context`, args);
  if (config.inputParts !== undefined) validateValueNode(config.inputParts, `${path}.inputParts`, args);

  const known = args.context.intents;
  if (!known) return;
  const found = known.find((i) => i.intent === config.intent);
  if (!found) {
    push(`${path}.intent`, WorkflowValidationIssueCode.INTENT_UNKNOWN, `Intent '${config.intent}' is not in the registry.`);
    return;
  }
  const schema = found.inputSchema ?? {};
  const varKeys = isPlainObject(config.vars) ? Object.keys(config.vars) : [];
  for (const key of varKeys) {
    if (!(key in schema)) {
      push(`${path}.vars.${key}`, WorkflowValidationIssueCode.INTENT_VAR_UNKNOWN, `Intent '${config.intent}' has no input variable '${key}'.`);
    }
  }
  for (const [key, variable] of Object.entries(schema)) {
    if (variable?.required && !varKeys.includes(key)) {
      push(`${path}.vars.${key}`, WorkflowValidationIssueCode.INTENT_VAR_MISSING, `Intent '${config.intent}' requires variable '${key}'.`);
    }
  }
  const hasAssetVar = Object.values(schema).some((v) => v?.type === PromptVariableType.ASSET);
  if (config.inputParts !== undefined && !hasAssetVar) {
    push(`${path}.inputParts`, WorkflowValidationIssueCode.INTENT_INPUT_PARTS_NOT_SUPPORTED, `Intent '${config.intent}' declares no asset variable; inputParts are not allowed.`);
  }
}

/**
 * Validates an `HTTP` state block.
 */
/**
 * Validates a `TOOL` state against the published capability catalog.
 *
 * The catalog is what makes this state worth having: because the argument shape is ours and not the
 * tenant's, everything here can be checked before a single call is made - that the capability exists,
 * that a runner can actually execute it, that the connection matches the broker, and that the
 * arguments are the ones the capability declares.
 *
 * @param config State configuration.
 * @param path Path of the config block, for issue reporting.
 * @param args Shared validation context.
 */
function validateToolState(config: WorkflowToolStateConfig, path: string, args: ValueValidationArgs): void {
  const push = (p: string, code: WorkflowValidationIssueCode, message: string): void => {
    args.acc.issues.push({ path: p, code, message });
  };

  const id = String(config.capability ?? "").trim();
  if (!id) {
    push(`${path}.capability`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "TOOL requires capability.");
    return;
  }

  const capability = findWorkflowCapability(id);
  if (!capability) {
    push(`${path}.capability`, WorkflowValidationIssueCode.CAPABILITY_UNKNOWN, `Capability '${id}' is not in the catalog.`);
    return;
  }
  if (!WORKFLOW_IMPLEMENTED_CAPABILITIES.includes(capability.id)) {
    push(`${path}.capability`, WorkflowValidationIssueCode.CAPABILITY_NOT_IMPLEMENTED, `Capability '${id}' has no runner support yet.`);
  }

  // The broker decides who holds the credentials, so it decides whether a connection belongs here.
  // A connection on a platform-brokered capability is not harmless noise: it reads as if the tenant
  // controlled the call, and they do not.
  const connection = String(config.connection ?? "").trim();
  if (capability.broker === WorkflowCapabilityBroker.CONNECTION) {
    if (!connection) {
      push(`${path}.connection`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, `Capability '${id}' requires a ${String(capability.protocol)} connection.`);
    } else if (args.context.connections && !args.context.connections.includes(connection)) {
      push(`${path}.connection`, WorkflowValidationIssueCode.CONNECTION_UNKNOWN, `Connection '${connection}' is not defined.`);
    }
  } else if (connection) {
    push(`${path}.connection`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, `Capability '${id}' runs on platform credentials and takes no connection.`);
  }

  if (config.args !== undefined) validateValueRecord(config.args, `${path}.args`, args);

  const provided = isPlainObject(config.args) ? Object.keys(config.args as Record<string, unknown>) : [];
  for (const key of provided) {
    if (!(key in capability.inputSchema)) {
      push(`${path}.args.${key}`, WorkflowValidationIssueCode.CAPABILITY_ARG_UNKNOWN, `Capability '${id}' has no argument '${key}'.`);
    }
  }
  for (const [key, variable] of Object.entries(capability.inputSchema)) {
    if (variable?.required === true && !provided.includes(key)) {
      push(`${path}.args.${key}`, WorkflowValidationIssueCode.CAPABILITY_ARG_MISSING, `Capability '${id}' requires argument '${key}'.`);
    }
  }
}

function validateHttpState(config: WorkflowHttpStateConfig, path: string, args: ValueValidationArgs): void {
  const push = (p: string, code: WorkflowValidationIssueCode, message: string): void => {
    args.acc.issues.push({ path: p, code, message });
  };
  if (typeof config.connection !== "string" || !config.connection.trim()) {
    push(`${path}.connection`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "HTTP requires connection.");
  } else if (args.context.connections && !args.context.connections.includes(config.connection)) {
    push(`${path}.connection`, WorkflowValidationIssueCode.CONNECTION_UNKNOWN, `Connection '${config.connection}' is not defined.`);
  }
  if (!(Object.values(WorkflowHttpMethod) as string[]).includes(String(config.method))) {
    push(`${path}.method`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, `Unsupported HTTP method '${String(config.method)}'.`);
  }
  if (!(Object.values(WorkflowHttpResponseType) as string[]).includes(String(config.responseType))) {
    push(`${path}.responseType`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, `Unsupported responseType '${String(config.responseType)}'.`);
  }
  if (config.path === undefined) {
    push(`${path}.path`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "HTTP requires path.");
  } else {
    validateValueNode(config.path, `${path}.path`, args);
  }
  if (config.query !== undefined) validateValueRecord(config.query, `${path}.query`, args);
  if (config.headers !== undefined) {
    validateValueRecord(config.headers, `${path}.headers`, args);
    if (isPlainObject(config.headers)) {
      for (const name of Object.keys(config.headers)) {
        if (FORBIDDEN_HTTP_HEADERS.includes(name.toLowerCase())) {
          push(`${path}.headers.${name}`, WorkflowValidationIssueCode.HTTP_HEADER_FORBIDDEN, `Header '${name}' is a credential header; use the connection instead.`);
        }
      }
    }
  }
  if (config.body !== undefined) validateValueNode(config.body, `${path}.body`, args);
  if (config.expectStatus !== undefined) {
    if (!Array.isArray(config.expectStatus) || config.expectStatus.some((s) => !Number.isInteger(s) || s < 100 || s > 599)) {
      push(`${path}.expectStatus`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "expectStatus must be an array of HTTP status codes.");
    }
  }
}

/**
 * Validates a `CHOICE` state block.
 */
function validateChoiceState(
  config: WorkflowChoiceStateConfig,
  path: string,
  states: Record<string, WorkflowState>,
  args: ValueValidationArgs,
): void {
  const push = (p: string, code: WorkflowValidationIssueCode, message: string): void => {
    args.acc.issues.push({ path: p, code, message });
  };
  if (!Array.isArray(config.choices) || config.choices.length === 0) {
    push(`${path}.choices`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "CHOICE requires at least one case.");
  } else {
    const seen = new Set<string>();
    config.choices.forEach((item, index) => {
      const casePath = `${path}.choices[${index}]`;
      if (!item?.id || !STATE_ID_PATTERN.test(item.id) || seen.has(item.id)) {
        push(`${casePath}.id`, WorkflowValidationIssueCode.STATE_ID_INVALID, "Case id must be unique and match ^[a-z][a-z0-9_]*$.");
      }
      seen.add(item?.id);
      if (!item?.next) {
        push(`${casePath}.next`, WorkflowValidationIssueCode.TRANSITION_MISSING, "Case requires next.");
      } else if (!states[item.next]) {
        push(`${casePath}.next`, WorkflowValidationIssueCode.TRANSITION_TARGET_MISSING, `Case next '${item.next}' does not name a state in this scope.`);
      }
      if (!item?.condition) {
        push(`${casePath}.condition`, WorkflowValidationIssueCode.CONDITION_INVALID, "Case requires condition.");
      } else {
        const result = validateConditionTree(item.condition, { rootPath: `${casePath}.condition` });
        for (const issue of result.issues) {
          push(issue.path, WorkflowValidationIssueCode.CONDITION_INVALID, issue.message);
        }
        validateConditionRefs(item.condition, `${casePath}.condition`, args);
      }
    });
  }
  if (!config.default) {
    push(`${path}.default`, WorkflowValidationIssueCode.TRANSITION_MISSING, "CHOICE requires default.");
  } else if (!states[config.default]) {
    push(`${path}.default`, WorkflowValidationIssueCode.TRANSITION_TARGET_MISSING, `default '${config.default}' does not name a state in this scope.`);
  }
}

/**
 * Validates the reference paths used by condition leaves (same grammar and visibility as `$ref`).
 */
function validateConditionRefs(
  node: ConditionLeaf | ConditionGroup<ConditionLeaf>,
  path: string,
  args: ValueValidationArgs,
): void {
  if (!isPlainObject(node)) return;
  const group = node as ConditionGroup<ConditionLeaf>;
  if (Array.isArray(group.conditions)) {
    group.conditions.forEach((child, index) => validateConditionRefs(child, `${path}.conditions[${index}]`, args));
    return;
  }
  const leaf = node as ConditionLeaf;
  if (typeof leaf.path === "string" && leaf.path.trim()) {
    validateRefPath(leaf.path, `${path}.path`, args, false);
  }
}

/**
 * Validates an `AGENT` state block.
 */
function validateAgentState(
  config: WorkflowAgentStateConfig,
  path: string,
  states: Record<string, WorkflowState>,
  caps: WorkflowValidationCaps,
  args: ValueValidationArgs,
): void {
  const push = (p: string, code: WorkflowValidationIssueCode, message: string): void => {
    args.acc.issues.push({ path: p, code, message });
  };
  const known = args.context.intents;

  if (typeof config.plannerIntent !== "string" || !config.plannerIntent.trim()) {
    push(`${path}.plannerIntent`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "AGENT requires plannerIntent.");
  } else if (known && !known.some((i) => i.intent === config.plannerIntent)) {
    push(`${path}.plannerIntent`, WorkflowValidationIssueCode.INTENT_UNKNOWN, `Planner intent '${config.plannerIntent}' is not in the registry.`);
  }

  if (config.goal === undefined) {
    push(`${path}.goal`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "AGENT requires goal.");
  } else {
    validateValueNode(config.goal, `${path}.goal`, args);
  }
  if (config.context !== undefined) validateValueRecord(config.context, `${path}.context`, args);

  if (!isPositiveInteger(config.maxIterations) || config.maxIterations > caps.maxAgentIterations) {
    push(`${path}.maxIterations`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, `maxIterations must be a positive integer <= ${caps.maxAgentIterations}.`);
  }
  if (config.maxTrackedCalls !== undefined && !isPositiveInteger(config.maxTrackedCalls)) {
    push(`${path}.maxTrackedCalls`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "maxTrackedCalls must be a positive integer.");
  }
  if (config.maxToolErrors !== undefined && (!Number.isInteger(config.maxToolErrors) || config.maxToolErrors < 0)) {
    push(`${path}.maxToolErrors`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "maxToolErrors must be a non-negative integer.");
  }
  if (config.maxDurationMs !== undefined && (!isPositiveInteger(config.maxDurationMs) || config.maxDurationMs > caps.maxAgentDurationMs)) {
    push(`${path}.maxDurationMs`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, `maxDurationMs must be a positive integer <= ${caps.maxAgentDurationMs}.`);
  }
  if (config.maxEstimatedCost !== undefined && (typeof config.maxEstimatedCost !== "number" || !Number.isFinite(config.maxEstimatedCost) || config.maxEstimatedCost <= 0)) {
    push(`${path}.maxEstimatedCost`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "maxEstimatedCost must be a positive number.");
  }
  if (config.historyWindow !== undefined && !isPositiveInteger(config.historyWindow)) {
    push(`${path}.historyWindow`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "historyWindow must be a positive integer.");
  }
  if (config.summarizerIntent !== undefined) {
    if (typeof config.summarizerIntent !== "string" || !config.summarizerIntent.trim()) {
      push(`${path}.summarizerIntent`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "summarizerIntent must be a non-empty intent key.");
    } else if (known && !known.some((i) => i.intent === config.summarizerIntent)) {
      push(`${path}.summarizerIntent`, WorkflowValidationIssueCode.INTENT_UNKNOWN, `Summarizer intent '${config.summarizerIntent}' is not in the registry.`);
    }
  }

  if (!Array.isArray(config.tools) || config.tools.length === 0) {
    push(`${path}.tools`, WorkflowValidationIssueCode.AGENT_TOOL_INVALID, "AGENT requires at least one tool.");
    return;
  }
  const seen = new Set<string>();
  config.tools.forEach((tool, index) => {
    const toolPath = `${path}.tools[${index}]`;
    if (!isPlainObject(tool)) {
      push(toolPath, WorkflowValidationIssueCode.AGENT_TOOL_INVALID, "Tool must be an object.");
      return;
    }
    if (typeof tool.id !== "string" || !STATE_ID_PATTERN.test(tool.id) || seen.has(tool.id)) {
      push(`${toolPath}.id`, WorkflowValidationIssueCode.AGENT_TOOL_INVALID, "Tool id must be unique and match ^[a-z][a-z0-9_]*$.");
    }
    seen.add(String(tool.id));
    if (typeof tool.description !== "string" || !tool.description.trim()) {
      push(`${toolPath}.description`, WorkflowValidationIssueCode.AGENT_TOOL_INVALID, "Tool requires a description for the planner.");
    }
    if (tool.inputSchema !== undefined && !isPlainObject(tool.inputSchema)) {
      push(`${toolPath}.inputSchema`, WorkflowValidationIssueCode.AGENT_TOOL_INVALID, "Tool inputSchema must be a record of prompt variables.");
    }
    switch (tool.kind) {
      case WorkflowAgentToolKind.INTENT:
        if (typeof tool.intent !== "string" || !tool.intent.trim()) {
          push(`${toolPath}.intent`, WorkflowValidationIssueCode.AGENT_TOOL_INVALID, "INTENT tool requires intent.");
        } else if (known && !known.some((i) => i.intent === tool.intent)) {
          push(`${toolPath}.intent`, WorkflowValidationIssueCode.INTENT_UNKNOWN, `Tool intent '${tool.intent}' is not in the registry.`);
        }
        if (tool.state !== undefined) {
          push(`${toolPath}.state`, WorkflowValidationIssueCode.AGENT_TOOL_INVALID, "INTENT tool must not set state.");
        }
        break;
      case WorkflowAgentToolKind.STATE: {
        if (typeof tool.state !== "string" || !tool.state.trim()) {
          push(`${toolPath}.state`, WorkflowValidationIssueCode.AGENT_TOOL_INVALID, "STATE tool requires state.");
          break;
        }
        const target = states[tool.state];
        if (!target) {
          push(`${toolPath}.state`, WorkflowValidationIssueCode.AGENT_TOOL_INVALID, `Tool state '${tool.state}' does not name a state in this scope.`);
        } else if (!WORKFLOW_AGENT_TOOL_STATE_TYPES.includes(target.type)) {
          push(`${toolPath}.state`, WorkflowValidationIssueCode.AGENT_TOOL_INVALID, `Tool state '${tool.state}' must be one of ${WORKFLOW_AGENT_TOOL_STATE_TYPES.join(", ")}.`);
        }
        if (tool.intent !== undefined) {
          push(`${toolPath}.intent`, WorkflowValidationIssueCode.AGENT_TOOL_INVALID, "STATE tool must not set intent.");
        }
        break;
      }
      default:
        push(`${toolPath}.kind`, WorkflowValidationIssueCode.AGENT_TOOL_INVALID, `Unsupported tool kind '${String(tool.kind)}'.`);
        break;
    }
  });
}

/**
 * Validates a `WAIT` state block.
 */
function validateWaitState(config: WorkflowWaitStateConfig, path: string, acc: GraphValidationAccumulator): void {
  const push = (p: string, code: WorkflowValidationIssueCode, message: string): void => {
    acc.issues.push({ path: p, code, message });
  };
  if (!(Object.values(WorkflowWaitKind) as string[]).includes(String(config.kind))) {
    push(`${path}.kind`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, `Unsupported wait kind '${String(config.kind)}'.`);
    return;
  }
  if (!isPositiveInteger(config.timeoutMs)) {
    push(`${path}.timeoutMs`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "WAIT requires timeoutMs >= 1.");
  }
  if (config.kind === WorkflowWaitKind.DELAY && !isPositiveInteger(config.delayMs)) {
    push(`${path}.delayMs`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "DELAY requires delayMs >= 1.");
  }
  if (config.kind === WorkflowWaitKind.EXTERNAL_EVENT && (typeof config.eventKey !== "string" || !config.eventKey.trim())) {
    push(`${path}.eventKey`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "EXTERNAL_EVENT requires eventKey.");
  }
  if (config.kind === WorkflowWaitKind.HUMAN_TASK && !isPlainObject(config.form)) {
    push(`${path}.form`, WorkflowValidationIssueCode.STATE_CONFIG_MISSING, "HUMAN_TASK requires form.");
  }
}

/**
 * Validates the approval gate of a state: not on `END` (nothing to gate), a positive timeout, an
 * optional group key and well-formed assignee / instruction mappings.
 */
function validateApprovalGate(state: WorkflowState, path: string, args: ValueValidationArgs): void {
  const push = (p: string, code: WorkflowValidationIssueCode, message: string): void => {
    args.acc.issues.push({ path: p, code, message });
  };
  const approval = state.approval;
  if (!isPlainObject(approval)) {
    push(path, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "approval must be an object.");
    return;
  }
  if (state.type === WorkflowStateType.END) {
    push(path, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "END states cannot require approval.");
  }
  if (!isPositiveInteger(approval.timeoutMs)) {
    push(`${path}.timeoutMs`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "approval requires timeoutMs >= 1.");
  }
  if (approval.assignmentGroupKey !== undefined && (typeof approval.assignmentGroupKey !== "string" || !approval.assignmentGroupKey.trim())) {
    push(`${path}.assignmentGroupKey`, WorkflowValidationIssueCode.STATE_CONFIG_INVALID, "assignmentGroupKey must be a non-empty string.");
  }
  if (approval.assignees !== undefined) validateValueNode(approval.assignees, `${path}.assignees`, args);
  if (approval.instructions !== undefined) validateValueNode(approval.instructions, `${path}.instructions`, args);
}

/**
 * Validates a record of value nodes.
 */
function validateValueRecord(
  record: Record<string, WorkflowValueNode> | undefined,
  path: string,
  args: ValueValidationArgs,
): void {
  if (!isPlainObject(record)) {
    args.acc.issues.push({ path, code: WorkflowValidationIssueCode.VALUE_INVALID, message: "Expected a record of value nodes." });
    return;
  }
  for (const [key, node] of Object.entries(record)) {
    validateValueNode(node, `${path}.${key}`, args);
  }
}

/**
 * Validates a reference path: grammar, root, `item.*` scope and `states.<id>` visibility.
 *
 * @param requireDominance When true, a `states.<id>` reference to a non-dominating state is an
 * issue unless the caller declared a default (`hasDefault`).
 */
function validateRefPath(
  ref: string,
  path: string,
  args: ValueValidationArgs,
  hasDefault: boolean,
): void {
  const push = (code: WorkflowValidationIssueCode, message: string): void => {
    args.acc.issues.push({ path, code, message });
  };
  const parsed = parseWorkflowRefPath(ref, args.limits);
  if (!parsed) {
    push(WorkflowValidationIssueCode.REF_INVALID, `Reference '${ref}' is malformed or exceeds the limits (roots: ${Object.values(WorkflowRefRoot).join(", ")}).`);
    return;
  }
  if (parsed.root === WorkflowRefRoot.ITEM && !args.insideForeach) {
    push(WorkflowValidationIssueCode.REF_INVALID, `Reference '${ref}' uses item.* outside a FOREACH body.`);
    return;
  }
  if (parsed.root === WorkflowRefRoot.AGENT && !args.insideAgent) {
    push(WorkflowValidationIssueCode.REF_INVALID, `Reference '${ref}' uses agent.* outside an AGENT state or one of its tools.`);
    return;
  }
  if (parsed.root === WorkflowRefRoot.STATES) {
    const stateId = parsed.segments[0];
    if (!stateId) {
      push(WorkflowValidationIssueCode.REF_INVALID, `Reference '${ref}' must name a state (states.<id>...).`);
      return;
    }
    const known = collectAllStateIds(args.definition.states);
    if (!known.has(stateId)) {
      push(WorkflowValidationIssueCode.REF_INVALID, `Reference '${ref}' names unknown state '${stateId}'.`);
      return;
    }
    if (!args.visibleStates.has(stateId) && !hasDefault) {
      push(WorkflowValidationIssueCode.REF_STATE_NOT_DOMINATING, `Reference '${ref}' targets state '${stateId}', which does not run before this state on every path; add a default or restructure the graph.`);
    }
  }
}

/**
 * Validates a value tree (kinds, payloads, arity, references, templates, limits).
 */
function validateValueNode(node: WorkflowValueNode, path: string, args: ValueValidationArgs): void {
  const counter = { nodes: 0 };
  validateValueNodeInternal(node, path, args, counter, 0);
}

/**
 * Recursive worker for `validateValueNode`.
 */
function validateValueNodeInternal(
  node: WorkflowValueNode,
  path: string,
  args: ValueValidationArgs,
  counter: { nodes: number },
  depth: number,
): void {
  const push = (code: WorkflowValidationIssueCode, message: string, p: string = path): void => {
    args.acc.issues.push({ path: p, code, message });
  };
  counter.nodes++;
  if (counter.nodes > args.limits.maxNodes) {
    if (counter.nodes === args.limits.maxNodes + 1) {
      push(WorkflowValidationIssueCode.LIMIT_EXCEEDED, `Value tree exceeds the maximum node count (${args.limits.maxNodes}).`);
    }
    return;
  }
  if (depth > args.limits.maxDepth) {
    push(WorkflowValidationIssueCode.LIMIT_EXCEEDED, `Value tree exceeds the maximum depth (${args.limits.maxDepth}).`);
    return;
  }
  if (!isPlainObject(node)) {
    push(WorkflowValidationIssueCode.VALUE_INVALID, "Value node must be an object (use parseWorkflowValueShorthand at the boundary).");
    return;
  }
  if (!(Object.values(WorkflowValueKind) as string[]).includes(String(node.kind))) {
    push(WorkflowValidationIssueCode.VALUE_INVALID, `Unsupported value kind '${String(node.kind)}'.`);
    return;
  }

  switch (node.kind) {
    case WorkflowValueKind.LITERAL:
      if (node.literal !== undefined && !isScalarLiteral(node.literal)) {
        push(WorkflowValidationIssueCode.VALUE_INVALID, "LITERAL must be a string, finite number, boolean or null.", `${path}.literal`);
      }
      break;
    case WorkflowValueKind.REF:
      if (typeof node.ref !== "string" || !node.ref.trim()) {
        push(WorkflowValidationIssueCode.REF_INVALID, "REF requires ref.", `${path}.ref`);
      } else {
        validateRefPath(node.ref, `${path}.ref`, args, node.default !== undefined);
      }
      if (node.default !== undefined && !isScalarLiteral(node.default)) {
        push(WorkflowValidationIssueCode.VALUE_INVALID, "REF default must be a scalar.", `${path}.default`);
      }
      break;
    case WorkflowValueKind.FN: {
      if (!node.fn || !(Object.values(WorkflowMappingFunction) as string[]).includes(String(node.fn))) {
        push(WorkflowValidationIssueCode.VALUE_INVALID, `Unsupported mapping function '${String(node.fn)}'.`, `${path}.fn`);
        break;
      }
      const meta = WORKFLOW_MAPPING_FUNCTION_META[node.fn];
      const fnArgs = Array.isArray(node.args) ? node.args : [];
      if (fnArgs.length < meta.minArgs || (meta.maxArgs !== null && fnArgs.length > meta.maxArgs)) {
        const bound = meta.maxArgs === null ? `at least ${meta.minArgs}` : meta.minArgs === meta.maxArgs ? `exactly ${meta.minArgs}` : `between ${meta.minArgs} and ${meta.maxArgs}`;
        push(WorkflowValidationIssueCode.FUNCTION_ARITY_INVALID, `Function ${node.fn} expects ${bound} argument(s), got ${fnArgs.length}.`, `${path}.args`);
      }
      if ((node.fn === WorkflowMappingFunction.DATE_ADD || node.fn === WorkflowMappingFunction.DATE_DIFF) && fnArgs.length === 3) {
        const unitArg = fnArgs[2];
        if (unitArg?.kind === WorkflowValueKind.LITERAL && toDateUnit(unitArg.literal) === null) {
          push(WorkflowValidationIssueCode.VALUE_INVALID, `Function ${node.fn} expects a date unit (${Object.values(WorkflowDateUnit).join(", ")}).`, `${path}.args[2]`);
        }
      }
      fnArgs.forEach((arg, index) => validateValueNodeInternal(arg, `${path}.args[${index}]`, args, counter, depth + 1));
      break;
    }
    case WorkflowValueKind.TEMPLATE: {
      const template = node.template;
      if (typeof template !== "string") {
        push(WorkflowValidationIssueCode.TEMPLATE_INVALID, "TEMPLATE requires template.", `${path}.template`);
        break;
      }
      if (template.length > args.limits.maxTemplateLength) {
        push(WorkflowValidationIssueCode.LIMIT_EXCEEDED, `Template exceeds ${args.limits.maxTemplateLength} characters.`, `${path}.template`);
      }
      if (TEMPLATE_SECTION_PATTERN.test(template)) {
        push(WorkflowValidationIssueCode.TEMPLATE_INVALID, "Templates support {{path}} placeholders only (no sections, partials or comments).", `${path}.template`);
      }
      for (const ref of listWorkflowTemplateRefs(template)) {
        validateRefPath(ref, `${path}.template`, args, true);
      }
      break;
    }
    case WorkflowValueKind.OBJECT:
      if (!isPlainObject(node.object)) {
        push(WorkflowValidationIssueCode.VALUE_INVALID, "OBJECT requires object.", `${path}.object`);
        break;
      }
      for (const [key, child] of Object.entries(node.object)) {
        validateValueNodeInternal(child, `${path}.${key}`, args, counter, depth + 1);
      }
      break;
    case WorkflowValueKind.ARRAY:
      if (!Array.isArray(node.array)) {
        push(WorkflowValidationIssueCode.VALUE_INVALID, "ARRAY requires array.", `${path}.array`);
        break;
      }
      node.array.forEach((child, index) => validateValueNodeInternal(child, `${path}[${index}]`, args, counter, depth + 1));
      break;
    default:
      break;
  }
}

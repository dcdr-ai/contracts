import { PromptVariable } from "./prompts.contract";
import { DcdrServiceTokenScope } from "./service-tokens.contract";
import {
  WorkflowDefinition,
  WorkflowEvidence,
  WorkflowValidationResult,
  WorkflowWaitKind,
} from "./workflow.contract";

/**
 * Tenant workflow API client: what a customer's own systems call to run governed workflows.
 *
 * Three clients, three audiences - and they are separate because their **origins and credentials
 * are separate**, not as a matter of taste:
 *
 * | Client | Talks to | Credential |
 * | --- | --- | --- |
 * | `DcdrRuntimeClient` | the runtime gateway | session token / runtime API token |
 * | `DcdrWorkflowClient` | the control plane (`/api/dcdr/workflows/*`) | service token |
 * | `DcdrWorkflowRunnerClient` | the control plane (`/api/workflows/*`) | fleet collection token |
 *
 * {@link DcdrClient} composes the first two behind one object for the common case where a single
 * bearer token reaches both.
 *
 * ## What this API is not
 * It is not the DCDR web UI's API. That one (`/api/ai_workflows*`) authenticates a logged-in person,
 * enforces per-entity ACLs and takes an internal filter DSL; none of that can be granted to a
 * machine. This surface has exactly one credential, is addressed by workflow **key**, and returns
 * stable DTOs rather than database rows.
 *
 * ## What it deliberately cannot do
 * Authoring. There is no create, publish or roll back here: a workflow definition names intents,
 * connections, allowed hosts and allowed shell commands, so a token that could write one would reach
 * everything the tenant's connections reach. Running is bounded by what a person published.
 * {@link DcdrWorkflowClient.validateWorkflow} is offered because it persists nothing.
 *
 * @example
 * ```ts
 * const workflows = new DcdrWorkflowClient({ bearerToken: process.env.DCDR_SERVICE_TOKEN });
 * const result = await workflows.runWorkflowAndWait("SUPPORT_TRIAGE", { input: { ticketId: "T-1" } });
 * if (result.succeeded) console.log(result.output);
 * ```
 */

/** Mount path of the tenant workflow API on the control plane. */
export const DCDR_WORKFLOW_API_BASE_PATH = "/api/dcdr/workflows";

/** Default control-plane origin. */
export const DCDR_WORKFLOW_DEFAULT_BASE_URL = "https://dcdr.ai";

/** Default per-request timeout (ms). One request, not one run. */
export const DCDR_WORKFLOW_DEFAULT_TIMEOUT_MS = 15_000;

/** Header honoured by the run endpoint for de-duplication. */
export const DCDR_WORKFLOW_IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/** Upper bound the server applies to a caller-requested synchronous hold. */
export const DCDR_WORKFLOW_MAX_WAIT_FOR_RESULT_MS = 120_000;

/** Largest page any list endpoint will serve. */
export const DCDR_WORKFLOW_MAX_LIMIT = 100;

/** Workflow key rule, mirroring the control plane. */
export const DCDR_WORKFLOW_KEY_REGEX = /^[A-Z][A-Z0-9_-]*$/;

/** Body previews embedded in error messages are capped at this many characters. */
const ERROR_BODY_PREVIEW_MAX_CHARS = 2_000;

/**
 * Lifecycle of a run, as the control plane persists it.
 */
export enum WorkflowRunStatus {
  /** Persisted and waiting for a runner to pick it up. */
  QUEUED = "QUEUED",
  /** Held by a runner. */
  RUNNING = "RUNNING",
  /** Parked on a `WAIT` state: a delay, an external event, a human task or an approval gate. */
  WAITING = "WAITING",
  COMPLETED = "COMPLETED",
  /** Reached an `END` state after a state applied an error policy other than `FAIL_RUN`. */
  COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  /** The run deadline passed before it finished. */
  TIMEOUT = "TIMEOUT",
}

/** Statuses after which a run never changes again. */
export const WORKFLOW_RUN_TERMINAL_STATUSES: readonly WorkflowRunStatus[] = [
  WorkflowRunStatus.COMPLETED,
  WorkflowRunStatus.COMPLETED_WITH_ERRORS,
  WorkflowRunStatus.FAILED,
  WorkflowRunStatus.CANCELLED,
  WorkflowRunStatus.TIMEOUT,
];

/** Statuses that mean the workflow reached an `END` state without the run failing. */
export const WORKFLOW_RUN_SUCCESS_STATUSES: readonly WorkflowRunStatus[] = [
  WorkflowRunStatus.COMPLETED,
  WorkflowRunStatus.COMPLETED_WITH_ERRORS,
];

/** How a run was started. */
export enum WorkflowTriggerType {
  /** A person, from the DCDR web UI. */
  MANUAL = "MANUAL",
  /** This API. */
  HTTP = "HTTP",
  /** The cron sweep. */
  CRON = "CRON",
  /** A platform event. */
  EVENT = "EVENT",
}

/** Status of one executed transition. */
export enum WorkflowRunStepStatus {
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  WAITING = "WAITING",
  CANCELLED = "CANCELLED",
}

/**
 * How far a piece of evidence can be trusted.
 *
 * This is the field that makes an evidence trail worth keeping: "we recorded that it happened" and
 * "we executed it ourselves" are different claims, and a compliance reviewer needs to know which.
 */
export enum WorkflowEvidenceAssurance {
  /** The runner executed the action itself. The record cannot be wrong or missing. */
  ENFORCED = "ENFORCED",
  /** Seen at a network boundary. The action happened; the intent is unknown. */
  OBSERVED = "OBSERVED",
  /** A model, SDK or provider said so. Recorded, not verified. */
  REPORTED = "REPORTED",
  /** Black box. */
  NONE = "NONE",
}

/**
 * Stable failure vocabulary of the tenant workflow API.
 *
 * The first seven are the control plane's own service error codes, passed through rather than
 * inferred from the HTTP status. That matters: `INVALID_STATE` and `LIMIT_REACHED` both arrive as
 * `409`, and "this run already finished" is not "you ran out of runs today".
 */
export enum DcdrWorkflowErrorCode {
  /** No such workflow or run - or none this token may see. The two are indistinguishable by design. */
  NOT_FOUND = "NOT_FOUND",
  /** The operation is not allowed. */
  FORBIDDEN = "FORBIDDEN",
  /** The request body or a parameter is invalid; `details` carries the issues. */
  VALIDATION = "VALIDATION",
  /** A concurrent change lost the race. */
  CONFLICT = "CONFLICT",
  /** The run is not in a state this operation accepts. */
  INVALID_STATE = "INVALID_STATE",
  /** A tenant business limit was hit; `limit` carries the counters. */
  LIMIT_REACHED = "LIMIT_REACHED",
  /** Workflows are disabled for this tenant or deployment. */
  DISABLED = "DISABLED",
  /** No token, an invalid one, or one without the scope this call needs. */
  UNAUTHORIZED = "UNAUTHORIZED",
  /** A rate limiter refused the call. */
  RATE_LIMITED = "RATE_LIMITED",
  /** The server failed. */
  SERVER_ERROR = "SERVER_ERROR",
  /** The request, or the wait, exceeded its timeout. */
  TIMEOUT = "TIMEOUT",
  /** The caller's `AbortSignal` fired. */
  CANCELLED = "CANCELLED",
  /** The transport failed before a response arrived. */
  NETWORK = "NETWORK",
  /** A 2xx the client could not read as the documented shape. */
  UNEXPECTED_RESPONSE = "UNEXPECTED_RESPONSE",
  /** The client is misconfigured (no base URL, no token, no `fetch`). */
  CONFIGURATION = "CONFIGURATION",
}

/** Parsed tenant-limit payload. */
export interface DcdrWorkflowLimitDetails {
  limitKey: string;
  current: number;
  max: number;
  /** Best-effort tier label, for upgrade prompts. */
  tier?: string;
}

/** Error recorded on a failed run or step. Never carries secrets or raw provider payloads. */
export interface WorkflowRunError {
  code: string;
  message: string;
  stateId?: string | null;
}

/** What a run consumed. */
export interface WorkflowRunUsage {
  trackedCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  currency: string | null;
  /** Tool invocations per capability id. */
  toolCalls: Record<string, number>;
  /** What those invocations cost per capability id, after the rating multipliers. */
  toolCredits: Record<string, number>;
  /** Version of the rating matrix charged with, so a past charge stays reproducible. */
  toolMatrixVersion: string | null;
  toolCallsTotal: number;
  toolCreditsTotal: number;
}

/** One page of results. */
export interface WorkflowPage<T> {
  items: T[];
  /** Pass back as `cursor` to read the next page; absent on the last one. */
  nextCursor?: string;
}

/** A workflow as the catalogue lists it. */
export interface WorkflowSummary {
  key: string;
  name: string;
  description: string | null;
  active: boolean;
  tags: string[];
  /** Label of the published version; `null` when nothing is published. */
  version: string | null;
  /** Hash of the published definition. */
  sha256: string | null;
  publishedAt: string | null;
  /** `true` when this API can run it (the workflow has an active HTTP trigger). */
  runnable: boolean;
}

/** A workflow with the contract a caller needs in order to run it. */
export interface WorkflowDetail extends WorkflowSummary {
  /** What the run input must look like. */
  inputSchema: Record<string, PromptVariable> | null;
  /** What the run output will look like. */
  outputSchema: Record<string, PromptVariable> | null;
}

/** One authored version, metadata only. Definitions are not served by this API. */
export interface WorkflowVersionSummary {
  version: string;
  sha256: string | null;
  published: boolean;
  publishedAt: string | null;
  notes: string | null;
}

/** What a parked run is waiting for. */
export interface WorkflowRunWait {
  stateId: string | null;
  kind: WorkflowWaitKind | null;
  /**
   * `true` when a person has to act.
   *
   * The field worth reading: a run on a `DELAY` resumes by itself, a run on an approval never does
   * until somebody is told. A caller that cannot tell them apart either waits forever or abandons a
   * run that was about to continue.
   */
  human: boolean;
  approval: boolean;
  eventKey: string | null;
  assignmentGroupKey: string | null;
  instructions: string | null;
  since: string | null;
  timeoutAt: string | null;
}

/** One execution of a workflow. */
export interface WorkflowRun {
  runId: string;
  /** Workflow key. */
  workflow: string;
  /** Label of the version that ran. */
  version: string | null;
  status: WorkflowRunStatus;
  trigger: WorkflowTriggerType;
  correlationId: string | null;
  idempotencyKey: string | null;
  test: boolean;
  /** 0..1 as reported by the runner. */
  progress: number;
  transitions: number;
  currentStateId: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  latencyMs: number | null;
  /** The value the definition's `outputSchema` describes, once the run finished successfully. */
  output: unknown;
  error: WorkflowRunError | null;
  summary: string | null;
  /** Set only while the run is `WAITING`. */
  wait: WorkflowRunWait | null;
  usage: WorkflowRunUsage | null;
}

/**
 * One executed transition.
 *
 * Step inputs and outputs are deliberately absent: they are bounded by the tenant's own payload
 * logging policy and can contain anything a state touched. The run output is the declared contract.
 */
export interface WorkflowRunStep {
  sequence: number;
  stateId: string;
  type: string;
  status: WorkflowRunStepStatus;
  attempt: number;
  /** `AGENT`: the iteration this record belongs to. */
  iteration: number | null;
  /** `AGENT`: the tool the planner called. */
  toolId: string | null;
  chosenNext: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  latencyMs: number | null;
  error: WorkflowRunError | null;
  /** Whether a person had to approve before this step ran. */
  approval: boolean;
  evidenceCount: number;
}

/**
 * One evidence item, with the step that produced it and how far it can be trusted.
 *
 * `iteration` and `stateId` are widened from the base shape because the server fills them from the
 * *step's* columns rather than from the item's own optional fields: a step that is not an `AGENT`
 * iteration carries `null`, not "absent".
 */
export interface WorkflowRunEvidence extends Omit<WorkflowEvidence, "iteration" | "stateId"> {
  assurance: WorkflowEvidenceAssurance;
  sequence: number;
  stateId: string;
  iteration: number | null;
  toolId: string | null;
}

/** Everything a run left behind, in one object. */
export interface WorkflowRunReport {
  run: WorkflowRun;
  steps: {
    total: number;
    failed: number;
    byStatus: Record<string, number>;
    timeline: WorkflowRunStep[];
  };
  evidence: WorkflowRunEvidence[];
}

/** One run waiting for a person. */
export interface WorkflowTask {
  runId: string;
  workflow: string;
  stateId: string | null;
  approval: boolean;
  assignmentGroupKey: string | null;
  instructions: string | null;
  since: string | null;
  timeoutAt: string | null;
  overdue: boolean;
  correlationId: string | null;
}

/** Result of validating a definition without saving it. */
export interface WorkflowValidation extends WorkflowValidationResult {
  /** Hash of the tenant registry the intent cross-checks were made against. */
  registrySha256: string | null;
}

/** `POST /run/:key` body. */
export interface RunWorkflowRequest {
  /** The values the definition's `inputSchema` describes. */
  input?: unknown;
  /** Your own identifier for this run; echoed back and filterable. */
  correlationId?: string;
  /** Also accepted as the `Idempotency-Key` header, which the client prefers. */
  idempotencyKey?: string;
  /**
   * Ask the server to hold the response until the run finishes.
   *
   * Capped at {@link DCDR_WORKFLOW_MAX_WAIT_FOR_RESULT_MS}. Past the hold the answer is `202` and
   * the run carries on; use {@link DcdrWorkflowClient.runWorkflowAndWait} when you want to wait
   * longer than the server is willing to hold a connection open.
   */
  waitForResultMs?: number;
}

/** `POST /run/:key` response. */
export interface RunWorkflowResponse {
  runId: string;
  status: WorkflowRunStatus;
  /** `true` when the run finished inside the requested hold, so `run.output` is populated. */
  completed: boolean;
  /** `true` when an earlier run was returned for the same idempotency key. */
  deduplicated: boolean;
  run: WorkflowRun;
}

/** Query of `listWorkflowRuns`. */
export interface ListWorkflowRunsQuery {
  /** Workflow key. */
  workflow?: string;
  status?: WorkflowRunStatus;
  correlationId?: string;
  /** ISO-8601 instant; only runs queued at or after it. */
  since?: string | Date;
  limit?: number;
  cursor?: string;
}

/** Query of `listWorkflowTasks`. */
export interface ListWorkflowTasksQuery {
  /** Restrict to one routing group. */
  groupKey?: string;
  limit?: number;
}

/** What ended a wait. */
export enum WorkflowWaitOutcome {
  /** The run reached a terminal status. */
  FINISHED = "FINISHED",
  /** The run parked on a `WAIT` state and `stopWhenWaiting` was set. */
  WAITING = "WAITING",
  /** The client stopped waiting; the run is still going. */
  TIMED_OUT = "TIMED_OUT",
}

/** Result of `runWorkflowAndWait` / `waitForWorkflowRun`. */
export interface WorkflowRunResult {
  outcome: WorkflowWaitOutcome;
  runId: string;
  status: WorkflowRunStatus;
  /** `true` only for a `FINISHED` run whose status is `COMPLETED` or `COMPLETED_WITH_ERRORS`. */
  succeeded: boolean;
  output: unknown;
  error: WorkflowRunError | null;
  summary: string | null;
  /** The run row as last polled. */
  run: WorkflowRun;
  /** How many times the run was polled. */
  polls: number;
  /** Wall time spent waiting (ms). */
  waitedMs: number;
}

/**
 * Polling policy of `runWorkflowAndWait` / `waitForWorkflowRun`.
 *
 * The delay grows geometrically from `initialDelayMs` to `maxDelayMs`, because a workflow run is not
 * an HTTP call: most finish in seconds, some park for a day, and one fixed interval is either too
 * slow for the first kind or abusive for the second.
 */
export interface WorkflowWaitOptions {
  /** First delay after the run is queued. Default 1000 ms. */
  initialDelayMs?: number;
  /** Ceiling the delay grows to. Default 15000 ms. */
  maxDelayMs?: number;
  /** Growth factor per poll. Default 1.6. */
  backoffFactor?: number;
  /** Give up waiting after this long. Default 900000 ms (15 minutes). The run carries on. */
  timeoutMs?: number;
  /**
   * Stop as soon as the run parks, instead of waiting for a person. Default `true`.
   *
   * A run on an approval gate can sit for days, and a process that keeps polling holds itself open
   * for a decision nobody told it about. Set `false` when the wait is a `DELAY` you expect to pass.
   */
  stopWhenWaiting?: boolean;
  /** Cancels the wait. The run keeps going server-side. */
  signal?: AbortSignal;
  /** Called with every polled run; for progress reporting. */
  onPoll?: (run: WorkflowRun, polls: number) => void;
  /** Injectable clock, for deterministic tests. */
  nowFn?: () => number;
  /** Injectable sleep, for deterministic tests. */
  sleepFn?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/** Configuration of {@link DcdrWorkflowClient}. */
export interface DcdrWorkflowClientConfig {
  /**
   * Control-plane origin, e.g. `https://dcdr.ai`.
   *
   * This is **not** the runtime gateway URL used by `DcdrRuntimeClient`.
   */
  baseUrl?: string;
  /**
   * Managed service token, sent as `Authorization: Bearer`.
   *
   * Needs {@link DcdrServiceTokenScope.WORKFLOWS_READ} to read and
   * {@link DcdrServiceTokenScope.WORKFLOWS_RUN} to run, cancel or resume.
   */
  bearerToken: string;
  /** Per-request timeout; defaults to 15 seconds. This bounds one HTTP call, never a run. */
  timeoutMs?: number;
  /** Extra headers sent on every request. */
  extraHeaders?: Record<string, string>;
  /** Optional `fetch` implementation (tests, proxies, non-standard runtimes). */
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;
}

/** Route builder of the tenant workflow API, relative to the control-plane origin. */
export interface DcdrWorkflowRoutes {
  workflows(): string;
  workflow(key: string): string;
  versions(key: string): string;
  run(key: string): string;
  validate(): string;
  runs(): string;
  runById(runId: string): string;
  runCancel(runId: string): string;
  runResume(runId: string): string;
  runSteps(runId: string): string;
  runEvidence(runId: string): string;
  runReport(runId: string): string;
  tasks(): string;
}

/** Internal request description. */
interface WorkflowRequestArgs {
  method: "GET" | "POST";
  path: string;
  body?: object;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** Outcome of a raw request, before it is narrowed to a typed response. */
interface WorkflowRawResponse {
  status: number;
  text: string;
  isJson: boolean;
}

/**
 * Error thrown by every {@link DcdrWorkflowClient} method.
 *
 * Carries the server's own error code when there was one, so callers branch on
 * {@link DcdrWorkflowErrorCode} rather than on an HTTP status or a message string.
 */
export class DcdrWorkflowError extends Error {
  /** Stable failure code. */
  readonly code: DcdrWorkflowErrorCode;
  /** HTTP status, or `null` for a client-side failure (timeout, abort, transport, config). */
  readonly status: number | null;
  readonly method: string;
  readonly path: string;
  /** Structured validation issues the server sent, when any. */
  readonly details: unknown;
  /** Bounded preview of the response body. */
  readonly bodyPreview: string | null;
  /** Parsed counters of a `LIMIT_REACHED` failure. */
  readonly limit: DcdrWorkflowLimitDetails | null;

  /**
   * @param args Everything known about the failure where it was detected.
   */
  constructor(args: {
    code: DcdrWorkflowErrorCode;
    message: string;
    method: string;
    path: string;
    status?: number | null;
    details?: unknown;
    bodyPreview?: string | null;
    limit?: DcdrWorkflowLimitDetails | null;
  }) {
    super(args.message);
    this.name = "DcdrWorkflowError";
    this.code = args.code;
    this.status = args.status ?? null;
    this.method = args.method;
    this.path = args.path;
    this.details = args.details ?? null;
    this.bodyPreview = args.bodyPreview ?? null;
    this.limit = args.limit ?? null;
  }
}

/**
 * Narrows an unknown thrown value to a {@link DcdrWorkflowError}.
 *
 * @param value Thrown value.
 * @returns `true` when it carries a {@link DcdrWorkflowErrorCode}.
 */
export function isDcdrWorkflowError(value: unknown): value is DcdrWorkflowError {
  return value instanceof DcdrWorkflowError;
}

/**
 * Whether a run status is terminal.
 *
 * @param status Status to check.
 * @returns `true` when nothing can change the run any more.
 */
export function isWorkflowRunTerminal(status: WorkflowRunStatus | null | undefined): boolean {
  return !!status && WORKFLOW_RUN_TERMINAL_STATUSES.includes(status);
}

/**
 * Whether a run reached an `END` state without the run failing.
 *
 * `COMPLETED_WITH_ERRORS` counts as success on purpose: the workflow finished, having applied an
 * error policy along the way. Compare against `WorkflowRunStatus.COMPLETED` for the strict reading.
 *
 * @param status Status to check.
 * @returns `true` for `COMPLETED` and `COMPLETED_WITH_ERRORS`.
 */
export function isWorkflowRunSuccessful(status: WorkflowRunStatus | null | undefined): boolean {
  return !!status && WORKFLOW_RUN_SUCCESS_STATUSES.includes(status);
}

/**
 * Builds the API paths from the mount base path.
 *
 * Exposed so a proxy or a test can address the same endpoints without hard-coding strings.
 *
 * @param basePath Mount path; defaults to {@link DCDR_WORKFLOW_API_BASE_PATH}.
 * @returns Route builder.
 */
export function buildDcdrWorkflowRoutes(basePath: string = DCDR_WORKFLOW_API_BASE_PATH): DcdrWorkflowRoutes {
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const key = (value: string): string => encodeURIComponent(String(value ?? "").trim().toUpperCase());
  const run = (runId: string): string => `${base}/runs/${encodeURIComponent(runId)}`;

  return {
    workflows: () => base,
    workflow: (value) => `${base}/${key(value)}`,
    versions: (value) => `${base}/${key(value)}/versions`,
    run: (value) => `${base}/run/${key(value)}`,
    validate: () => `${base}/validate`,
    runs: () => `${base}/runs`,
    runById: (runId) => run(runId),
    runCancel: (runId) => `${run(runId)}/cancel`,
    runResume: (runId) => `${run(runId)}/resume`,
    runSteps: (runId) => `${run(runId)}/steps`,
    runEvidence: (runId) => `${run(runId)}/evidence`,
    runReport: (runId) => `${run(runId)}/report`,
    tasks: () => `${base}/tasks`,
  };
}

/**
 * Typed HTTP client of the tenant workflow API.
 *
 * @example
 * ```ts
 * const workflows = new DcdrWorkflowClient({
 *   baseUrl: "https://dcdr.ai",
 *   bearerToken: process.env.DCDR_SERVICE_TOKEN,
 * });
 *
 * // What can I run, and what does it take?
 * const catalogue = await workflows.listWorkflows();
 * const detail = await workflows.getWorkflow("SUPPORT_TRIAGE");
 * console.log(detail.inputSchema);
 *
 * // Run it and wait.
 * const result = await workflows.runWorkflowAndWait("SUPPORT_TRIAGE", {
 *   input: { ticketId: "T-4821" },
 *   correlationId: "T-4821",
 * });
 * ```
 *
 * @public
 */
export class DcdrWorkflowClient {
  private readonly baseUrl: string;
  private readonly bearerToken: string;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;
  private readonly fetchFn: (input: string, init?: RequestInit) => Promise<Response>;

  /** Path builder of the endpoints this client calls. */
  readonly routes: DcdrWorkflowRoutes;

  /**
   * Creates a client.
   *
   * @param cfg Client configuration.
   * @throws {@link DcdrWorkflowError} `CONFIGURATION` when the base URL or token is blank, or no
   * `fetch` implementation is reachable.
   */
  constructor(cfg: DcdrWorkflowClientConfig) {
    const base = String(cfg?.baseUrl ?? DCDR_WORKFLOW_DEFAULT_BASE_URL).trim();
    if (!base) throw configurationError("DcdrWorkflowClient requires baseUrl (or omit it for the DCDR control plane)");
    this.baseUrl = base.endsWith("/") ? base.slice(0, -1) : base;

    const token = String(cfg?.bearerToken ?? "").trim();
    if (!token) {
      throw configurationError(
        `DcdrWorkflowClient requires bearerToken: a service token carrying ${DcdrServiceTokenScope.WORKFLOWS_READ} and/or ${DcdrServiceTokenScope.WORKFLOWS_RUN}`,
      );
    }
    this.bearerToken = token;

    this.timeoutMs = typeof cfg?.timeoutMs === "number" && cfg.timeoutMs > 0 ? cfg.timeoutMs : DCDR_WORKFLOW_DEFAULT_TIMEOUT_MS;
    this.extraHeaders = cfg?.extraHeaders ? { ...cfg.extraHeaders } : {};

    const resolvedFetch = cfg?.fetchFn ?? (globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined);
    if (!resolvedFetch) throw configurationError("DcdrWorkflowClient requires a fetch implementation (global fetch missing)");
    this.fetchFn = resolvedFetch;

    this.routes = buildDcdrWorkflowRoutes();
  }

  // ------------------------------------------------------------------ catalogue

  /**
   * Calls `GET /api/dcdr/workflows`: what this tenant has, and which of them this API can run.
   *
   * @param options Page size.
   * @returns The catalogue page.
   */
  async listWorkflows(options?: { limit?: number }): Promise<WorkflowPage<WorkflowSummary>> {
    return this.requestJson({ method: "GET", path: `${this.routes.workflows()}${buildQuery({ limit: options?.limit })}` });
  }

  /**
   * Calls `GET /api/dcdr/workflows/:key`.
   *
   * Returns the run contract - `inputSchema` and `outputSchema` - and not the definition. The
   * definition names the tenant's own intents, connections and allowed hosts, which is a description
   * of their infrastructure rather than of this workflow's interface.
   *
   * @param key Workflow key.
   * @returns The workflow and its input/output schemas.
   */
  async getWorkflow(key: string): Promise<WorkflowDetail> {
    return this.requestJson({ method: "GET", path: this.routes.workflow(key) });
  }

  /**
   * Calls `GET /api/dcdr/workflows/:key/versions`.
   *
   * @param key Workflow key.
   * @param options Page size.
   * @returns The versions, newest first, metadata only.
   */
  async listWorkflowVersions(key: string, options?: { limit?: number }): Promise<WorkflowPage<WorkflowVersionSummary>> {
    return this.requestJson({ method: "GET", path: `${this.routes.versions(key)}${buildQuery({ limit: options?.limit })}` });
  }

  /**
   * Calls `POST /api/dcdr/workflows/validate`.
   *
   * Checks a definition against the tenant's intents, connections and caps. **Persists nothing**,
   * which is what makes it safe on a read scope and useful in CI: "does this definition still
   * compile against our registry?"
   *
   * Run `validateWorkflowDefinition` from this package first. It needs no network and catches
   * everything structural, so the free failures stay free.
   *
   * @param definition Definition to check.
   * @returns Issues addressed by path, plus the registry hash they were checked against.
   */
  async validateWorkflow(definition: WorkflowDefinition): Promise<WorkflowValidation> {
    return this.requestJson({ method: "POST", path: this.routes.validate(), body: { definition } });
  }

  // ------------------------------------------------------------------ running

  /**
   * Calls `POST /api/dcdr/workflows/run/:key` and returns as soon as the run is queued.
   *
   * The workflow must have an active HTTP trigger: that is how a tenant says "this one may be called
   * from outside". A workflow without one answers `NOT_FOUND` on its trigger rather than running.
   *
   * **Send an idempotency key.** It is what makes a retry safe - a redelivered webhook opens one run,
   * and the second call comes back with the first one and `deduplicated: true`.
   *
   * @param key Workflow key.
   * @param request Input, correlation, idempotency and the optional server-side hold.
   * @param options Idempotency key (preferred over the body field) and cancellation.
   * @returns The queued or finished run.
   */
  async runWorkflow(
    key: string,
    request?: RunWorkflowRequest,
    options?: { idempotencyKey?: string; signal?: AbortSignal },
  ): Promise<RunWorkflowResponse> {
    const headers: Record<string, string> = {};
    const idempotencyKey = normalize(options?.idempotencyKey) ?? normalize(request?.idempotencyKey);
    if (idempotencyKey) headers[DCDR_WORKFLOW_IDEMPOTENCY_KEY_HEADER] = idempotencyKey;

    return this.requestJson({
      method: "POST",
      path: this.routes.run(key),
      body: request ?? {},
      headers,
      signal: options?.signal,
    });
  }

  /**
   * Starts a run and polls it until it finishes, parks, or the caller's patience runs out.
   *
   * This is what most integrations want: one call in, one result out. It is built on the two public
   * endpoints rather than on a synchronous run endpoint because a workflow run has no bounded
   * duration - the caller decides how long *it* waits, and the run carries on regardless.
   *
   * @param key Workflow key.
   * @param request Run input.
   * @param options Polling policy.
   * @returns The run result, whatever ended the wait.
   */
  async runWorkflowAndWait(key: string, request?: RunWorkflowRequest, options?: WorkflowWaitOptions): Promise<WorkflowRunResult> {
    const started = await this.runWorkflow(key, request);
    // The server may already have caught the end inside its own hold; no reason to poll then.
    if (started.completed && isWorkflowRunTerminal(started.run.status)) {
      return buildRunResult(WorkflowWaitOutcome.FINISHED, started.run, 0, 0);
    }
    return this.waitForWorkflowRun(started.runId, options);
  }

  /**
   * Polls an existing run until it finishes, parks, or the wait times out.
   *
   * @param runId Run id.
   * @param options Polling policy.
   * @returns The run result.
   * @throws {@link DcdrWorkflowError} `CANCELLED` when `options.signal` aborts.
   */
  async waitForWorkflowRun(runId: string, options?: WorkflowWaitOptions): Promise<WorkflowRunResult> {
    const now = options?.nowFn ?? (() => Date.now());
    const sleep = options?.sleepFn ?? defaultSleep;
    const maxDelayMs = positiveOr(options?.maxDelayMs, 15_000);
    const backoffFactor = options?.backoffFactor && options.backoffFactor > 1 ? options.backoffFactor : 1.6;
    const timeoutMs = positiveOr(options?.timeoutMs, 900_000);
    const stopWhenWaiting = options?.stopWhenWaiting !== false;

    const startedAt = now();
    let delayMs = positiveOr(options?.initialDelayMs, 1_000);
    let polls = 0;

    // Polled first, slept after: a run that finished while the request was in flight costs nothing.
    for (;;) {
      if (options?.signal?.aborted) {
        throw new DcdrWorkflowError({
          code: DcdrWorkflowErrorCode.CANCELLED,
          message: `Waiting for run ${runId} was cancelled by the caller.`,
          method: "GET",
          path: this.routes.runById(runId),
        });
      }

      const run = await this.getWorkflowRun(runId);
      polls += 1;
      options?.onPoll?.(run, polls);

      const elapsedMs = now() - startedAt;
      if (isWorkflowRunTerminal(run.status)) return buildRunResult(WorkflowWaitOutcome.FINISHED, run, polls, elapsedMs);
      if (stopWhenWaiting && run.status === WorkflowRunStatus.WAITING) return buildRunResult(WorkflowWaitOutcome.WAITING, run, polls, elapsedMs);
      if (elapsedMs >= timeoutMs) return buildRunResult(WorkflowWaitOutcome.TIMED_OUT, run, polls, elapsedMs);

      // Never sleep past the deadline: the last poll lands on it, not after it.
      await sleep(Math.min(delayMs, timeoutMs - elapsedMs), options?.signal);
      delayMs = Math.min(Math.round(delayMs * backoffFactor), maxDelayMs);
    }
  }

  // ------------------------------------------------------------------ runs

  /**
   * Calls `GET /api/dcdr/workflows/runs`.
   *
   * Keyset-paged, newest first: pass the `nextCursor` of one page as the `cursor` of the next. Runs
   * are an append-only table, and offset paging over one that grows while you read it skips rows.
   *
   * @param query Filters and paging.
   * @returns The run page.
   */
  async listWorkflowRuns(query?: ListWorkflowRunsQuery): Promise<WorkflowPage<WorkflowRun>> {
    const since = query?.since instanceof Date ? query.since.toISOString() : query?.since;
    const search = buildQuery({
      workflow: query?.workflow,
      status: query?.status,
      correlationId: query?.correlationId,
      since,
      limit: query?.limit,
      cursor: query?.cursor,
    });
    return this.requestJson({ method: "GET", path: `${this.routes.runs()}${search}` });
  }

  /**
   * Calls `GET /api/dcdr/workflows/runs/:runId`.
   *
   * @param runId Run id.
   * @returns The run.
   */
  async getWorkflowRun(runId: string): Promise<WorkflowRun> {
    return this.requestJson({ method: "GET", path: this.routes.runById(runId) });
  }

  /**
   * Calls `POST /api/dcdr/workflows/runs/:runId/cancel`.
   *
   * Cancellation is cooperative: the flag is raised and the runner stops at its next checkpoint, so
   * the run you get back is usually still `RUNNING`. Poll it if you need to know when it stopped.
   *
   * @param runId Run id.
   * @returns The run as it stands after the request.
   */
  async cancelWorkflowRun(runId: string): Promise<WorkflowRun> {
    return this.requestJson({ method: "POST", path: this.routes.runCancel(runId) });
  }

  /**
   * Calls `POST /api/dcdr/workflows/runs/:runId/resume`.
   *
   * Only `WAITING` runs can be resumed. The payload is validated server-side against whatever the
   * run is parked on: the fixed `{ approved, comment? }` form for an approval gate, the state's own
   * `form` for a `HUMAN_TASK`, and the awaited `eventKey` for an `EXTERNAL_EVENT`. `run.wait` says
   * which of the three it is.
   *
   * @param runId Run id.
   * @param payload The answer.
   * @returns The re-queued run.
   */
  async resumeWorkflowRun(runId: string, payload: unknown): Promise<WorkflowRun> {
    return this.requestJson({ method: "POST", path: this.routes.runResume(runId), body: { payload } });
  }

  /**
   * Calls `GET /api/dcdr/workflows/runs/:runId/steps`.
   *
   * @param runId Run id.
   * @returns Executed transitions, ordered by sequence.
   */
  async listWorkflowRunSteps(runId: string): Promise<WorkflowPage<WorkflowRunStep>> {
    return this.requestJson({ method: "GET", path: this.routes.runSteps(runId) });
  }

  /**
   * Calls `GET /api/dcdr/workflows/runs/:runId/evidence`.
   *
   * @param runId Run id.
   * @returns Every evidence item of the run, each with its assurance level and its step.
   */
  async listWorkflowRunEvidence(runId: string): Promise<WorkflowPage<WorkflowRunEvidence>> {
    return this.requestJson({ method: "GET", path: this.routes.runEvidence(runId) });
  }

  /**
   * Calls `GET /api/dcdr/workflows/runs/:runId/report`.
   *
   * The one to reach for when you want a single object: the run, the step timeline with counts by
   * status, which steps a person had to approve, and the flattened evidence.
   *
   * @param runId Run id.
   * @returns The report.
   */
  async getWorkflowRunReport(runId: string): Promise<WorkflowRunReport> {
    return this.requestJson({ method: "GET", path: this.routes.runReport(runId) });
  }

  /**
   * Calls `GET /api/dcdr/workflows/tasks`.
   *
   * The runs parked on a person - an approval gate or a `HUMAN_TASK` wait. A run sitting on a delay
   * or an external event is not somebody's task and is not listed.
   *
   * @param query Group filter and page size.
   * @returns The task page.
   */
  async listWorkflowTasks(query?: ListWorkflowTasksQuery): Promise<WorkflowPage<WorkflowTask>> {
    return this.requestJson({ method: "GET", path: `${this.routes.tasks()}${buildQuery({ groupKey: query?.groupKey, limit: query?.limit })}` });
  }

  // ------------------------------------------------------------------ transport

  /**
   * Performs one request and parses the JSON body.
   *
   * @param args Request description.
   * @returns The parsed body.
   * @throws {@link DcdrWorkflowError} on any non-2xx answer or unreadable body.
   */
  private async requestJson<T>(args: WorkflowRequestArgs): Promise<T> {
    const raw = await this.request(args);
    if (!raw.text) return JSON.parse("{}") as T;

    if (!raw.isJson) {
      throw new DcdrWorkflowError({
        code: DcdrWorkflowErrorCode.UNEXPECTED_RESPONSE,
        message: `DcdrWorkflowClient expected JSON: ${args.method} ${args.path} status=${raw.status}`,
        method: args.method,
        path: args.path,
        status: raw.status,
        bodyPreview: previewBody(raw.text),
      });
    }

    try {
      return JSON.parse(raw.text) as T;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new DcdrWorkflowError({
        code: DcdrWorkflowErrorCode.UNEXPECTED_RESPONSE,
        message: `DcdrWorkflowClient could not parse the JSON body: ${args.method} ${args.path} status=${raw.status} (${detail})`,
        method: args.method,
        path: args.path,
        status: raw.status,
        bodyPreview: previewBody(raw.text),
      });
    }
  }

  /**
   * Performs one HTTP request with auth, a timeout and typed error mapping.
   *
   * @param args Request description.
   * @returns Status, body text and whether the body claims to be JSON.
   * @throws {@link DcdrWorkflowError} for every failure, transport ones included.
   */
  private async request(args: WorkflowRequestArgs): Promise<WorkflowRawResponse> {
    const url = `${this.baseUrl}${args.path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.extraHeaders,
      ...(args.headers ?? {}),
      Authorization: `Bearer ${this.bearerToken}`,
    };

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    const onAbort = (): void => controller.abort();
    if (args.signal) {
      if (args.signal.aborted) controller.abort();
      else args.signal.addEventListener("abort", onAbort);
    }

    try {
      let response: Response;
      try {
        response = await this.fetchFn(url, {
          method: args.method,
          headers,
          body: args.body ? JSON.stringify(args.body) : undefined,
          signal: controller.signal,
        });
      } catch (e) {
        // An aborted fetch and a dead socket both land here; only the flags say which.
        if (timedOut) {
          throw new DcdrWorkflowError({
            code: DcdrWorkflowErrorCode.TIMEOUT,
            message: `DcdrWorkflowClient request timed out after ${this.timeoutMs}ms: ${args.method} ${args.path}`,
            method: args.method,
            path: args.path,
          });
        }
        if (args.signal?.aborted) {
          throw new DcdrWorkflowError({
            code: DcdrWorkflowErrorCode.CANCELLED,
            message: `DcdrWorkflowClient request was cancelled by the caller: ${args.method} ${args.path}`,
            method: args.method,
            path: args.path,
          });
        }
        const detail = e instanceof Error ? e.message : String(e);
        throw new DcdrWorkflowError({
          code: DcdrWorkflowErrorCode.NETWORK,
          message: `DcdrWorkflowClient request failed before a response: ${args.method} ${args.path} (${detail})`,
          method: args.method,
          path: args.path,
        });
      }

      const text = await response.text();
      const isJson = /application\/json/i.test(response.headers.get("content-type") ?? "");
      if (!response.ok) throw buildHttpError({ method: args.method, path: args.path, status: response.status, text, isJson });
      return { status: response.status, text, isJson };
    } finally {
      clearTimeout(timeout);
      if (args.signal) args.signal.removeEventListener("abort", onAbort);
    }
  }
}

/**
 * Builds the typed error of a non-2xx answer.
 *
 * @param args Method, path, status and raw body.
 * @returns The error to throw.
 */
function buildHttpError(args: { method: string; path: string; status: number; text: string; isJson: boolean }): DcdrWorkflowError {
  const body = args.isJson ? safeParseObject(args.text) : null;
  const serverCode = typeof body?.code === "string" ? body.code : null;
  const serverMessage = typeof body?.message === "string" ? body.message : null;

  if (serverCode === "DCDR_LIMIT_REACHED") {
    const limit: DcdrWorkflowLimitDetails = {
      limitKey: String(body?.limitKey ?? "unknown"),
      current: Number(body?.current ?? 0),
      max: Number(body?.max ?? 0),
      tier: typeof body?.tier === "string" ? body.tier : undefined,
    };
    return new DcdrWorkflowError({
      code: DcdrWorkflowErrorCode.LIMIT_REACHED,
      message: `DcdrWorkflowClient request refused: ${args.method} ${args.path} status=${args.status} limit=${limit.limitKey} ${limit.current}/${limit.max}`,
      method: args.method,
      path: args.path,
      status: args.status,
      details: body,
      bodyPreview: previewBody(args.text),
      limit,
    });
  }

  const code = mapErrorCode(serverCode, args.status);
  const tail = serverMessage ? ` ${serverMessage}` : ` body=${previewBody(args.text)}`;
  return new DcdrWorkflowError({
    code,
    message: `DcdrWorkflowClient request failed: ${args.method} ${args.path} status=${args.status} code=${code}${tail}`,
    method: args.method,
    path: args.path,
    status: args.status,
    details: body?.details ?? null,
    bodyPreview: previewBody(args.text),
  });
}

/**
 * Maps a server error code, or an HTTP status when there was none, to the client vocabulary.
 *
 * The server code wins: `INVALID_STATE` and `LIMIT_REACHED` both arrive as `409`, and a caller that
 * must tell "already finished" from "out of runs today" cannot do it from the status.
 *
 * @param serverCode `code` field of the error body, when present.
 * @param status HTTP status.
 * @returns The client error code.
 */
function mapErrorCode(serverCode: string | null, status: number): DcdrWorkflowErrorCode {
  const known = (Object.values(DcdrWorkflowErrorCode) as string[]).includes(String(serverCode));
  if (serverCode && known) return serverCode as DcdrWorkflowErrorCode;

  if (status === 401) return DcdrWorkflowErrorCode.UNAUTHORIZED;
  if (status === 403) return DcdrWorkflowErrorCode.FORBIDDEN;
  if (status === 404) return DcdrWorkflowErrorCode.NOT_FOUND;
  if (status === 400 || status === 422) return DcdrWorkflowErrorCode.VALIDATION;
  if (status === 409) return DcdrWorkflowErrorCode.CONFLICT;
  if (status === 429) return DcdrWorkflowErrorCode.RATE_LIMITED;
  if (status === 503) return DcdrWorkflowErrorCode.DISABLED;
  if (status >= 500) return DcdrWorkflowErrorCode.SERVER_ERROR;
  return DcdrWorkflowErrorCode.UNEXPECTED_RESPONSE;
}

/**
 * Builds a `CONFIGURATION` error, thrown before anything reaches the network.
 *
 * @param message What is missing.
 * @returns The error to throw.
 */
function configurationError(message: string): DcdrWorkflowError {
  return new DcdrWorkflowError({ code: DcdrWorkflowErrorCode.CONFIGURATION, message, method: "-", path: "-" });
}

/**
 * Builds a query string, skipping absent values.
 *
 * @param params Parameter map.
 * @returns A `?a=b&c=d` string, or an empty string.
 */
function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/**
 * Parses a JSON object body without throwing.
 *
 * @param text Body text.
 * @returns The parsed object, or `null` when it is not one.
 */
function safeParseObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Assembles the public wait result from a polled run.
 *
 * @param outcome What ended the wait.
 * @param run Run as last polled.
 * @param polls Number of polls performed.
 * @param waitedMs Wall time spent waiting.
 * @returns The wait result.
 */
function buildRunResult(outcome: WorkflowWaitOutcome, run: WorkflowRun, polls: number, waitedMs: number): WorkflowRunResult {
  return {
    outcome,
    runId: run.runId,
    status: run.status,
    succeeded: outcome === WorkflowWaitOutcome.FINISHED && isWorkflowRunSuccessful(run.status),
    output: run.output ?? null,
    error: run.error ?? null,
    summary: run.summary ?? null,
    run,
    polls,
    waitedMs,
  };
}

/**
 * Default sleep between polls; resolves early when the caller's signal aborts.
 *
 * The wait is abandoned, not failed: the loop checks the signal on its next turn and throws there,
 * so cancellation has exactly one place that decides what it means.
 *
 * @param ms Delay.
 * @param signal Optional cancellation.
 */
function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (ms <= 0) {
      resolve();
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort);
    }
  });
}

/**
 * Returns a positive number or the fallback.
 *
 * @param value Candidate.
 * @param fallback Used when the candidate is absent or not positive.
 * @returns The resolved number.
 */
function positiveOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Trims a string and collapses an empty one to `undefined`.
 *
 * @param value Raw value.
 * @returns The trimmed value, or `undefined`.
 */
function normalize(value: string | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

/**
 * Builds a bounded, single-line body preview for an error message.
 *
 * @param text Full body text.
 * @returns Preview capped at {@link ERROR_BODY_PREVIEW_MAX_CHARS}.
 */
function previewBody(text: string): string {
  const compact = String(text ?? "").replace(/\s+/g, " ").trim();
  return compact.length > ERROR_BODY_PREVIEW_MAX_CHARS ? `${compact.slice(0, ERROR_BODY_PREVIEW_MAX_CHARS)}…` : compact;
}

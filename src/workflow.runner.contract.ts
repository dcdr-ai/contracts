import { HttpRequestParams } from "./http.contract";
import {
  WorkflowDefinition,
  WorkflowStateError,
  WorkflowStateSnapshot,
  WorkflowAgentTraceEntry,
  WorkflowEvidence,
  WorkflowStateType,
  WorkflowValueLimits,
  WorkflowWaitKind,
} from "./workflow.contract";

/**
 * Workflow runner protocol: the HTTP contract between the control plane (backend
 * `/api/workflows/*`) and a workflow runner worker (`dcdr-workflow-runner`).
 *
 * Internal surface
 * - Customers never call these endpoints; the shapes are published with `@dcdr/contracts` only so
 *   both sides share one definition.
 *
 * Shape of the protocol
 * - A worker polls for the next run, fetches its configuration and input, reports
 *   progress/logs/checkpoints, and posts a final output. Plain HTTP + JSON authenticated with a
 *   token header.
 *
 * Boundary note
 * - Run inputs, state outputs, evidence and resume payloads are untrusted JSON (`unknown`); hosts
 *   bound and redact them according to `WorkflowRunnerPayloadLogging`.
 */

/** Mount path of the runner protocol router on the backend. */
export const WORKFLOW_RUNNER_BASE_PATH = "/api/workflows";

/** Sentinel `id` returned by `next` when the runner must exit (version roll-out). */
export const WORKFLOW_RUNNER_TERMINATE_ID = "TERMINATE";

/** Header carrying the collection token on every runner request. */
export const WORKFLOW_RUNNER_TOKEN_HEADER = "token";

/** Capabilities a runner advertises in `next` (values are free-form strings, e.g. a version). */
export enum WorkflowRunnerCapability {
  /** Marks the agent as a workflow runner; the backend only hands `WorkflowRun`s to agents that set it. */
  WORKFLOW_RUNNER = "WORKFLOW_RUNNER",
  /** Runner build/version, compared with the backend setting that drives `TERMINATE` roll-outs. */
  WORKFLOW_RUNNER_VERSION = "WORKFLOW_RUNNER_VERSION",
  /** Engine (`@dcdr/contracts`) version the runner embeds. */
  WORKFLOW_ENGINE_VERSION = "WORKFLOW_ENGINE_VERSION",
  /** Runtime technology marker shared with the job-agent capability model. */
  TECHNOLOGY_JS = "TECHNOLOGY_JS",
}

/** How much of state inputs/outputs the runner may send in checkpoints and logs. */
export enum WorkflowRunnerPayloadLogging {
  /** Sizes and hashes only. */
  NONE = "NONE",
  /** Bounded previews plus sizes/hashes (default). */
  METADATA = "METADATA",
  /** Full payloads up to `maxStepPayloadBytes`. */
  FULL = "FULL",
}

/** Log levels accepted by `log`. */
export enum WorkflowRunnerLogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
}

/** Kinds of files a runner can attach to a run. */
export enum WorkflowRunnerLogFileType {
  /** Plain-text runner log. */
  RUN_LOG = "RUN_LOG",
  /** Arbitrary evidence produced by a state (HTTP response dump, generated document...). */
  ARTIFACT = "ARTIFACT",
}

/** Status of one step record posted in a checkpoint. */
export enum WorkflowRunnerStepStatus {
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  WAITING = "WAITING",
  CANCELLED = "CANCELLED",
}

/** Final status a runner posts for a run. */
export enum WorkflowRunOutputStatus {
  COMPLETED = "COMPLETED",
  ERROR = "ERROR",
  TIMEOUT = "TIMEOUT",
  CANCELED = "CANCELED",
  /** The run is parked on a `WAIT` state; the backend resumes it later by re-queuing. */
  WAITING = "WAITING",
}

/** `POST /api/workflows/next` body. */
export interface WorkflowRunnerNextRequest {
  /** Stable runner identity (in Swarm, the service/slot template), reused across restarts. */
  server: string;
  /** Capability map; must include `WORKFLOW_RUNNER`. */
  capabilities: Record<string, string>;
  /** Process start time (epoch ms), informational. */
  upSince?: number;
}

/** `POST /api/workflows/next` response: a run id, `null` when idle, or the `TERMINATE` sentinel. */
export interface WorkflowRunnerNextResponse {
  id: string | null;
}

/** Runner-side knobs the backend may push per run. */
export interface WorkflowRunnerSettings {
  /** Poll interval to use while idle (ms). */
  pollMs?: number;
  /** Exit the process after finishing this run (disposable sandbox mode). */
  exitAfterRun?: boolean;
  /** Interval between `is_canceled` polls (ms). */
  cancelPollMs?: number;
}

/** Bounds the runner must enforce while executing. */
export interface WorkflowRunnerLimits {
  maxTransitionsPerRun: number;
  payloadLogging: WorkflowRunnerPayloadLogging;
  /** Maximum bytes of a state input/output kept in a checkpoint or log (larger values are truncated with a marker). */
  maxStepPayloadBytes: number;
  /** Per-state default timeout when the definition declares none (ms). */
  defaultStateTimeoutMs: number;
  /** Value-tree limits for mapping resolution. */
  valueLimits?: WorkflowValueLimits;
}

/** `GET /api/workflows/:runId/configuration` response. */
export interface WorkflowRunnerConfigurationResponse {
  runId: string;
  /** Absolute deadline of the run (ISO-8601). */
  deadlineAt: string;
  /** Whole-run timeout (ms), informational alongside `deadlineAt`. */
  timeoutMs: number;
  limits: WorkflowRunnerLimits;
  runnerSettings?: WorkflowRunnerSettings;
  /** Whether the runner may post log entries/files for this run. */
  allowLogs: boolean;
  /** Minimum level of log entries the backend keeps. */
  logLevel: WorkflowRunnerLogLevel;
}

/** Requester of a run, exposed to references as `run.requester.*`. */
export interface WorkflowRunnerRequester {
  /** Internal user id when launched from the tenant UI. */
  userId?: string;
  /** External subject when launched from an embed/App token or an HTTP trigger. */
  externalId?: string;
  email?: string;
  name?: string;
}

/** Run metadata handed with the input. */
export interface WorkflowRunnerRunDescriptor {
  id: string;
  /** Dispatch attempt (1 on first dispatch, incremented on requeue). */
  attempt: number;
  deadlineAt: string;
  startedAt?: string;
  correlationId?: string;
  requester?: WorkflowRunnerRequester;
}

/** Workflow identity handed with the input. */
export interface WorkflowRunnerWorkflowDescriptor {
  id: string;
  key: string;
  /** User-facing version label of the published version (masked text, e.g. `1.4.0`). */
  version: string;
  /** `computeWorkflowDefinitionSha256` of `definition`. */
  sha256: string;
  /** Tenant registry sha the run executes against (traceability). */
  registrySha256?: string;
}

/** Connection descriptor without secrets; the runner fetches secrets per run through `connection`. */
export interface WorkflowRunnerConnectionDescriptor {
  key: string;
  baseUrl: string;
  timeoutMs: number;
  maxResponseBytes: number;
  /** Hosts the egress guard accepts for this connection (base URL host by default). */
  allowedHosts: string[];
  /** Allow plain `http://` (self-hosted only). */
  allowInsecure?: boolean;
}

/** Where a resumed run continues from (rebuilt by the backend from the stored checkpoints). */
export interface WorkflowRunnerResumeState {
  /** State to execute next. */
  currentStateId: string;
  /** Transitions already consumed by previous dispatches. */
  transitions: number;
  /** Latest snapshot per executed state (what `states.<id>` references see). */
  states: Record<string, WorkflowStateSnapshot>;
  /** `WAIT` state that parked the run, when resuming from a wait. */
  waitStateId?: string;
  /** Payload delivered on resume (human-task form, external event body); becomes the wait state output. */
  resumePayload?: unknown;
  /** Next step sequence number to use. */
  nextSequence: number;
}

/** `GET /api/workflows/:runId/input` response. */
export interface WorkflowRunnerInputResponse {
  run: WorkflowRunnerRunDescriptor;
  workflow: WorkflowRunnerWorkflowDescriptor;
  definition: WorkflowDefinition;
  /** Validated run input (asset variables as references, never blobs). */
  input: Record<string, unknown>;
  connections: WorkflowRunnerConnectionDescriptor[];
  /** Present when the run continues after a requeue or a resumed `WAIT`. */
  resume?: WorkflowRunnerResumeState;
}

/** `GET /api/workflows/:runId/connection/:key` response: secrets resolved for this run only. */
export interface WorkflowRunnerConnectionSecretsResponse extends HttpRequestParams {
  key: string;
  /** When the runner must discard the secrets (ISO-8601). */
  expiresAt?: string;
}

/** `GET /api/workflows/:runId/ai/:intent` response: how to call the DCDR runtime for one intent. */
export interface WorkflowRunnerAiExecutionPlanResponse {
  /** Runtime base URL (the runner appends `/api/execution/run/:intent` through `DcdrRuntimeClient`). */
  baseUrl: string;
  intent: string;
  /** Customer-mode `DcdrSessionToken` scoped to the intents the published version uses. */
  sessionToken: string;
  /** Extra headers required to reach the runtime (e.g. access-gateway headers). */
  headers?: Record<string, string>;
  timeoutMs: number;
  /** When the session expires (ISO-8601); the runner refreshes the plan after that. */
  expiresAt: string;
}

/** `GET /api/workflows/:runId/is_canceled` response. */
export interface WorkflowRunnerCanceledResponse {
  canceled: boolean;
}

/** `POST /api/workflows/:runId/progress` body. */
export interface WorkflowRunnerProgressRequest {
  /** 0..1 */
  progress: number;
  currentStateId?: string;
  transitions?: number;
}

/** One log line. */
export interface WorkflowRunnerLogEntry {
  level: WorkflowRunnerLogLevel;
  message: string;
  /** ISO-8601 */
  at: string;
  stateId?: string;
  data?: Record<string, unknown>;
}

/** `POST /api/workflows/:runId/log` body. */
export interface WorkflowRunnerLogRequest {
  entries: WorkflowRunnerLogEntry[];
}

/** `POST /api/workflows/:runId/logs/:type/url` body: ask for an upload URL for a file. */
export interface WorkflowRunnerLogFileUrlRequest {
  /** Runner-chosen id, unique per run. */
  id: string;
  fileName: string;
  contentType?: string;
  sizeBytes?: number;
  stateId?: string;
}

/** `POST /api/workflows/:runId/logs/:type/url` response. */
export interface WorkflowRunnerLogFileUrlResponse {
  uploadUrl: string;
  /** HTTP method to use for the upload (usually `PUT`). */
  method: string;
  headers?: Record<string, string>;
  expiresAt: string;
}

/** `POST /api/workflows/:runId/logs/:type` body: register a file that was uploaded to `uploadUrl`. */
export interface WorkflowRunnerLogFileRegisterRequest {
  id: string;
  fileName: string;
  contentType?: string;
  sizeBytes?: number;
  stateId?: string;
}

/** Generic acknowledgment. */
export interface WorkflowRunnerAckResponse {
  ok: boolean;
}

/** One step record (an execution of a state) posted in a checkpoint. */
export interface WorkflowRunnerStepRecord {
  /** Transition order within the run; unique per run. */
  sequence: number;
  stateId: string;
  parentStateId?: string;
  branchId?: string;
  type: WorkflowStateType;
  attempt: number;
  status: WorkflowRunnerStepStatus;
  /** ISO-8601 */
  startedAt: string;
  finishedAt?: string;
  latencyMs?: number;
  /** Bounded/redacted per `payloadLogging`. */
  input?: unknown;
  output?: unknown;
  error?: WorkflowStateError;
  /** Bounded technical details (HTTP status/bytes/host, condition result...). */
  details?: Record<string, unknown>;
  /** Evidence captured while executing the state or the agent iteration. */
  evidence?: WorkflowEvidence[];
  /** `AGENT`: iteration this record belongs to (one record per iteration). */
  iteration?: number;
  /** `AGENT`: tool the planner called in this iteration. */
  toolId?: string;
  /** Runtime gateway request id for `INTENT` steps (links the `AICallLog`). */
  gatewayRequestId?: string;
  /** Successor taken. */
  chosenNext?: string;
  /** `CHOICE`: matching case id (`null` = default). */
  caseId?: string | null;
}

/** Resume block for a run parked or checkpointed inside an `AGENT` loop. */
export interface WorkflowRunnerAgentCursor {
  stateId: string;
  /** Next iteration to execute. */
  iteration: number;
  history: WorkflowAgentTraceEntry[];
  notes?: string[];
  summary?: string;
  trackedCalls: number;
  estimatedCost?: number;
  /** ISO-8601: when the loop started (for `maxDurationMs`). */
  startedAt: string;
}

/** Run cursor persisted with every checkpoint. */
export interface WorkflowRunnerCursor {
  /** State to execute next; `null` when the run finished. */
  currentStateId: string | null;
  transitions: number;
  /** Present while the cursor sits inside an `AGENT` loop. */
  agent?: WorkflowRunnerAgentCursor;
}

/** `POST /api/workflows/:runId/steps` body: idempotent upsert by `(run, sequence)`. */
export interface WorkflowRunnerStepsRequest {
  steps: WorkflowRunnerStepRecord[];
  cursor: WorkflowRunnerCursor;
}

/** `POST /api/workflows/:runId/steps` response. */
export interface WorkflowRunnerStepsResponse {
  accepted: number;
  /** Piggybacked cancel flag so a runner that checkpoints often needs fewer `is_canceled` polls. */
  canceled: boolean;
}

/** Aggregated usage reported with the output. */
export interface WorkflowRunnerUsage {
  trackedCalls: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  currency?: string;
}

/** Details of a parked run (`WAITING`). */
export interface WorkflowRunnerWaitDetails {
  stateId: string;
  kind: WorkflowWaitKind;
  /** `EXTERNAL_EVENT` */
  eventKey?: string;
  /** `EXTERNAL_EVENT`: resolved correlation values the event payload must match. */
  correlation?: Record<string, unknown>;
  /** `DELAY`: when the run may be re-queued (ISO-8601). */
  resumeAt?: string;
  /** When the wait expires and `onError` applies (ISO-8601). */
  timeoutAt: string;
  /** `HUMAN_TASK`: resolved assignees and instructions for the inbox. */
  assignees?: unknown;
  instructions?: unknown;
}

/** `POST /api/workflows/:runId/output` body. */
export interface WorkflowRunnerOutputRequest {
  status: WorkflowRunOutputStatus;
  /** `COMPLETED`: resolved run output. */
  output?: unknown;
  /** `ERROR` / `TIMEOUT`: error to record. */
  error?: WorkflowStateError;
  /** `WAITING` */
  wait?: WorkflowRunnerWaitDetails;
  usage?: WorkflowRunnerUsage;
  transitions: number;
  latencyMs?: number;
  /** Human-readable summary of what the run did; feeds the run report. */
  summary?: string;
}

/** Route builder for the runner protocol (relative to the backend origin). */
export interface WorkflowRunnerRoutes {
  next(): string;
  configuration(runId: string): string;
  input(runId: string): string;
  connection(runId: string, key: string): string;
  aiExecutionPlan(runId: string, intent: string): string;
  isCanceled(runId: string): string;
  progress(runId: string): string;
  log(runId: string): string;
  logFileUrl(runId: string, type: WorkflowRunnerLogFileType): string;
  logFile(runId: string, type: WorkflowRunnerLogFileType): string;
  steps(runId: string): string;
  output(runId: string): string;
}

/** Client configuration. */
export interface DcdrWorkflowRunnerClientConfig {
  /** Backend origin, e.g. `https://dcdr.ai`. */
  baseUrl: string;
  /** Collection token shared by the agent fleet. */
  token: string;
  /** Request timeout (ms); defaults to 15 seconds. */
  timeoutMs?: number;
  extraHeaders?: Record<string, string>;
  /** Optional `fetch` implementation (tests, non-standard runtimes). */
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;
}

interface RunnerRequestArgs {
  method: "GET" | "POST";
  path: string;
  body?: object;
}

/**
 * Builds the protocol paths from the mount base path.
 */
export function buildWorkflowRunnerRoutes(basePath: string = WORKFLOW_RUNNER_BASE_PATH): WorkflowRunnerRoutes {
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const run = (runId: string): string => `${base}/${encodeURIComponent(runId)}`;
  return {
    next: () => `${base}/next`,
    configuration: (runId) => `${run(runId)}/configuration`,
    input: (runId) => `${run(runId)}/input`,
    connection: (runId, key) => `${run(runId)}/connection/${encodeURIComponent(key)}`,
    aiExecutionPlan: (runId, intent) => `${run(runId)}/ai/${encodeURIComponent(intent)}`,
    isCanceled: (runId) => `${run(runId)}/is_canceled`,
    progress: (runId) => `${run(runId)}/progress`,
    log: (runId) => `${run(runId)}/log`,
    logFileUrl: (runId, type) => `${run(runId)}/logs/${type.toLowerCase()}/url`,
    logFile: (runId, type) => `${run(runId)}/logs/${type.toLowerCase()}`,
    steps: (runId) => `${run(runId)}/steps`,
    output: (runId) => `${run(runId)}/output`,
  };
}

/**
 * Returns true when a `next` response tells the runner to exit.
 */
export function isWorkflowRunnerTerminate(response: WorkflowRunnerNextResponse | null | undefined): boolean {
  return response?.id === WORKFLOW_RUNNER_TERMINATE_ID;
}

/**
 * Builds a short body preview for error messages without leaking large payloads.
 */
function previewBody(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 200 ? `${compact.slice(0, 200)}…` : compact;
}

/**
 * Typed HTTP client of the runner protocol, used by `dcdr-workflow-runner`.
 *
 * Notes
 * - Every request carries the collection token in the `token` header.
 * - Responses must be JSON; empty bodies are treated as `{}`.
 * - Errors include method, path, status and a bounded body preview.
 */
export class DcdrWorkflowRunnerClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;
  private readonly fetchFn: (input: string, init?: RequestInit) => Promise<Response>;
  readonly routes: WorkflowRunnerRoutes;

  constructor(cfg: DcdrWorkflowRunnerClientConfig) {
    const base = String(cfg.baseUrl ?? "").trim();
    if (!base) throw new Error("DcdrWorkflowRunnerClient requires baseUrl");
    if (!cfg.token) throw new Error("DcdrWorkflowRunnerClient requires token");
    this.baseUrl = base.endsWith("/") ? base.slice(0, -1) : base;
    this.token = cfg.token;
    this.timeoutMs = cfg.timeoutMs ?? 15_000;
    this.extraHeaders = cfg.extraHeaders ?? {};
    this.fetchFn = cfg.fetchFn ?? ((input, init) => fetch(input, init));
    this.routes = buildWorkflowRunnerRoutes();
  }

  /** Polls for the next run. */
  async next(request: WorkflowRunnerNextRequest): Promise<WorkflowRunnerNextResponse> {
    const res = await this.request<WorkflowRunnerNextResponse | null>({ method: "POST", path: this.routes.next(), body: request });
    return res && typeof res === "object" && "id" in res ? res : { id: null };
  }

  /** Fetches the per-run configuration. */
  async configuration(runId: string): Promise<WorkflowRunnerConfigurationResponse> {
    return this.request<WorkflowRunnerConfigurationResponse>({ method: "GET", path: this.routes.configuration(runId) });
  }

  /** Fetches the definition, input, connections and resume state. */
  async input(runId: string): Promise<WorkflowRunnerInputResponse> {
    return this.request<WorkflowRunnerInputResponse>({ method: "GET", path: this.routes.input(runId) });
  }

  /** Resolves the secrets of one connection for this run. */
  async connectionSecrets(runId: string, key: string): Promise<WorkflowRunnerConnectionSecretsResponse> {
    return this.request<WorkflowRunnerConnectionSecretsResponse>({ method: "GET", path: this.routes.connection(runId, key) });
  }

  /** Obtains the runtime execution plan (base URL + customer session) for one intent. */
  async aiExecutionPlan(runId: string, intent: string): Promise<WorkflowRunnerAiExecutionPlanResponse> {
    return this.request<WorkflowRunnerAiExecutionPlanResponse>({ method: "GET", path: this.routes.aiExecutionPlan(runId, intent) });
  }

  /** Asks whether the run was canceled. */
  async isCanceled(runId: string): Promise<boolean> {
    const res = await this.request<WorkflowRunnerCanceledResponse>({ method: "GET", path: this.routes.isCanceled(runId) });
    return res.canceled === true;
  }

  /** Reports progress. */
  async progress(runId: string, request: WorkflowRunnerProgressRequest): Promise<WorkflowRunnerAckResponse> {
    return this.request<WorkflowRunnerAckResponse>({ method: "POST", path: this.routes.progress(runId), body: request });
  }

  /** Sends log entries. */
  async log(runId: string, request: WorkflowRunnerLogRequest): Promise<WorkflowRunnerAckResponse> {
    return this.request<WorkflowRunnerAckResponse>({ method: "POST", path: this.routes.log(runId), body: request });
  }

  /** Requests an upload URL for a log file / artifact. */
  async logFileUploadUrl(runId: string, type: WorkflowRunnerLogFileType, request: WorkflowRunnerLogFileUrlRequest): Promise<WorkflowRunnerLogFileUrlResponse> {
    return this.request<WorkflowRunnerLogFileUrlResponse>({ method: "POST", path: this.routes.logFileUrl(runId, type), body: request });
  }

  /** Registers an uploaded log file / artifact. */
  async registerLogFile(runId: string, type: WorkflowRunnerLogFileType, request: WorkflowRunnerLogFileRegisterRequest): Promise<WorkflowRunnerAckResponse> {
    return this.request<WorkflowRunnerAckResponse>({ method: "POST", path: this.routes.logFile(runId, type), body: request });
  }

  /** Posts a checkpoint (idempotent by sequence). */
  async steps(runId: string, request: WorkflowRunnerStepsRequest): Promise<WorkflowRunnerStepsResponse> {
    return this.request<WorkflowRunnerStepsResponse>({ method: "POST", path: this.routes.steps(runId), body: request });
  }

  /** Posts the final output (or parks the run with `WAITING`). */
  async output(runId: string, request: WorkflowRunnerOutputRequest): Promise<WorkflowRunnerAckResponse> {
    return this.request<WorkflowRunnerAckResponse>({ method: "POST", path: this.routes.output(runId), body: request });
  }

  /**
   * Performs one JSON request with the collection token, a timeout and bounded error messages.
   */
  private async request<T>(args: RunnerRequestArgs): Promise<T> {
    const url = `${this.baseUrl}${args.path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.extraHeaders,
      [WORKFLOW_RUNNER_TOKEN_HEADER]: this.token,
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const resp = await this.fetchFn(url, {
        method: args.method,
        headers,
        body: args.body ? JSON.stringify(args.body) : undefined,
        signal: controller.signal,
      });
      const text = await resp.text();
      if (!resp.ok) {
        throw new Error(
          `DcdrWorkflowRunnerClient request failed: ${args.method} ${args.path} status=${resp.status} body=${previewBody(text)}`,
        );
      }
      if (!text) return JSON.parse("{}") as T;
      const isJson = /application\/json/i.test(resp.headers.get("content-type") ?? "");
      if (!isJson) {
        throw new Error(
          `DcdrWorkflowRunnerClient expected JSON but got content-type='${resp.headers.get("content-type") ?? ""}'`,
        );
      }
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

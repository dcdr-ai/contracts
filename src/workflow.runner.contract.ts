import { HttpRequestParams } from "./http.contract";
import { WorkflowConnectionProtocol, WorkflowConnectionSettings } from "./workflow.connections.contract";
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

/**
 * Connection descriptor without secrets; the runner fetches secrets per run through `connection`.
 *
 * Self-contained by design: the control plane interpolates its own columns (`allowedHosts`, whether
 * credentials exist) into the settings block, so the runner reads one object and never joins
 * anything. Exactly one block of `settings` is present, the one `protocol` names
 * (`WORKFLOW_CONNECTION_SETTINGS_FIELDS`).
 */
export interface WorkflowRunnerConnectionDescriptor {
  key: string;
  protocol: WorkflowConnectionProtocol;
  settings: WorkflowConnectionSettings;
}

/**
 * A platform-brokered capability, resolved for this run only (v3.5.0).
 *
 * `PLATFORM` capabilities run on our credentials, so the tenant configures nothing and there is no
 * connection to point at. The control plane resolves the endpoint and the secrets and hands the
 * runner one self-contained block, exactly the way it does for a connection - which is why the
 * settings reuse `WorkflowConnectionSettings` instead of inventing a second shape. A
 * `CONNECTION`-brokered capability never appears here: it resolves through `connections` like any
 * other destination the tenant owns.
 */
export interface WorkflowRunnerCapabilityDescriptor {
  /** Capability id, matching one of `WORKFLOW_CAPABILITIES`. */
  id: string;
  /** Catalog revision the control plane resolved, so a runner can refuse a shape it does not know. */
  version: string;
  /** Endpoint and credentials, in the settings block of the transport it speaks. */
  settings: WorkflowConnectionSettings;
}

/** Where a resumed run continues from (rebuilt by the backend from the stored checkpoints). */
export interface WorkflowRunnerResumeState {
  /**
   * Every execution frame of the run, as the control plane stored them (v3.10.0).
   *
   * The root frame is the one with no `parentFrameId`; the rest hang off it and describe the branch,
   * item, child workflow or agent loop the run was inside. Order is not significant - a runner
   * rebuilds the tree from the ids - but the control plane sends them parent-first so a consumer
   * that wants to walk them without indexing can.
   */
  frames: WorkflowRunnerFrame[];
  /** Next step sequence number to use. */
  nextSequence: number;
}

/**
 * What opened an execution frame (v3.10.0).
 *
 * One vocabulary for every scope a run can be inside, so nesting is a tree of records rather than a
 * bespoke cursor per state type. `AGENT` is in the list because an agent loop is a scope that parks
 * exactly like a child workflow does; giving it a frame is what retired the standalone agent cursor
 * on the resume state.
 */
export enum WorkflowRunnerFrameKind {
  /** The run's own definition. Exactly one per run, with no parent. */
  ROOT = "ROOT",
  /** One branch of a `PARALLEL`; `key` is the branch id. */
  PARALLEL_BRANCH = "PARALLEL_BRANCH",
  /** One item of a `FOREACH`; `key` is the index and `itemIndex` carries it typed. */
  FOREACH_ITEM = "FOREACH_ITEM",
  /** A `SUBWORKFLOW` child; `key` is the child's workflow key. */
  SUBWORKFLOW = "SUBWORKFLOW",
  /** An `AGENT` loop; `key` is the agent state id and `agentCursor` holds its place. */
  AGENT = "AGENT",
}

/** Lifecycle of one execution frame (v3.10.0). */
export enum WorkflowRunnerFrameStatus {
  RUNNING = "RUNNING",
  /** Parked on a wait of its own; the run is `WAITING` while any frame is. */
  WAITING = "WAITING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  /** Cancelled, or abandoned because a sibling failed under `failFast`. */
  CANCELLED = "CANCELLED",
}

/**
 * One execution scope of a run: where it is, what it produced, and whether it is waiting (v3.10.0).
 *
 * This replaces "one position plus a cursor per state type that could hold a place". That worked
 * while only one thing could be in flight and stopped working the moment a `PARALLEL` had two
 * branches: there was nowhere to record where each one was, what it had already produced, or that
 * two of them were waiting on two different people. A frame is that record, and the wait lives on it
 * rather than on the run - which is what lets N scopes park at once, each its own inbox task with its
 * own assignees, timeout and correlation, and a resume address a frame instead of guessing.
 */
export interface WorkflowRunnerFrame {
  /** Stable id; the control plane assigns it and a checkpoint upserts on it. */
  id: string;
  /** Enclosing frame; absent only on the root. */
  parentFrameId?: string;
  kind: WorkflowRunnerFrameKind;
  /** State **in the parent frame** that opened this one; absent on the root. */
  ownerStateId?: string;
  /** Which scope of that state this is: branch id, item index, child key, agent state id. */
  key?: string;
  /** `FOREACH_ITEM`: the item's position, so results come back in input order. */
  itemIndex?: number;
  /** Depth from the root (0 for the root). */
  depth: number;
  /**
   * Human-readable address, e.g. `each/7/inner/a`; the root's is its own id.
   *
   * Required rather than optional: it is a display field every consumer needs, and a nullable one
   * only means each of them writes the same fallback.
   */
  path: string;
  status: WorkflowRunnerFrameStatus;
  /** State of **this** scope to execute next; `null` once the frame is terminal. */
  currentStateId: string | null;
  /** Transitions this frame has consumed; the run's guard sums them. */
  transitions: number;
  /** Snapshots of the states this frame executed (what `states.<id>` sees inside it). */
  states: Record<string, WorkflowStateSnapshot>;
  /** The frame's own input: a child's mapped input, or a `FOREACH` item's value. */
  input?: unknown;
  /** What the frame produced once terminal. */
  output?: unknown;
  error?: WorkflowStateError;
  /** `AGENT`: iteration, history, notes, summary and budgets of the loop. */
  agentCursor?: WorkflowRunnerAgentCursor;
  /** Details of the wait this frame is parked on. */
  wait?: WorkflowRunnerWaitDetails;
  /** Payload delivered on resume; becomes the parked `WAIT` state's output. */
  resumePayload?: unknown;
  /**
   * This is the frame being answered on this dispatch.
   *
   * Several frames of one run can sit `WAITING` at once, and the runner must re-enter exactly the
   * one that was answered and leave the others on their desks. Usually `resumePayload` says which,
   * but not always: a `DELAY` that elapsed and a form with nothing to fill in both answer with
   * nothing, and an absent payload would be indistinguishable from a task nobody has touched. So the
   * control plane marks the frame it is handing back. Optional only for a run parked on a single
   * frame, where there is nothing to tell apart.
   */
  resuming?: boolean;
  /** The frame parked on an approval gate rather than a `WAIT`: `resumePayload` is the decision. */
  approval?: boolean;
  startedAt?: string;
  finishedAt?: string;
}

/** `GET /api/workflows/:runId/input` response. */
export interface WorkflowRunnerInputResponse {
  run: WorkflowRunnerRunDescriptor;
  workflow: WorkflowRunnerWorkflowDescriptor;
  definition: WorkflowDefinition;
  /** Validated run input (asset variables as references, never blobs). */
  input: Record<string, unknown>;
  connections: WorkflowRunnerConnectionDescriptor[];
  /**
   * Platform-brokered capabilities this run may use (v3.5.0), already resolved with our credentials.
   * Absent or empty when the definition uses none.
   */
  capabilities?: WorkflowRunnerCapabilityDescriptor[];
  /**
   * Definitions of every workflow this run's `SUBWORKFLOW` states call (v3.10.0).
   *
   * Shipped with the input rather than fetched through a route of their own, for the same reason
   * connections and capabilities are: the runner reads one self-contained object and never joins
   * anything. The control plane resolves each `subworkflow.workflowKey` (at `version`, or at the
   * published version when the state pins none) and puts the result here; a `SUBWORKFLOW` naming a
   * key that is absent fails that state rather than the dispatch, so one unpublished child does not
   * cost the parent its whole run.
   *
   * Absent or empty when the definition declares no `SUBWORKFLOW` state.
   */
  subworkflows?: WorkflowRunnerSubworkflowDescriptor[];

  /** Present when the run continues after a requeue or a resumed `WAIT`. */
  resume?: WorkflowRunnerResumeState;

  /**
   * How to reach the asset API, when this run may need to store a payload outside its history.
   *
   * Absent when the tenant keeps payloads inline (`payloadLogging: FULL` with nothing oversized),
   * because then there is nothing to offload and no reason to mint a session.
   */
  assets?: WorkflowRunnerAssetAccess;
}

/**
 * One workflow a `SUBWORKFLOW` state of this run may call (v3.10.0).
 *
 * A child runs **inside the parent run**, not as a run of its own: its states are checkpointed with
 * the parent's sequence and `parentStateId`, and its output becomes the `SUBWORKFLOW` state's
 * output. That keeps one audit trail per business operation - which is the thing a tenant reads -
 * and keeps the backend free of a child-run lifecycle it would otherwise have to schedule, deadline
 * and cancel independently.
 */
export interface WorkflowRunnerSubworkflowDescriptor {
  /** Key the `SUBWORKFLOW` state names. */
  key: string;
  /** User-facing version label of the resolved version, for the trail. */
  version: string;
  /** `computeWorkflowDefinitionSha256` of `definition`. */
  sha256: string;
  /** The child's definition, already validated and published. */
  definition: WorkflowDefinition;
}

/**
 * How the runner reaches the DCDR runtime's asset API for this run.
 *
 * Separate from `WorkflowRunnerAiExecutionPlanResponse` because that one is minted per intent, and a
 * workflow with no `INTENT` state still needs somewhere to put a payload it may not persist inline.
 * Which storage the object lands in is **not** decided here: the runtime resolves the tenant's own
 * default from its entitlements and falls back to the platform's, which is the rule everywhere else
 * assets are written.
 */
export interface WorkflowRunnerAssetAccess {
  /** Runtime base URL; the runner appends `/api/assets`. */
  baseUrl: string;

  /** Customer-mode session token accepted by the runtime's asset routes. */
  sessionToken: string;

  /** Extra headers required to reach the runtime (e.g. access-gateway headers). */
  headers?: Record<string, string>;

  /** When the session expires (ISO-8601). */
  expiresAt: string;
}

/**
 * What a step payload is replaced with when it is stored outside the run history.
 *
 * A tenant's `payloadLogging` says how much of a payload they want **persisted**, and honouring it
 * used to mean the resume state lost the value too: a run that parked and later referenced an
 * earlier state's output resumed with `undefined`, silently. The payload now goes to the tenant's
 * own asset storage and only this reference is persisted, so the policy and the engine stop
 * contradicting each other.
 *
 * `sha256` is not decoration: the runner verifies it after reading, because a resume that continues
 * on the wrong bytes is worse than one that fails.
 */
export interface WorkflowRunnerPayloadAssetRef {
  /** Discriminator, so a consumer can tell this from an ordinary payload object. */
  kind: "ASSET";

  /** Content-addressed path inside the storage. */
  assetPath: string;

  /** SHA-256 of the JSON the reference stands for. */
  sha256: string;

  /** Size of that JSON in bytes, so a UI can show it without fetching. */
  bytes: number;

  /** Type of the original value (`object`, `array`, `string`, ...), for the same reason. */
  type: string;

  /** Storage the object was written to; absent means the tenant default was used. */
  storageId?: string;
}

/**
 * Whether a value is a payload stored outside the run history.
 *
 * Shape-based, because this crosses the wire as plain JSON and lands in a `jsonb` column.
 *
 * @param value Candidate.
 * @returns True when the value is an asset reference.
 */
export function isWorkflowRunnerPayloadAssetRef(value: unknown): value is WorkflowRunnerPayloadAssetRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<WorkflowRunnerPayloadAssetRef>;
  return (
    candidate.kind === "ASSET" &&
    typeof candidate.assetPath === "string" &&
    candidate.assetPath.length > 0 &&
    typeof candidate.sha256 === "string" &&
    candidate.sha256.length > 0
  );
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
  /**
   * How many leading `history` entries `summary` already accounts for (v3.10.0).
   *
   * Without it a compaction cannot tell what has just left the window from what left it ten turns
   * ago, and the only safe thing to send the summarizer is everything outside the window - which is
   * what the runner did, on every turn, alongside the previous summary that already covered exactly
   * those entries. Cost grew with the square of the run length and the model was asked to re-derive
   * conclusions it had already written down.
   *
   * Absent on a cursor written before this existed: such a run compacts everything once more and
   * then carries on incrementally, which is the old behaviour for one turn rather than a break.
   */
  summarizedEntries?: number;
  trackedCalls: number;
  estimatedCost?: number;
  /** ISO-8601: when the loop started (for `maxDurationMs`). */
  startedAt: string;
}

/**
 * Where the run stands, posted with every checkpoint (v3.10.0).
 *
 * The frames **are** the cursor: each one carries its own position, its own snapshots and its own
 * wait, so a checkpoint is an upsert of the scopes that moved rather than an overwrite of a single
 * position. A runner sends the frames it touched, not the whole tree - the control plane holds the
 * rest and a run with two hundred `FOREACH` items should not re-post two hundred rows to record that
 * one of them advanced.
 */
export interface WorkflowRunnerCursor {
  /** Frames created or advanced by this checkpoint. */
  frames: WorkflowRunnerFrame[];
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
  /**
   * Calls to platform-brokered capabilities, counted per capability id (v3.6.0).
   *
   * Kept apart from `trackedCalls`, which counts model calls: a capability runs on our account and
   * is billed per call on its own terms, and mixing the two would make a run's model usage
   * unreadable. A `CONNECTION`-brokered capability reaches the tenant's own server and is never
   * counted here.
   */
  capabilityCalls?: Record<string, number>;
  /**
   * What the run's tool calls consumed (v3.8.0), both ways of counting.
   *
   * Two numbers rather than one because they catch opposite abuses, and a ceiling on either alone
   * is gameable through the other: `calls` catches an agent looping through ten thousand tiny
   * invocations, where the frequency itself is the cost - a connection opened, a secret fetched, a
   * step recorded, every time - while `credits` catches the single call that drags two hundred
   * megabytes back. It is the same pair the platform already keeps for model usage
   * (`maxCallsPerMonth` beside `maxTrackedCallsPerMonth`).
   *
   * Rated **per call, as the run goes**, never from these totals: ten calls of six hundred rows are
   * ten one-credit calls, and rating the six thousand rows afterwards would price them as one large
   * call and charge twice as much for the same work.
   */
  tools?: WorkflowToolUsage;
}

/** Tool consumption of a run, per capability id. */
export interface WorkflowToolUsage {
  /** Invocations, per capability id (`MCP` for a tool call on an MCP server). */
  calls: Record<string, number>;
  /** Credits those invocations cost, per capability id. */
  credits: Record<string, number>;
  /**
   * Version of the rating matrix the runner used.
   *
   * Carried so a run stays explainable after prices move: a charge nobody can reproduce six months
   * later is a charge nobody can defend, and the matrix is versioned precisely so it can change.
   */
  matrixVersion: string;
}

/** Details of a parked run (`WAITING`). */
export interface WorkflowRunnerWaitDetails {
  stateId: string;
  kind: WorkflowWaitKind;
  /** `EXTERNAL_EVENT` */
  eventKey?: string;
  /**
   * Resolved correlation values: what an `EXTERNAL_EVENT` payload must match, and for any other kind
   * what this particular wait is about. Resolved for every kind since 3.10.0, because a wait inside
   * a composite needs it: three items of a `FOREACH` open three tasks off the same state, and the
   * frame `path` says where each one is without saying which item it is for.
   */
  correlation?: Record<string, unknown>;
  /** `DELAY`: when the run may be re-queued (ISO-8601). */
  resumeAt?: string;
  /** When the wait expires and `onError` applies (ISO-8601). */
  timeoutAt: string;
  /** `HUMAN_TASK`: resolved assignees and instructions for the inbox. */
  assignees?: unknown;
  instructions?: unknown;
  /** The wait is the approval gate of `stateId` (`WorkflowState.approval`, v3.1.1): the answer is a `WorkflowApprovalDecision`. */
  approval?: boolean;
}

/** One frame of a run that is parked, and on what (v3.10.0). */
export interface WorkflowRunnerFrameWait {
  /** Frame that is waiting. */
  frameId: string;
  /** Human-readable address of that frame, so an inbox row can say which branch or item it is. */
  path?: string;
  details: WorkflowRunnerWaitDetails;
}

/** `POST /api/workflows/:runId/output` body. */
export interface WorkflowRunnerOutputRequest {
  status: WorkflowRunOutputStatus;
  /** `COMPLETED`: resolved run output. */
  output?: unknown;
  /** `ERROR` / `TIMEOUT`: error to record. */
  error?: WorkflowStateError;
  /**
   * `WAITING`: every frame the run is parked on (v3.10.0).
   *
   * A list because a `PARALLEL` can park two branches on two different people at once, and the run
   * comes back only when all of them are answered. Each entry is one inbox task, with its own
   * assignees, timeout and correlation, and a resume names the frame it answers. It was a single
   * `wait` for as long as only one thing could be in flight.
   *
   * The rule this list encodes, stated once because it is easy to get wrong in every query that
   * reads frames: **a frame is a task if and only if it carries a `wait` block.** `WAITING` on its
   * own means "not running" - the composites above a nested task are all `WAITING` and none of them
   * is anybody's job. Count frames rather than waits and a three-host audit shows nine open tasks
   * where three people have to act, and a resume refuses as ambiguous when it is not.
   */
  waits?: WorkflowRunnerFrameWait[];
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

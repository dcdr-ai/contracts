import { ExecutionError } from "./errors.contract";
import { Message } from "./messages.contract";
import { Intent } from "./intent.contract";
import { IntentProvider } from "./provider.contract";

/**
 * A single execution request coming into the gateway.
 * The backend typically calls this and later writes AICallLog itself.
 */
export interface ExecuteIntentRequest {
  /**
   * Optional orchestration metadata supplied by a higher-level workflow/agent system.
   *
   * Notes
   * - This is distinct from `context`, which remains an open caller-controlled bag.
   * - Treat these fields as correlation/idempotency metadata, not content.
   * - Runtime features that evaluate `context` should not assume `workflow` is part of that surface.
   */
  workflow?: ExecutionWorkflowContext;

  context?: ExecutionContext;

  /**
   * Optional template variables for prompt rendering.
   * If omitted, gateway derives variables from `input`.
   */
  vars?: Record<string, unknown>;

  /**
   * Optional routing hints from backend.
   * Useful for debugging or forcing a provider/implementation temporarily.
   */
  routing?: {
    preferProviders?: IntentProvider[];
    denyProviders?: IntentProvider[];
    forceImplementationId?: string | null;
    allowFallback?: boolean;
    maxAttempts?: number;
  };
}

/**
 * One attempt in an execution (for retries/fallback reporting).
 * This is gold for debugging and later AICallLog correlation.
 */
export interface ExecutionAttemptReport {
  attempt: number;
  provider: IntentProvider;
  implementationId: string;

  status: ExecutionStatus;

  latencyMs: number;

  error: ExecutionError | null;

  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  runHash?: string | null;

  cached: boolean;
}

/**
 * Final execution report returned by the gateway.
 * The backend should persist the relevant fields into AICallLog.
 */
export interface ExecutionReport {
  sessionId: string;
  appId: string;
  workflow?: ExecutionWorkflowContext;
  context?: ExecutionContext;
  gatewayRequestId: string;

  intent: Intent;

  /**
   * Prompt identity used for reproducibility.
   * Backend should persist at least id+version+sha256.
   */
  prompt: {
    id: string;
    version: string;
    sha256: string;
  };

  /** Final chosen provider/implementation. */
  finalImplementation: {
    provider: IntentProvider;
    model: string;
    implementationId: string;
    latencyMs: number;
  };

  /** All attempts (including failures). */
  attempts: ExecutionAttemptReport[];

  /** Aggregate usage if available. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  /**
   * Timing breakdown for this execution.
   *
   * Notes:
   * - All `*Ms` fields are durations in milliseconds.
   * - `startedAt`/`endedAt` are wall-clock ISO strings (for correlation/logs).
   * - Duration fields are best-effort and computed by the gateway; they can differ slightly
   *   from sums of attempt latencies due to rounding and internal scheduling.
   */
  timing: {
    /** Wall-clock start time (ISO). */
    startedAt: string;

    /** Wall-clock end time (ISO). */
    endedAt: string;

    /** Total end-to-end latency as measured by the gateway. */
    latencyMs: number;

    /**
     * Gateway-only overhead excluding provider execution time (best-effort).
     *
     * Relationship (approx):
     * - gatewayOverheadMs ≈ latencyMs - providerTotalMs
     *
     * This includes (among other things):
     * - request validation
     * - configuration/registry lookup
     * - prompt rendering / template preparation
     * - routing & candidate selection
     * - retry backoff/jitter waits between attempts
     * - response shaping (parsing/validation) and report building
     */
    gatewayOverheadMs?: number;

    /**
     * Time spent in the gateway BEFORE the first provider call (best-effort).
     * Intended to capture validation + prompt render + routing.
     */
    gatewayPreProviderMs?: number;

    /**
     * Time spent in the gateway AFTER provider calls until the response/report is ready (best-effort).
     * This typically includes output parsing/validation and response construction.
     */
    gatewayPostProviderMs?: number;

    /**
     * Sum of provider execution time across all attempts (best-effort).
     *
     * This is the time spent waiting for the provider(s)/LLM(s) to return, including retries/fallback.
     */
    providerTotalMs?: number;
  };

  /** Output validation summary. */
  validation?: {
    parsed?: boolean;
    schemaOk?: boolean;
    errors?: string[];
  };

  /** The bundle version used during this execution (helps debugging). */
  configVersion?: string;

  problemHash?: string | null;
  runHash?: string | null;
  outputHash?: string | null;

  cached: boolean;
}

export enum ExecutionStatus {
  OK = "OK",
  ERROR = "ERROR",
}

/**
 * Response object returned by the gateway.
 * Keep this stable; it's your public internal contract.
 */
export interface ExecuteIntentResponse {
  status: ExecutionStatus;

  /** The input */
  input: Message[];

  /** Parsed result (if ok). */
  output?: any;

  /** Error (if error). */
  error?: ExecutionError;

  /** Execution report for backend logging. */
  report: ExecutionReport;
}

/**
 * Optional orchestration metadata for callers that execute the runtime as one atomic step
 * inside a larger workflow, graph, or agent loop.
 *
 * Notes
 * - This metadata is intentionally separated from `context` so business/customer context can remain open.
 * - Fields are identifiers only; they must not be used as a hidden content channel.
 */
export interface ExecutionWorkflowContext {
  /** Stable logical workflow identifier across multiple runs. */
  workflowId?: string;

  /** Specific workflow run/execution identifier. */
  runId?: string;

  /** Logical graph/state-machine node identifier. */
  nodeId?: string;

  /** Specific step identifier inside a workflow run. */
  stepId?: string;

  /** Parent execution identifier when this execution was spawned by another step. */
  parentExecutionId?: string;

  /** Caller-provided idempotency/correlation key for deduplication or replay safety. */
  idempotencyKey?: string;
}

/**
 * Context info for logging and analytics.
 *
 * Notes
 * - This remains intentionally open for caller/business context.
 * - Runtime features such as CONDITION_ON_CONTEXT may evaluate arbitrary keys from this object.
 */
export interface ExecutionContext {
  [key: string]: any;
}

/**
 * Streaming execution event type names.
 *
 * Notes
 * - These strings are used as SSE `event:` names.
 * - Keep values stable (wire-level behavior).
 */
export enum ExecutionStreamEventType {
  META = "meta",
  DELTA = "delta",
  FINAL = "final",
  ERROR = "error",
}

/**
 * Metadata emitted at the start of a streaming execution.
 */
export interface ExecutionStreamMetaEventData {
  /** Gateway-generated correlation ID for this execution. */
  gatewayRequestId: string;

  /** Intent name being executed. */
  intent: Intent;

  /** ISO timestamp for when the stream started (gateway wall-clock). */
  startedAt: string;
}

/**
 * A text delta emitted during streaming generation.
 *
 * Notes
 * - v1 focuses on text deltas only.
 * - Providers that do not support native streaming may emit zero delta events.
 */
export interface ExecutionStreamDeltaEventData {
  text: string;
}

/**
 * Final execution payload emitted at the end of the stream.
 *
 * Notes
 * - This is the same response shape as non-streaming `executeIntent`.
 * - Even error executions should be delivered as a final response where possible.
 */
export interface ExecutionStreamFinalEventData {
  response: ExecuteIntentResponse;
}

/**
 * Fatal streaming error emitted when the stream cannot produce a final response.
 *
 * Notes
 * - Prefer emitting `final` with `status=ERROR` when possible.
 */
export interface ExecutionStreamErrorEventData {
  error: ExecutionError;
}

/** Streaming `meta` event envelope. */
export interface ExecutionStreamMetaEvent {
  type: ExecutionStreamEventType.META;
  data: ExecutionStreamMetaEventData;
}

/** Streaming `delta` event envelope. */
export interface ExecutionStreamDeltaEvent {
  type: ExecutionStreamEventType.DELTA;
  data: ExecutionStreamDeltaEventData;
}

/** Streaming `final` event envelope. */
export interface ExecutionStreamFinalEvent {
  type: ExecutionStreamEventType.FINAL;
  data: ExecutionStreamFinalEventData;
}

/** Streaming `error` event envelope. */
export interface ExecutionStreamErrorEvent {
  type: ExecutionStreamEventType.ERROR;
  data: ExecutionStreamErrorEventData;
}

/**
 * Eval execution mode.
 *
 * Notes
 * - Keep values stable (wire-level behavior).
 */
export enum ExecuteIntentEvalMode {
  /** Continue evaluating other implementations even if one fails. */
  BEST_EFFORT = "BEST_EFFORT",

  /** Stop as soon as the first implementation fails. */
  FAIL_FAST = "FAIL_FAST",
}

/**
 * Optional runtime overrides applied for a specific eval target.
 *
 * Design constraints
 * - Keep JSON-safe.
 * - Avoid introducing `any`/`unknown` in new contract surfaces.
 */
export interface ExecuteIntentEvalRuntimeOverride {
  /** Standard prompt/runtime parameters (temperature, max_tokens, response_format...). */
  promptParameters?: Record<string, string | number | boolean | null>;

  /** Provider-specific runtime knobs (primitives-only). */
  providerRuntime?: Record<string, string | number | boolean | null>;
}

/**
 * Selects a concrete implementation to evaluate.
 */
export interface ExecuteIntentEvalTarget {
  implementationId: string;

  /** Optional per-target runtime override. */
  runtimeOverride?: ExecuteIntentEvalRuntimeOverride;
}

/**
 * Eval options.
 */
export interface ExecuteIntentEvalOptions {
  /** Optional caller-provided eval id for correlation. */
  evalId?: string;

  /** Defaults to BEST_EFFORT. */
  mode?: ExecuteIntentEvalMode;

  /** Default true. If false, runtime may omit large outputs. */
  includeOutput?: boolean;

  /**
   * Optional maximum concurrency for evaluating multiple implementations.
   *
   * Notes
   * - Runtime may clamp to a safe range.
   * - When `mode=FAIL_FAST`, runtime may force this to 1 to preserve semantics.
   */
  maxConcurrency?: number;
}

/**
 * Request body for `POST /api/execution/eval/{intent}`.
 *
 * Semantics
 * - `request` is the same payload used for normal execution.
 * - `request.context` is used as the common context and is propagated to each sub-run.
 * - If `targets` omitted/empty => evaluate all active implementations for the intent.
 */
export interface ExecuteIntentEvalRequest {
  request: ExecuteIntentRequest;
  targets?: ExecuteIntentEvalTarget[];
  options?: ExecuteIntentEvalOptions;
}

/**
 * A single eval result item.
 */
export interface ExecuteIntentEvalResultItem {
  implementationId: string;
  provider: IntentProvider;
  model: string;

  /** Full 1:1 execution result for this implementation. */
  response: ExecuteIntentResponse;
}

/**
 * Response for `POST /api/execution/eval/{intent}`.
 */
export interface ExecuteIntentEvalResponse {
  /** Correlation id shared across all runs within this eval call. */
  evaluationId: string;

  intent: Intent;

  timing: {
    startedAt: string;
    endedAt: string;
    latencyMs: number;
  };

  results: ExecuteIntentEvalResultItem[];
}

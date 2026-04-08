import { ExecutionError } from "./errors.contract";
import { Message } from "./messages.contract";
import { Intent } from "./intent.contract";
import { IntentProvider } from "./provider.contract";

/**
 * A single execution request coming into the gateway.
 * The backend typically calls this and later writes AICallLog itself.
 */
export interface ExecuteIntentRequest {

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
 * Context info for logging and analytics.
 */
export interface ExecutionContext {
  [key: string]: any;
}

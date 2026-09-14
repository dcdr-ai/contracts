import { ExecutionError } from "./errors.contract";
import { ExecutionReport, ExecutionStatus } from "./execution.contract";
import { Message } from "./messages.contract";
import { IntentProvider } from "./provider.contract";

/**
 * Execution-log mode emitted by the runtime.
 *
 * Notes
 * - `INTENT` covers the classic intent execution pipeline.
 * - `GATEWAY` covers the OpenAI-compatible `/v1/*` proxy surface.
 */
export enum ExecutionLogMode {
  INTENT = "INTENT",
  GATEWAY = "GATEWAY",
}

/**
 * Gateway surface family for OpenAI-compatible `/v1/*` logging.
 */
export enum GatewayLogSurface {
  MODELS = "MODELS",
  RESPONSES = "RESPONSES",
  CHAT_COMPLETIONS = "CHAT_COMPLETIONS",
  /** Anthropic Messages wire, `POST /v1/messages` (v3.14.0). */
  MESSAGES = "MESSAGES",
  /** `POST /v1/embeddings` (v3.14.0). */
  EMBEDDINGS = "EMBEDDINGS",
}

/**
 * Gateway model-resolution strategy used for one `/v1/*` request.
 */
export enum GatewayLogResolutionKind {
  DIRECT = "DIRECT",
  PROVIDER_PREFIX = "PROVIDER_PREFIX",
}

/**
 * Safe request summary for OpenAI-compatible gateway logging.
 */
export interface GatewayLogRequestSummary {
  /** The client asked for a streamed response. */
  stream?: boolean;
  messageCount?: number;
  inputTextChars?: number;
  inputItemCount?: number;
  metadataKeys?: string[];
  toolCount?: number;
  /** Embeddings: how many inputs the request carried (v3.14.0). */
  inputCount?: number;
}

/**
 * Safe response summary for OpenAI-compatible gateway logging.
 */
export interface GatewayLogResponseSummary {
  object?: string;
  finishReason?: string;
  outputTextChars?: number;
  toolCallCount?: number;
  refusal?: boolean;
  resultCount?: number;
  /**
   * Streamed responses: milliseconds from the gateway receiving the request to the first upstream
   * chunk written to the client (v3.14.0). Absent when the response was not streamed.
   */
  firstChunkMs?: number;
}

/**
 * Gateway-specific additive logging payload.
 */
export interface GatewayExecutionLogDetails {
  surface: GatewayLogSurface;
  route: string;
  httpStatus?: number;
  serviceTokenId?: string;
  requestedModel?: string;
  resolvedProvider?: IntentProvider;
  resolvedModel?: string;
  credentialRef?: string;
  resolutionKind?: GatewayLogResolutionKind;
  tokenScopeAllowed?: boolean;
  providerAllowed?: boolean;
  modelAllowed?: boolean;
  blockedReasonCode?: string;
  /**
   * Whether the request passed every admission gate and the upstream call was attempted (3.14.0).
   *
   * `false` for refusals before dispatch - token, scope, validation, model resolution, route,
   * Provider Limits, token limit rules. `true` from the moment the upstream call is attempted: an
   * upstream error, a transport failure or a client that disconnects mid-stream is still a dispatched
   * call, and it counted toward calls limits.
   */
  dispatched?: boolean;
  requestSummary?: GatewayLogRequestSummary;
  responseSummary?: GatewayLogResponseSummary;
}

/**
 * Backend execution log envelope shared by intent and gateway runtime surfaces.
 *
 * Notes
 * - The shape stays highly compatible with the original intent logging event so backend
 *   ingestion can reuse one pipeline.
 * - `ExecutionReport` fields become optional here to allow `/v1/*` gateway logs that do not
 *   naturally have prompt/intent/attempt semantics.
 */
export interface ExecutionLogEvent extends Partial<ExecutionReport> {
  executionMode?: ExecutionLogMode;
  status: ExecutionStatus;
  input?: Message[];
  output?: unknown;
  error?: ExecutionError;
  gateway?: GatewayExecutionLogDetails;
  cid?: string;
}

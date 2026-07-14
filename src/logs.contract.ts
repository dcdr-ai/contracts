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
  stream?: boolean;
  messageCount?: number;
  inputTextChars?: number;
  inputItemCount?: number;
  metadataKeys?: string[];
  toolCount?: number;
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
}

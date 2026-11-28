import { CapturedContent, CapturedContentWithheldReason } from "./captured-content.contract";
import { ExecutionError } from "./errors.contract";
import { ExecutionReport, ExecutionStatus } from "./execution.contract";
import { Message } from "./messages.contract";
import { IntentProvider } from "./provider.contract";
import {
  TelemetryContentSummary,
  TelemetryEndUser,
  TelemetryExecutionLogDetails,
  TelemetryPayloadLevel,
} from "./telemetry.contract";

/**
 * Execution-log mode emitted by the runtime.
 *
 * Notes
 * - `INTENT` covers the classic intent execution pipeline.
 * - `GATEWAY` covers the OpenAI-compatible `/v1/*` proxy surface.
 * - `TELEMETRY` covers OpenTelemetry spans reported by external AI apps (`POST /v1/traces`, `/v1/logs`);
 *   since 3.25.0. Those events travel on their own route and queue ({@link DcdrTelemetryIngestRequest}),
 *   never in the execution-log batches.
 */
export enum ExecutionLogMode {
  INTENT = "INTENT",
  GATEWAY = "GATEWAY",
  TELEMETRY = "TELEMETRY",
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
  /**
   * Alias of the `OPEN_AI_COMPATIBLE` binding the call resolved to (since 3.28.0), with `resolvedProvider`
   * `OPEN_AI_COMPATIBLE` and `resolvedModel` the upstream model id. Absent for every other provider and for the
   * binding without alias (or the runtime's env configuration).
   */
  compatibleAlias?: string;
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
  /**
   * Trace id from the caller's W3C `traceparent` header (32 lowercase hex), since 3.25.0.
   *
   * Client-controlled: used only to correlate a gateway call with the caller's telemetry spans **inside one
   * tenant**, never for authentication or tenancy. Absent when the header is missing or malformed.
   */
  traceId?: string;
  /**
   * Parent span id from the same `traceparent` (16 lowercase hex): the caller's span that made this call.
   * A telemetry span with this `traceId` and this id is the one the gateway call served. Since 3.25.0.
   */
  parentSpanId?: string;
  /**
   * Payload level the gateway applied to this call, from the service token (since 3.27.0).
   *
   * Absent when the token check carried no payload level (a control plane older than 3.27.0): the event is then
   * exactly what it was before, with none of the content fields below. `NONE` -> counts only (no
   * {@link contentSummary}); `METADATA` -> counts and {@link contentSummary}; `FULL` -> also {@link content}.
   */
  payloadLevel?: TelemetryPayloadLevel;
  /**
   * Whether the request carried content the gateway could capture (messages, input, instructions), whatever was
   * kept (since 3.27.0). Present whenever {@link payloadLevel} is.
   */
  contentReceived?: boolean;
  /**
   * Counts, roles, tool names and keyed hashes of the captured content (since 3.27.0), the same shape and the same
   * tenant key as telemetry. `METADATA` and `FULL` only. Hashes are absent when the tenant key is unavailable
   * (never computed with a weak or missing key).
   */
  contentSummary?: TelemetryContentSummary;
  /**
   * The call's content after processors, bounded per field (since 3.27.0). `FULL` only, and only for a dispatched
   * call; an upstream HTTP error leaves `input` only. Encoding per surface: `JSON.stringify` of the request member
   * (`messages`, `input`) and of the response object (assembled from the stream when streamed); see
   * `captured-content.contract`.
   */
  content?: CapturedContent;
  /** Why {@link content} is absent although {@link payloadLevel} is `FULL` (since 3.27.0). */
  contentWithheld?: CapturedContentWithheldReason;
  /**
   * End user the client named on the request (since 3.27.0): `safety_identifier` or else `user` on chat completions
   * and responses, `user` on embeddings, `metadata.user_id` on messages. Pseudonymised or sent as reported per the
   * token's `endUserIdMode` (`TelemetryEndUserIdMode`; absent means pseudonymised), sent as reported cut at 256
   * characters; dropped when it should be pseudonymised and the tenant key is unavailable. The upstream provider always receives the raw value.
   */
  endUser?: TelemetryEndUser;
  /**
   * The streamed response did not reach its terminal event (client gone, upstream error mid-stream, early end)
   * (since 3.27.0). Always together with `content.truncated` containing `output` when content is attached.
   */
  streamInterrupted?: boolean;
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
  /** Present when `executionMode` is `TELEMETRY` (since 3.25.0). */
  telemetry?: TelemetryExecutionLogDetails;
  cid?: string;
}

/**
 * An execution log event that carries one telemetry span (since 3.25.0).
 *
 * The envelope fields it uses are listed on {@link TelemetryExecutionLogDetails}.
 */
export interface TelemetryExecutionLogEvent extends ExecutionLogEvent {
  executionMode: ExecutionLogMode.TELEMETRY;
  telemetry: TelemetryExecutionLogDetails;
  cid: string;
}

/**
 * Body of the runtime -> control plane telemetry batch (`POST /api/dcdr/telemetry`, same auth as
 * `/api/dcdr/logs`), since 3.25.0.
 *
 * Batches close at `DCDR_TELEMETRY_BATCH_MAX_SPANS` spans or `DCDR_TELEMETRY_BATCH_MAX_BYTES` bytes. The
 * control plane stores each span once per `telemetrySpanIdempotencyKey(cid, traceId, spanId)`.
 */
export interface DcdrTelemetryIngestRequest {
  spans: TelemetryExecutionLogEvent[];
}

/**
 * Whether an execution log event carries a telemetry span.
 *
 * @param event Any execution log event.
 * @returns `true` for `executionMode: TELEMETRY` with a `telemetry` block and a `cid`.
 */
export function isTelemetryExecutionLogEvent(event: ExecutionLogEvent | null | undefined): event is TelemetryExecutionLogEvent {
  return !!event && event.executionMode === ExecutionLogMode.TELEMETRY && !!event.telemetry && typeof event.cid === "string" && event.cid.length > 0;
}

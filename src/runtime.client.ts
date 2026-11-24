import {
  ExecutionInputPart,
  ExecutionPartSourceKind,
  ExecutionPartType,
  ExecuteIntentEvalRequest,
  ExecuteIntentEvalResponse,
  ExecuteIntentRequest,
  ExecuteIntentResponse,
  ExecutionStreamDeltaEvent,
  ExecutionStreamErrorEvent,
  ExecutionStreamEventType,
  ExecutionStreamFinalEvent,
  ExecutionStreamMetaEvent,
} from "./execution.contract";
import {
  DcdrAssetMetadata,
  DcdrAssetDeleteRequest,
  DcdrAssetDeleteResponse,
  DcdrAssetGetRequest,
  DcdrAssetGetResponse,
  DcdrAssetUploadRequest,
  DcdrAssetUploadResponse,
} from "./asset.contract";
import { DcdrEntitlementsContract } from "./entitlements.contract";
import { ExecutionErrorCode, isExecutionErrorCode } from "./errors.contract";

/**
 * Options for `DcdrRuntimeClient.executeIntentStream`.
 */
export interface DcdrRuntimeClientStreamOptions {
  /** Optional request timeout override (ms). Defaults to client timeoutMs. */
  timeoutMs?: number;

  /** Optional abort signal for client-side cancellation. */
  signal?: AbortSignal;
}

interface ParsedSseEvent {
  event: string;
  data: string;
}

/**
 * Max characters to include when embedding a response body preview inside an Error message.
 *
 * Notes
 * - Keeps logs and CLI output readable.
 * - Reduces the chance of leaking large/sensitive upstream HTML or debug payloads.
 */
const ERROR_BODY_PREVIEW_MAX_CHARS = 4000;
const DEFAULT_ASSET_UPLOAD_MIME_TYPE = "application/octet-stream";

const EXTENSION_TO_MIME_TYPE: Record<string, string> = {
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gif: "image/gif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  json: "application/json",
  m4a: "audio/mp4",
  md: "text/markdown",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  svg: "image/svg+xml",
  txt: "text/plain",
  wav: "audio/wav",
  webm: "video/webm",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * Simplified client-side upload input.
 */
export interface DcdrRuntimeAssetUploadInput {
  intent?: string;
  partType?: ExecutionPartType;
  mimeType?: string;
  dataBase64: string;
  name?: string;
  metadata?: DcdrAssetMetadata;
  storageId?: string;
  assetCacheKey?: string;
}

/**
 * Input used to build an asset-backed execution input part.
 */
export interface DcdrRuntimeAssetInputPartSource {
  asset: DcdrAssetUploadResponse["asset"];
  variableName?: string;
  mimeType?: string;
  name?: string;
  partType?: ExecutionPartType;
  sizeBytes?: number;
}

/**
 * Builds a complete runtime upload payload from a simplified client request.
 */
export function prepareAssetUploadRequest(
  input: DcdrRuntimeAssetUploadInput,
): DcdrAssetUploadRequest {
  const name = normalizeOptionalString(input.name);
  const mimeType =
    normalizeOptionalString(input.mimeType) ||
    inferMimeTypeFromAssetName(name) ||
    DEFAULT_ASSET_UPLOAD_MIME_TYPE;
  const partType =
    input.partType || inferExecutionPartTypeForAsset({ mimeType, name });

  const request: DcdrAssetUploadRequest = {
    partType,
    mimeType,
    dataBase64: String(input.dataBase64 ?? "").trim(),
  };

  const intent = normalizeOptionalString(input.intent);
  const storageId = normalizeOptionalString(input.storageId);
  const assetCacheKey = normalizeOptionalString(input.assetCacheKey);

  if (intent) request.intent = intent;
  if (name) request.name = name;
  if (input.metadata) request.metadata = cloneAssetMetadata(input.metadata);
  if (storageId) request.storageId = storageId;
  if (assetCacheKey) request.assetCacheKey = assetCacheKey;

  return request;
}

/**
 * Converts a managed asset reference into an execution input part.
 */
export function prepareAssetInputPart(
  input: DcdrRuntimeAssetInputPartSource,
): ExecutionInputPart {
  const name = normalizeOptionalString(input.name);
  const mimeType =
    normalizeOptionalString(input.mimeType) ||
    inferMimeTypeFromAssetName(name) ||
    inferMimeTypeFromAssetName(
      normalizeOptionalString(input.asset.assetPath),
    ) ||
    DEFAULT_ASSET_UPLOAD_MIME_TYPE;
  const partType =
    input.partType || inferExecutionPartTypeForAsset({ mimeType, name });

  return {
    variableName: normalizeOptionalString(input.variableName),
    type: partType,
    mimeType,
    name,
    sizeBytes: input.sizeBytes ?? input.asset.sizeBytes,
    source: {
      kind: ExecutionPartSourceKind.ASSET,
      asset: { ...input.asset },
    },
  };
}

/**
 * Runtime healthcheck response shape.
 *
 * Notes
 * - This is intentionally minimal and tolerant to additional fields.
 */
export interface DcdrRuntimeHealthcheckResponse {
  status: "OK" | "UNAVAILABLE" | "ERROR";
  availability?: number;
  freeMemGB?: string;
  load1m?: number[];
  error?: string;
}

/**
 * Runtime version/build response shape.
 *
 * Notes
 * - This is intended for diagnostics and supportability.
 * - The runtime may add fields over time; consumers should treat unknown fields as ignorable.
 * - Some fields are intentionally omitted in cloud mode (multi-tenant) to avoid leaking host details.
 */
export interface DcdrRuntimeVersionResponse {
  /** CI build identifier (Azure Pipelines `Build.BuildNumber`), e.g. `20260416.1`. */
  buildNumber?: string;

  /** Build date (typically ISO 8601), e.g. `2026-04-16` or `2026-04-16T12:34:56Z`. */
  buildDate?: string;

  /** Source revision identifier (short or full SHA), e.g. `42b224f5`. */
  gitSha?: string;

  /** Present in runtime mode (`--registry`). Intentionally omitted in cloud mode. */
  nodeVersion?: string;

  /** Present in runtime mode (`--registry`). Intentionally omitted in cloud mode. */
  uptimeSeconds?: number;
}

/**
 * Minimal dry-run response shape.
 *
 * Notes
 * - Runtime may return extra fields; keep this tolerant.
 */
export interface DcdrRuntimeDryRunResponse {
  status: string;
  error?: { message?: string } | string;
}

/**
 * Formal eval response shape.
 *
 * Notes
 * - Prefer this over ad-hoc eval responses.
 */
export interface DcdrRuntimeEvalResponse extends ExecuteIntentEvalResponse {}

/**
 * Circuit breaker status snapshot returned by the runtime.
 */
export interface DcdrRuntimeCircuitBreakerStatusSnapshot {
  /** Tenant/customer identifier used for scoping breaker state. */
  tenantCid: string;
  provider: string;
  model?: string;
  failures: number;
  blockedUntilMs?: number;
  blocked: boolean;
  blockedTtlMs?: number;
}

/**
 * Minimal response for a breaker reset operation.
 */
export interface DcdrRuntimeCircuitBreakerResetResponse {
  ok: boolean;
}

/**
 * Status for optional entitlements data returned by the auth check endpoint.
 */
export enum DcdrRuntimeAuthCheckEntitlementsStatus {
  OK = "OK",
  ERROR = "ERROR",
  SKIPPED = "SKIPPED",
}

/**
 * Response shape for token validation diagnostics.
 *
 * Notes
 * - This endpoint is intended for customer integrations to verify that their configured token is accepted by the runtime.
 * - The runtime may add extra fields over time; consumers should treat unknown fields as ignorable.
 */
export interface DcdrRuntimeAuthCheckResponse {
  valid: boolean;
  authMode?: "internal" | "customer";
  nowMs: number;

  /** Present for customer tokens. */
  cid?: string;

  /** Present for customer tokens. */
  session?: {
    id: string;
    aid: string;
    cid?: string;
    iat: number;
    exp: number;
    scopes: string[];
  };

  /** Present for customer tokens when snapshot allowlist info is available. */
  allowlist?: {
    snapshotAgeMs: number;
  };

  /** Present for customer tokens when backend entitlements are enabled. */
  entitlementsStatus?: DcdrRuntimeAuthCheckEntitlementsStatus;
  entitlements?: DcdrEntitlementsContract;
}

// ---------------------------------------------------------------------------------------------------
// OpenTelemetry (OTLP/HTTP) export to the runtime's `/v1/traces` and `/v1/logs` (since 3.25.0)
// ---------------------------------------------------------------------------------------------------

/** OTLP/JSON `AnyValue`: exactly one member set. `intValue` is a decimal string (int64) or a safe number. */
export interface DcdrOtlpAnyValue {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: string | number;
  doubleValue?: number;
  arrayValue?: { values: DcdrOtlpAnyValue[] };
  kvlistValue?: { values: DcdrOtlpKeyValue[] };
  /** Base64. */
  bytesValue?: string;
}

/** OTLP/JSON `KeyValue`. */
export interface DcdrOtlpKeyValue {
  key: string;
  value: DcdrOtlpAnyValue;
}

/** OTLP/JSON `Resource`. */
export interface DcdrOtlpResource {
  attributes?: DcdrOtlpKeyValue[];
  droppedAttributesCount?: number;
}

/** OTLP/JSON `InstrumentationScope`. */
export interface DcdrOtlpScope {
  name?: string;
  version?: string;
  attributes?: DcdrOtlpKeyValue[];
}

/** OTLP/JSON `Span.Event`. */
export interface DcdrOtlpSpanEvent {
  timeUnixNano?: string;
  name: string;
  attributes?: DcdrOtlpKeyValue[];
}

/** OTLP/JSON `Span.Link`. */
export interface DcdrOtlpSpanLink {
  traceId: string;
  spanId: string;
  traceState?: string;
  attributes?: DcdrOtlpKeyValue[];
}

/** OTLP/JSON `Status` (`code`: 0 unset, 1 ok, 2 error). */
export interface DcdrOtlpSpanStatus {
  code?: number;
  message?: string;
}

/** OTLP/JSON `Span`. Ids are lowercase hex (32 / 16 characters); times are Unix nanoseconds as decimal strings. */
export interface DcdrOtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceState?: string;
  name: string;
  /** `SpanKind`: 1 internal, 2 server, 3 client, 4 producer, 5 consumer. */
  kind?: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: DcdrOtlpKeyValue[];
  events?: DcdrOtlpSpanEvent[];
  links?: DcdrOtlpSpanLink[];
  status?: DcdrOtlpSpanStatus;
  flags?: number;
}

/** OTLP/JSON `ScopeSpans`. */
export interface DcdrOtlpScopeSpans {
  scope?: DcdrOtlpScope;
  spans: DcdrOtlpSpan[];
  schemaUrl?: string;
}

/** OTLP/JSON `ResourceSpans`. */
export interface DcdrOtlpResourceSpans {
  resource?: DcdrOtlpResource;
  scopeSpans: DcdrOtlpScopeSpans[];
  schemaUrl?: string;
}

/** OTLP/JSON `ExportTraceServiceRequest` (body of `POST /v1/traces`). */
export interface DcdrOtlpExportTraceServiceRequest {
  resourceSpans: DcdrOtlpResourceSpans[];
}

/** OTLP/JSON `LogRecord`. */
export interface DcdrOtlpLogRecord {
  timeUnixNano?: string;
  observedTimeUnixNano?: string;
  severityNumber?: number;
  severityText?: string;
  body?: DcdrOtlpAnyValue;
  attributes?: DcdrOtlpKeyValue[];
  traceId?: string;
  spanId?: string;
  /** GenAI event name (`gen_ai.client.inference.operation.details`, `gen_ai.user.message`...). */
  eventName?: string;
  flags?: number;
}

/** OTLP/JSON `ScopeLogs`. */
export interface DcdrOtlpScopeLogs {
  scope?: DcdrOtlpScope;
  logRecords: DcdrOtlpLogRecord[];
  schemaUrl?: string;
}

/** OTLP/JSON `ResourceLogs`. */
export interface DcdrOtlpResourceLogs {
  resource?: DcdrOtlpResource;
  scopeLogs: DcdrOtlpScopeLogs[];
  schemaUrl?: string;
}

/** OTLP/JSON `ExportLogsServiceRequest` (body of `POST /v1/logs`). */
export interface DcdrOtlpExportLogsServiceRequest {
  resourceLogs: DcdrOtlpResourceLogs[];
}

/** Wire format of a raw OTLP body. */
export enum DcdrOtlpContentType {
  PROTOBUF = "application/x-protobuf",
  JSON = "application/json",
}

/** Compression already applied to a raw OTLP body. */
export enum DcdrOtlpContentEncoding {
  GZIP = "gzip",
  DEFLATE = "deflate",
}

/**
 * A pre-encoded OTLP body (for example the bytes an OpenTelemetry exporter produced), sent as is.
 */
export interface DcdrOtlpRawBody {
  body: Uint8Array;
  contentType: DcdrOtlpContentType;
  /** Set when `body` is already compressed. */
  contentEncoding?: DcdrOtlpContentEncoding;
}

/** Options of a telemetry export. */
export interface DcdrTelemetryExportOptions {
  /** Gzip the body before sending (needs `CompressionStream`, present in Node 18+ and current browsers). */
  gzip?: boolean;
  /** Overrides the client's timeout for this call. */
  timeoutMs?: number;
}

/** OTLP `partial_success`: what the runtime rejected or dropped (absent on a full success). */
export interface DcdrTelemetryPartialSuccess {
  /** Spans rejected (`/v1/traces`). */
  rejectedSpans?: number;
  /** Log records rejected (`/v1/logs`). */
  rejectedLogRecords?: number;
  /** Developer-facing message (also used for warnings, e.g. non-GenAI spans dropped). */
  errorMessage?: string;
}

/** Result of a telemetry export (HTTP 200). Failures throw {@link DcdrRuntimeError}. */
export interface DcdrTelemetryExportResult {
  status: number;
  partialSuccess?: DcdrTelemetryPartialSuccess;
}

/** Options of {@link buildTelemetryTestTracesRequest} / {@link DcdrRuntimeClient.telemetryTest}. */
export interface DcdrTelemetryTestOptions {
  /** `service.name` of the synthetic span (default `dcdr-telemetry-test`). */
  serviceName?: string;
  /** `deployment.environment.name`. */
  environment?: string;
  /** `service.version`. */
  serviceVersion?: string;
  /** Span start (ms); defaults to now. */
  nowMs?: number;
  /** 32 lowercase hex characters; random by default. */
  traceId?: string;
  /** 16 lowercase hex characters; random by default. */
  spanId?: string;
}

/** Result of {@link DcdrRuntimeClient.telemetryTest}. */
export interface DcdrTelemetryTestResult extends DcdrTelemetryExportResult {
  traceId: string;
  spanId: string;
  serviceName: string;
}

/** Default `service.name` of the synthetic test span. */
export const DCDR_TELEMETRY_TEST_SERVICE_NAME = "dcdr-telemetry-test";

/**
 * Default origin of the OpenTelemetry receivers (`POST /v1/traces`, `POST /v1/logs`) on DCDR Cloud.
 *
 * {@link DcdrRuntimeClient} sends its telemetry exports here when it was given neither
 * {@link DcdrRuntimeClientConfig.telemetryUrl} nor {@link DcdrRuntimeClientConfig.baseUrl}. An install
 * keeps its telemetry on its own runtime host: pass its `baseUrl` (or `telemetryUrl`).
 *
 * @since 3.25.1
 * @public
 */
export const DCDR_DEFAULT_TELEMETRY_URL = "https://telemetry.dcdr.ai";

/**
 * Builds one synthetic GenAI span with no content (a `chat` call on the OpenTelemetry GenAI conventions:
 * provider, model, token counts), to check a telemetry setup end to end: onboarding live checks,
 * `dcdr telemetry-test`, support.
 *
 * @param options service identity, clock and ids
 * @returns an OTLP/JSON `ExportTraceServiceRequest` with one span
 */
export function buildTelemetryTestTracesRequest(options: DcdrTelemetryTestOptions = {}): DcdrOtlpExportTraceServiceRequest {
  const nowMs = typeof options.nowMs === "number" && Number.isFinite(options.nowMs) ? Math.floor(options.nowMs) : Date.now();
  const startNs = (BigInt(nowMs) * BigInt(1_000_000)).toString();
  const endNs = (BigInt(nowMs + 250) * BigInt(1_000_000)).toString();
  const resource: DcdrOtlpKeyValue[] = [{ key: "service.name", value: { stringValue: options.serviceName || DCDR_TELEMETRY_TEST_SERVICE_NAME } }];
  if (options.environment) resource.push({ key: "deployment.environment.name", value: { stringValue: options.environment } });
  if (options.serviceVersion) resource.push({ key: "service.version", value: { stringValue: options.serviceVersion } });
  return {
    resourceSpans: [
      {
        resource: { attributes: resource },
        scopeSpans: [
          {
            scope: { name: "dcdr.telemetry-test", version: "1" },
            spans: [
              {
                traceId: options.traceId ?? randomHex(16),
                spanId: options.spanId ?? randomHex(8),
                name: "chat dcdr-telemetry-test",
                kind: 3,
                startTimeUnixNano: startNs,
                endTimeUnixNano: endNs,
                attributes: [
                  { key: "gen_ai.operation.name", value: { stringValue: "chat" } },
                  { key: "gen_ai.provider.name", value: { stringValue: "openai" } },
                  { key: "gen_ai.request.model", value: { stringValue: "dcdr-telemetry-test" } },
                  { key: "gen_ai.usage.input_tokens", value: { intValue: "1" } },
                  { key: "gen_ai.usage.output_tokens", value: { intValue: "1" } },
                ],
                status: { code: 1 },
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Configuration for `DcdrRuntimeClient`.
 */
export interface DcdrRuntimeClientConfig {
  /**
   * Base URL for the runtime, e.g. `https://dcdr.my-company.com`.
   *
   * Defaults to `https://runtime.dcdr.ai` when omitted.
   */
  baseUrl?: string;

  /**
   * Origin of the OpenTelemetry receivers used by `exportTelemetryTraces`, `exportTelemetryLogs` and
   * `telemetryTest`, e.g. `https://telemetry.dcdr.ai`. Every other method uses {@link DcdrRuntimeClientConfig.baseUrl}.
   *
   * Resolution: this field when set; otherwise `baseUrl` when one was given (an install serves its
   * receivers on its own runtime host); otherwise {@link DCDR_DEFAULT_TELEMETRY_URL}. Trimmed, trailing
   * slash removed; a blank value is a `CONFIGURATION` error at construction.
   *
   * @since 3.25.1
   */
  telemetryUrl?: string;

  /** Customer-mode auth: backend-issued DcdrSessionToken. */
  bearerToken?: string;

  /** Internal-mode auth: runtime API token (dev/ops/backplane). */
  apiToken?: string;

  /** Optional session bypass token (only when server explicitly allows it). */
  sessionBypassToken?: string;

  /** Optional request timeout; defaults to 10 seconds. */
  timeoutMs?: number;

  /** Optional additional headers to send on all requests. */
  extraHeaders?: Record<string, string>;

  /**
   * Optional `fetch` implementation.
   * Useful for tests or non-standard runtimes.
   */
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;
}

interface RequestJsonArgs {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: object;
  timeoutMs: number;
}

interface RequestTextArgs {
  method: "GET";
  path: string;
  timeoutMs: number;
}

/**
 * Why a call through {@link DcdrRuntimeClient} failed, as far as the transport can tell.
 *
 * Deliberately the same vocabulary as `DcdrWorkflowErrorCode`, so an application that talks to both
 * halves of DCDR branches on one set of names. It answers "can I retry, is it my token, is it them",
 * which is a different question from **why the execution itself failed**: that is
 * {@link DcdrRuntimeError.executionCode}, the runtime's own {@link ExecutionErrorCode}, and the one
 * worth showing a person.
 *
 * @public
 */
export enum DcdrRuntimeErrorCode {
  /** No token, an invalid one, or one without the scope this call needs. */
  UNAUTHORIZED = "UNAUTHORIZED",
  /** Authenticated, but not allowed to do this. */
  FORBIDDEN = "FORBIDDEN",
  /** No such intent, asset or route - or none this token may see. */
  NOT_FOUND = "NOT_FOUND",
  /** The request was refused as malformed; `details` carries what the runtime said. */
  VALIDATION = "VALIDATION",
  /** The tenant's plan does not cover this call. */
  PAYMENT_REQUIRED = "PAYMENT_REQUIRED",
  /** A provider, tenant or service-token limit refused the call; retry later. */
  RATE_LIMITED = "RATE_LIMITED",
  /** The runtime, or a provider behind it, failed. */
  SERVER_ERROR = "SERVER_ERROR",
  /** The client's own timeout fired before a response arrived. */
  TIMEOUT = "TIMEOUT",
  /** The caller's `AbortSignal` fired. */
  CANCELLED = "CANCELLED",
  /** The transport failed before a response arrived. */
  NETWORK = "NETWORK",
  /** A response the client could not read as the documented shape. */
  UNEXPECTED_RESPONSE = "UNEXPECTED_RESPONSE",
  /** The client is misconfigured (no base URL, no `fetch`, two auth modes at once). */
  CONFIGURATION = "CONFIGURATION",
}

/**
 * Narrows a string to a known {@link DcdrRuntimeErrorCode}.
 *
 * @param value Candidate.
 * @returns Whether it is one of the codes.
 */
export function isDcdrRuntimeErrorCode(
  value: unknown,
): value is DcdrRuntimeErrorCode {
  return (Object.values(DcdrRuntimeErrorCode) as string[]).includes(
    String(value),
  );
}

/**
 * A failed {@link DcdrRuntimeClient} call, with everything known about it in fields instead of in
 * the message.
 *
 * @remarks
 * The message is unchanged from the plain `Error` this replaced in 3.15.0, so anything already
 * matching on it keeps working; the fields are what new code should read.
 *
 * @public
 */
export class DcdrRuntimeError extends Error {
  /** Stable transport-level failure code. */
  readonly code: DcdrRuntimeErrorCode;
  /**
   * The runtime's own error code, recovered from the response body, or `null` when the body carried
   * none (a proxy's HTML, a 404 from outside the runtime, a client-side failure).
   */
  readonly executionCode: ExecutionErrorCode | null;
  /** HTTP status, or `null` for a client-side failure (timeout, abort, transport, config). */
  readonly status: number | null;
  /** HTTP method, or `null` when the failure happened before a request (config). */
  readonly method: string | null;
  /** Request path, or `null` when the failure happened before a request (config). */
  readonly path: string | null;
  /** The error payload the runtime sent, parsed, when it sent JSON. */
  readonly details: unknown;
  /** Bounded preview of the response body. */
  readonly bodyPreview: string | null;
  /** `Retry-After` in seconds, when the runtime sent one. */
  readonly retryAfterSeconds: number | null;

  /**
   * @param args Everything known about the failure where it was detected.
   */
  constructor(args: {
    code: DcdrRuntimeErrorCode;
    message: string;
    method?: string | null;
    path?: string | null;
    status?: number | null;
    executionCode?: ExecutionErrorCode | null;
    details?: unknown;
    bodyPreview?: string | null;
    retryAfterSeconds?: number | null;
    cause?: unknown;
  }) {
    super(args.message, args.cause === undefined ? undefined : { cause: args.cause });
    this.name = "DcdrRuntimeError";
    this.code = args.code;
    this.executionCode = args.executionCode ?? null;
    this.status = args.status ?? null;
    this.method = args.method ?? null;
    this.path = args.path ?? null;
    this.details = args.details ?? null;
    this.bodyPreview = args.bodyPreview ?? null;
    this.retryAfterSeconds = args.retryAfterSeconds ?? null;
  }
}

/**
 * Narrows an unknown thrown value to a {@link DcdrRuntimeError}.
 *
 * @remarks
 * By shape as well as by `instanceof`, on purpose: two copies of `@dcdr/contracts` in one dependency
 * tree have two distinct classes, and `instanceof` then fails on an error that is one in every way
 * that matters.
 *
 * @param value Thrown value.
 * @returns Whether it is a runtime client error.
 */
export function isDcdrRuntimeError(value: unknown): value is DcdrRuntimeError {
  if (value instanceof DcdrRuntimeError) return true;
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { name?: unknown; code?: unknown };
  return (
    candidate.name === "DcdrRuntimeError" && isDcdrRuntimeErrorCode(candidate.code)
  );
}

/**
 * HTTP client for interacting with the DCDR Runtime REST API.
 *
 * @remarks
 * `DcdrRuntimeClient` wraps a `fetch` implementation and provides typed convenience methods for common runtime endpoints
 * (execution, system info, health, metrics, circuit breaker inspection/reset). It supports request timeouts via
 * {@link AbortController} and can be configured with additional headers.
 *
 * This client is intentionally small and dependency-free:
 * - It does not attempt retries or circuit breaking (those are runtime concerns).
 * - It does not validate payload schemas beyond basic response shape parsing.
 *
 * ## Authentication
 * Exactly one of the following auth modes should be used:
 * - **Bearer token**: sets `Authorization: Bearer <token>`
 * - **API token**: sets `token: <token>` and optionally `x-session-bypass: <token>` when `sessionBypassToken` is provided
 *
 * If both `bearerToken` and `apiToken` are provided, construction throws.
 *
 * ## Timeouts
 * Requests are aborted after `timeoutMs` (default: `10_000`) using `AbortController`.
 *
 * ## Error behavior
 * - Non-OK HTTP responses throw an {@link Error} including method, path, status, and a short body preview.
 * - JSON endpoints require `content-type: application/json` (runtime should set this).
 * - Abort/timeout failures surface as a thrown {@link Error} from the underlying `fetch` implementation.
 *
 * ## Version / build info
 * The {@link DcdrRuntimeClient.version} method calls `GET /api/system/version` and returns a {@link DcdrRuntimeVersionResponse}
 * intended for support diagnostics (build number/date/SHA and, in runtime mode only, node version + uptime).
 *
 * @example
 * ```ts
 * // Customer mode (cloud)
 * const client = new DcdrRuntimeClient({
 *   bearerToken: process.env.DCDR_SESSION_TOKEN,
 * });
 *
 * const hc = await client.healthcheck();
 * const res = await client.executeIntent("MY_INTENT", { vars: { name: "Ada" } });
 * const ver = await client.version();
 * ```
 *
 * @example
 * ```ts
 * // Internal mode (dev/ops)
 * const client = new DcdrRuntimeClient({
 *   baseUrl: "http://localhost:8000",
 *   apiToken: "dev-token",
 *   sessionBypassToken: "bypass-token",
 * });
 *
 * const ver = await client.version();
 * ```
 *
 * @public
 */
export class DcdrRuntimeClient {
  private readonly baseUrl: string;
  /** Origin of the OTLP receivers (`/v1/traces`, `/v1/logs`); see {@link DcdrRuntimeClientConfig.telemetryUrl}. */
  private readonly telemetryUrl: string;
  private readonly bearerToken?: string;
  private readonly apiToken?: string;
  private readonly sessionBypassToken?: string;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;
  private readonly fetchFn: (
    input: string,
    init?: RequestInit,
  ) => Promise<Response>;

  /**
   * Creates a new runtime client.
   * @param cfg Client configuration.
   */
  constructor(cfg: DcdrRuntimeClientConfig) {
    const resolvedBaseUrl = cfg?.baseUrl ?? "https://runtime.dcdr.ai";
    const resolvedBaseUrlTrimmed = String(resolvedBaseUrl).trim();
    if (!resolvedBaseUrlTrimmed) {
      throw new DcdrRuntimeError({
        code: DcdrRuntimeErrorCode.CONFIGURATION,
        message:
          "DcdrRuntimeClient requires baseUrl (or omit it to use https://runtime.dcdr.ai)",
      });
    }

    this.baseUrl = resolvedBaseUrlTrimmed.replace(/\/$/, "");

    // Telemetry origin: explicit telemetryUrl > the given baseUrl (an install serves its receivers on its
    // own runtime host) > DCDR Cloud's telemetry host. Only an explicit blank telemetryUrl is an error.
    if (cfg?.telemetryUrl != null) {
      const telemetryUrlTrimmed = String(cfg.telemetryUrl).trim();
      if (!telemetryUrlTrimmed) {
        throw new DcdrRuntimeError({
          code: DcdrRuntimeErrorCode.CONFIGURATION,
          message: `DcdrRuntimeClient telemetryUrl is blank (omit it to use baseUrl or ${DCDR_DEFAULT_TELEMETRY_URL})`,
        });
      }
      this.telemetryUrl = telemetryUrlTrimmed.replace(/\/$/, "");
    } else {
      this.telemetryUrl = cfg?.baseUrl != null ? this.baseUrl : DCDR_DEFAULT_TELEMETRY_URL;
    }

    this.bearerToken = cfg.bearerToken
      ? String(cfg.bearerToken).trim()
      : undefined;
    this.apiToken = cfg.apiToken ? String(cfg.apiToken).trim() : undefined;
    this.sessionBypassToken = cfg.sessionBypassToken
      ? String(cfg.sessionBypassToken).trim()
      : undefined;
    this.timeoutMs =
      typeof cfg.timeoutMs === "number" && cfg.timeoutMs > 0
        ? cfg.timeoutMs
        : 10_000;
    this.extraHeaders = cfg.extraHeaders ? { ...cfg.extraHeaders } : {};

    const f =
      cfg.fetchFn ??
      (globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined);
    if (!f) {
      throw new DcdrRuntimeError({
        code: DcdrRuntimeErrorCode.CONFIGURATION,
        message:
          "DcdrRuntimeClient requires a fetch implementation (global fetch missing)",
      });
    }
    this.fetchFn = f;

    // Basic config validation: do not silently pick an auth mode.
    if (this.bearerToken && this.apiToken) {
      throw new DcdrRuntimeError({
        code: DcdrRuntimeErrorCode.CONFIGURATION,
        message:
          "DcdrRuntimeClient config should not set both bearerToken and apiToken",
      });
    }
  }

  /**
   * Calls `POST /api/execution/run/:intent`.
   * @param intent Intent name.
   * @param request Execute request payload.
   * @returns Execution result.
   */
  async executeIntent(
    intent: string,
    request: ExecuteIntentRequest,
  ): Promise<ExecuteIntentResponse> {
    const safeIntent = encodeURIComponent(String(intent ?? "").trim());
    return this.requestJson<ExecuteIntentResponse>({
      method: "POST",
      path: `/api/execution/run/${safeIntent}`,
      body: request ?? {},
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `POST /api/assets/upload`.
   *
   * Notes
   * - Cloud-only managed feature.
   * - When `storageId` is omitted, runtime resolves the tenant default storage.
   * - Retention (DCDR-managed storage): an asset is kept while something in the platform references it, and at
   *   least for a grace period after the upload (7 days by default). One that nothing references is deleted after
   *   that, so an `assetPath` kept only on the caller's side must not be relied on beyond it. See `docs/CLIENT.md`.
   */
  async uploadAsset(
    request: DcdrRuntimeAssetUploadInput,
  ): Promise<DcdrAssetUploadResponse> {
    return this.requestJson<DcdrAssetUploadResponse>({
      method: "POST",
      path: "/api/assets/upload",
      body: prepareAssetUploadRequest(request),
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `GET /api/assets?assetPath=...&storageId=...`.
   */
  async getAsset(request: DcdrAssetGetRequest): Promise<DcdrAssetGetResponse> {
    const query = this.buildAssetQuery(request.assetPath, request.storageId);
    return this.requestJson<DcdrAssetGetResponse>({
      method: "GET",
      path: `/api/assets${query}`,
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `DELETE /api/assets?assetPath=...&storageId=...`.
   */
  async deleteAsset(
    request: DcdrAssetDeleteRequest,
  ): Promise<DcdrAssetDeleteResponse> {
    const query = this.buildAssetQuery(request.assetPath, request.storageId);
    return this.requestJson<DcdrAssetDeleteResponse>({
      method: "DELETE",
      path: `/api/assets${query}`,
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `POST /api/execution/stream/:intent` and yields SSE events.
   *
   * Notes
   * - The streaming endpoint is additive; `executeIntent()` remains the stable JSON path.
   * - Yields `meta`, zero or more `delta`, then `final` (or `error`). Providers without native
   *   streaming may yield zero `delta` events.
   * - Structured intents (3.19.0): `meta.data.structured` is `true` and each delta carries decoded
   *   text of one string field plus its `path`; every delta names its `attempt`, and a higher
   *   `attempt` means earlier text is discarded. Event payloads are passed through as received.
   *
   * @param intent Intent name.
   * @param request Execute request payload.
   * @param opts Streaming options (timeout/signal).
   */
  async *executeIntentStream(
    intent: string,
    request: ExecuteIntentRequest,
    opts?: DcdrRuntimeClientStreamOptions,
  ): AsyncGenerator<
    | ExecutionStreamMetaEvent
    | ExecutionStreamDeltaEvent
    | ExecutionStreamFinalEvent
    | ExecutionStreamErrorEvent,
    void,
    void
  > {
    const safeIntent = encodeURIComponent(String(intent ?? "").trim());
    const url = `${this.baseUrl}/api/execution/stream/${safeIntent}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...this.extraHeaders,
    };

    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`;
    } else if (this.apiToken) {
      headers["token"] = this.apiToken;
      if (this.sessionBypassToken) {
        headers["x-session-bypass"] = this.sessionBypassToken;
      }
    }

    const controller = new AbortController();
    const timeoutMs =
      typeof opts?.timeoutMs === "number" && opts.timeoutMs > 0
        ? opts.timeoutMs
        : this.timeoutMs;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const onAbort = () => controller.abort();
    if (opts?.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener("abort", onAbort);
    }

    try {
      let resp: Response;
      try {
        resp = await this.fetchFn(url, {
          method: "POST",
          headers,
          body: JSON.stringify(request ?? {}),
          signal: controller.signal,
        });
      } catch (e) {
        throw buildTransportError({
          error: e,
          method: "POST",
          path: "/api/execution/stream/:intent",
          timeoutMs,
          timedOut,
          cancelled: Boolean(opts?.signal?.aborted),
        });
      }

      if (!resp.ok) {
        const text = await resp.text();
        throw buildRuntimeHttpError({
          method: "POST",
          path: "/api/execution/stream/:intent",
          status: resp.status,
          text,
          headers: resp.headers,
        });
      }

      const ct = resp.headers.get("content-type") ?? "";
      if (!/text\/event-stream/i.test(ct)) {
        const text = await resp.text();
        const preview = buildBodyPreview(text);
        throw new DcdrRuntimeError({
          code: DcdrRuntimeErrorCode.UNEXPECTED_RESPONSE,
          message: `DcdrRuntimeClient expected text/event-stream but got content-type='${ct}' body=${preview}`,
          method: "POST",
          path: "/api/execution/stream/:intent",
          status: resp.status,
          bodyPreview: preview,
        });
      }

      if (!resp.body) {
        throw new DcdrRuntimeError({
          code: DcdrRuntimeErrorCode.UNEXPECTED_RESPONSE,
          message: "DcdrRuntimeClient streaming response body is missing",
          method: "POST",
          path: "/api/execution/stream/:intent",
          status: resp.status,
        });
      }

      for await (const evt of this.parseSseStream(resp.body)) {
        const eventName = evt.event;
        const json = evt.data ? JSON.parse(evt.data) : {};

        if (eventName === ExecutionStreamEventType.META) {
          yield {
            type: ExecutionStreamEventType.META,
            data: json,
          } as ExecutionStreamMetaEvent;
        } else if (eventName === ExecutionStreamEventType.DELTA) {
          yield {
            type: ExecutionStreamEventType.DELTA,
            data: json,
          } as ExecutionStreamDeltaEvent;
        } else if (eventName === ExecutionStreamEventType.FINAL) {
          yield {
            type: ExecutionStreamEventType.FINAL,
            data: json,
          } as ExecutionStreamFinalEvent;
          return;
        } else if (eventName === ExecutionStreamEventType.ERROR) {
          yield {
            type: ExecutionStreamEventType.ERROR,
            data: json,
          } as ExecutionStreamErrorEvent;
          return;
        }
      }
    } finally {
      clearTimeout(timeout);
      if (opts?.signal) opts.signal.removeEventListener("abort", onAbort);
    }
  }

  /**
   * Parses a ReadableStream of SSE bytes into discrete `{event,data}` frames.
   */
  private async *parseSseStream(
    body: ReadableStream<Uint8Array>,
  ): AsyncGenerator<ParsedSseEvent, void, void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const idx = buffer.indexOf("\n\n");
        if (idx < 0) break;

        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        const parsed = this.parseSseEvent(raw);
        if (parsed) yield parsed;
      }
    }

    // Flush remaining bytes.
    buffer += decoder.decode();
    const remaining = buffer.trim();
    if (remaining) {
      const parsed = this.parseSseEvent(remaining);
      if (parsed) yield parsed;
    }
  }

  /**
   * Parses a single SSE event frame.
   */
  private parseSseEvent(raw: string): ParsedSseEvent | null {
    const lines = raw.split("\n");
    let event = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      const l = line.trimEnd();
      if (!l) continue;
      if (l.startsWith(":")) continue; // comment/heartbeat

      if (l.startsWith("event:")) {
        event = l.slice("event:".length).trim();
        continue;
      }

      if (l.startsWith("data:")) {
        dataLines.push(l.slice("data:".length).trim());
        continue;
      }
    }

    const data = dataLines.join("\n");
    if (!event && !data) return null;
    return { event, data };
  }

  /**
   * Calls `POST /api/execution/demo/:intent`.
   * @param intent Demo intent (e.g. `DCDR_LOCAL_DEMO`).
   * @param request Execute request payload.
   * @returns Execution result.
   */
  async demo(
    intent: string,
    request: ExecuteIntentRequest,
  ): Promise<ExecuteIntentResponse> {
    const safeIntent = encodeURIComponent(String(intent ?? "").trim());
    return this.requestJson<ExecuteIntentResponse>({
      method: "POST",
      path: `/api/execution/demo/${safeIntent}`,
      body: request ?? {},
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `GET /api/system/healthcheck`.
   * @returns Healthcheck response.
   */
  async healthcheck(): Promise<DcdrRuntimeHealthcheckResponse> {
    return this.requestJson<DcdrRuntimeHealthcheckResponse>({
      method: "GET",
      path: "/api/system/healthcheck",
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `GET /api/system/version`.
   * @returns Runtime version/build info.
   */
  async version(): Promise<DcdrRuntimeVersionResponse> {
    return this.requestJson<DcdrRuntimeVersionResponse>({
      method: "GET",
      path: "/api/system/version",
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `GET /api/system/metrics`.
   * Returns the raw Prometheus exposition format text.
   *
   * @param token Optional metrics query token (`?token=...`) when the runtime is configured to require it.
   * @returns Metrics text.
   */
  async metrics(token?: string): Promise<string> {
    const t = String(token ?? "").trim();
    const qp = t ? `?token=${encodeURIComponent(t)}` : "";
    return this.requestText({
      method: "GET",
      path: `/api/system/metrics${qp}`,
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `GET /api/auth/check`.
   *
   * Notes
   * - This endpoint is intended for customer integrations to verify their auth configuration.
   * - It performs the same validation path as execution calls, but does not execute an Intent.
   */
  async authCheck(): Promise<DcdrRuntimeAuthCheckResponse> {
    return this.requestJson({
      method: "GET",
      path: "/api/auth/check",
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `POST /api/execution/dry-run/:intent`.
   * @param intent Intent name.
   * @param request Execute request payload.
   * @returns Dry-run response.
   */
  async dryRun(
    intent: string,
    request: ExecuteIntentRequest,
  ): Promise<DcdrRuntimeDryRunResponse> {
    const safeIntent = encodeURIComponent(String(intent ?? "").trim());

    return this.requestJson<DcdrRuntimeDryRunResponse>({
      method: "POST",
      path: `/api/execution/dry-run/${safeIntent}`,
      body: request ?? {},
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `POST /api/execution/eval/:intent`.
   *
   * Notes
   * - Eval is disabled in freeware runtime mode (`--registry`).
   *
   * @param intent Intent name.
   * @param request Eval request payload.
   * @returns Eval response.
   */
  async eval(
    intent: string,
    request: ExecuteIntentEvalRequest,
  ): Promise<ExecuteIntentEvalResponse> {
    const safeIntent = encodeURIComponent(String(intent ?? "").trim());
    return this.requestJson<ExecuteIntentEvalResponse>({
      method: "POST",
      path: `/api/execution/eval/${safeIntent}`,
      body: request,
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `GET /api/execution/circuit-breakers?provider=...&model=...`.
   *
   * Notes
   * - Breakers are tenant-scoped server-side based on auth.
   * - In internal mode, you may optionally pass `tenantCid` to inspect a specific tenant.
   *
   * @param provider Provider name.
   * @param model Optional model.
   * @param tenantCid Optional tenant/customer identifier (internal mode only).
   * @returns Circuit breaker snapshot.
   */
  async circuitBreakerStatus(
    provider: string,
    model?: string,
    tenantCid?: string,
  ): Promise<DcdrRuntimeCircuitBreakerStatusSnapshot> {
    const safeProvider = encodeURIComponent(String(provider ?? "").trim());
    const safeModel = model ? encodeURIComponent(String(model).trim()) : "";
    const safeTenant = tenantCid
      ? encodeURIComponent(String(tenantCid).trim())
      : "";
    const qp: string[] = [];
    if (safeTenant) qp.push(`tenantCid=${safeTenant}`);
    qp.push(`provider=${safeProvider}`);
    if (safeModel) qp.push(`model=${safeModel}`);
    const query = `?${qp.join("&")}`;

    return this.requestJson<DcdrRuntimeCircuitBreakerStatusSnapshot>({
      method: "GET",
      path: `/api/execution/circuit-breakers${query}`,
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `PUT /api/execution/circuit-breakers/reset`.
   *
   * Notes
   * - Internal-only endpoint.
   * - Breakers are tenant-scoped server-side.
   * - In internal mode, you may optionally pass `tenantCid` to reset a specific tenant.
   *
   * @param provider Provider name.
   * @param model Optional model.
   * @param tenantCid Optional tenant/customer identifier (internal mode only).
   * @returns Reset operation result.
   */
  async resetCircuitBreaker(
    provider: string,
    model?: string,
    tenantCid?: string,
  ): Promise<DcdrRuntimeCircuitBreakerResetResponse> {
    return this.requestJson<DcdrRuntimeCircuitBreakerResetResponse>({
      method: "PUT",
      path: "/api/execution/circuit-breakers/reset",
      body: {
        tenantCid: tenantCid ? String(tenantCid).trim() : undefined,
        provider: String(provider ?? "").trim(),
        model: model ? String(model).trim() : undefined,
      },
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `POST /v1/traces`: exports OpenTelemetry spans (OTLP/HTTP) as an external AI app would.
   *
   * @remarks
   * - Host: the telemetry origin, not `baseUrl` (see {@link DcdrRuntimeClientConfig.telemetryUrl}): an
   *   explicit `telemetryUrl`, else the `baseUrl` given, else {@link DCDR_DEFAULT_TELEMETRY_URL} (since 3.25.1).
   * - Auth: the configured `bearerToken` must be a service token with scope `traces:write`; without one the
   *   call throws `CONFIGURATION` before any request (the receivers accept no other credential).
   * - `request` is OTLP/JSON, or a pre-encoded body ({@link DcdrOtlpRawBody}, protobuf or JSON, compressed
   *   or not) sent as is. `options.gzip` compresses an uncompressed body first.
   * - 200 resolves with `partialSuccess` when the runtime rejected or dropped spans. Failures throw a
   *   {@link DcdrRuntimeError}: 400 / 413 / 415 `VALIDATION`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404
   *   `NOT_FOUND` (telemetry not available in that runtime mode), 429 `RATE_LIMITED` and 503 `SERVER_ERROR`
   *   with `retryAfterSeconds` when the runtime sent `Retry-After`.
   *
   * @param request OTLP/JSON request or raw body
   * @param options compression, timeout
   * @returns the export result
   */
  async exportTelemetryTraces(
    request: DcdrOtlpExportTraceServiceRequest | DcdrOtlpRawBody,
    options: DcdrTelemetryExportOptions = {},
  ): Promise<DcdrTelemetryExportResult> {
    return this.requestOtlp("/v1/traces", request, options);
  }

  /**
   * Calls `POST /v1/logs`: exports OpenTelemetry log records (GenAI events that carry a span's content).
   * Same host (the telemetry origin, see {@link DcdrRuntimeClientConfig.telemetryUrl}), auth, options,
   * result and errors as {@link DcdrRuntimeClient.exportTelemetryTraces}.
   *
   * @param request OTLP/JSON request or raw body
   * @param options compression, timeout
   * @returns the export result
   */
  async exportTelemetryLogs(
    request: DcdrOtlpExportLogsServiceRequest | DcdrOtlpRawBody,
    options: DcdrTelemetryExportOptions = {},
  ): Promise<DcdrTelemetryExportResult> {
    return this.requestOtlp("/v1/logs", request, options);
  }

  /**
   * Sends one synthetic GenAI span (no content, see {@link buildTelemetryTestTracesRequest}) to
   * `POST /v1/traces` and reports the outcome: the end-to-end check of a telemetry setup. Goes to the
   * telemetry origin ({@link DcdrRuntimeClientConfig.telemetryUrl}; {@link DCDR_DEFAULT_TELEMETRY_URL} when
   * neither `telemetryUrl` nor `baseUrl` was given).
   *
   * @param options service identity of the synthetic span, plus export options
   * @returns the export result with the ids of the span sent
   */
  async telemetryTest(options: DcdrTelemetryTestOptions & DcdrTelemetryExportOptions = {}): Promise<DcdrTelemetryTestResult> {
    const request = buildTelemetryTestTracesRequest(options);
    const span = request.resourceSpans[0].scopeSpans[0].spans[0];
    const result = await this.exportTelemetryTraces(request, { gzip: options.gzip, timeoutMs: options.timeoutMs });
    return { ...result, traceId: span.traceId, spanId: span.spanId, serviceName: options.serviceName || DCDR_TELEMETRY_TEST_SERVICE_NAME };
  }

  /**
   * Performs one OTLP/HTTP export to the telemetry origin and reads the `Export*ServiceResponse` (JSON or
   * protobuf).
   *
   * @param path `/v1/traces` or `/v1/logs`
   * @param request OTLP/JSON request or raw body
   * @param options compression, timeout
   * @returns the export result
   * @throws {@link DcdrRuntimeError} for any non-200 answer or transport failure
   */
  private async requestOtlp(
    path: string,
    request: DcdrOtlpExportTraceServiceRequest | DcdrOtlpExportLogsServiceRequest | DcdrOtlpRawBody,
    options: DcdrTelemetryExportOptions,
  ): Promise<DcdrTelemetryExportResult> {
    if (!this.bearerToken) {
      // The receivers accept only `Authorization: Bearer <service token>`; fail before sending anything.
      throw new DcdrRuntimeError({ code: DcdrRuntimeErrorCode.CONFIGURATION, message: "DcdrRuntimeClient telemetry export needs bearerToken (a service token with traces:write)", method: "POST", path });
    }
    const raw = isOtlpRawBody(request);
    let body: Uint8Array = raw ? request.body : new TextEncoder().encode(JSON.stringify(request));
    const contentType = raw ? request.contentType : DcdrOtlpContentType.JSON;
    let contentEncoding = raw ? request.contentEncoding : undefined;
    if (options.gzip && !contentEncoding) {
      body = await gzipBytes(body);
      contentEncoding = DcdrOtlpContentEncoding.GZIP;
    }

    const headers: Record<string, string> = { ...this.extraHeaders, "Content-Type": contentType };
    if (contentEncoding) headers["Content-Encoding"] = contentEncoding;
    headers["Authorization"] = `Bearer ${this.bearerToken}`;

    const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? options.timeoutMs : this.timeoutMs;
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      let resp: Response;
      try {
        resp = await this.fetchFn(`${this.telemetryUrl}${path}`, { method: "POST", headers, body: copyBytes(body), signal: controller.signal });
      } catch (e) {
        throw buildTransportError({ error: e, method: "POST", path, timeoutMs, timedOut, cancelled: false });
      }
      const bytes = new Uint8Array(await resp.arrayBuffer());
      const isProtobuf = /application\/(x-)?protobuf/i.test(resp.headers.get("content-type") ?? "");
      if (!resp.ok) {
        const text = isProtobuf ? JSON.stringify(decodeOtlpStatusProtobuf(bytes)) : new TextDecoder().decode(bytes);
        const error = buildRuntimeHttpError({ method: "POST", path, status: resp.status, text, headers: resp.headers });
        if (resp.status === 413 || resp.status === 415) {
          // OTLP refusals of the request itself (size, wire format): the caller's to fix, not a surprise.
          return Promise.reject(withRuntimeErrorCode(error, DcdrRuntimeErrorCode.VALIDATION));
        }
        throw error;
      }
      const partialSuccess = isProtobuf ? decodeOtlpPartialSuccessProtobuf(bytes, path) : parseOtlpPartialSuccessJson(new TextDecoder().decode(bytes));
      return partialSuccess ? { status: resp.status, partialSuccess } : { status: resp.status };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Performs an HTTP request and parses a JSON response.
   *
   * @remarks
   * - Requires `content-type: application/json` on successful responses.
   * - Allows an empty response body and treats it as `{}` (for endpoints that may return no content).
   * - Applies auth headers based on the configured auth mode.
   * - Aborts the request after `timeoutMs` via {@link AbortController}.
   *
   * @param args Request parameters.
   * @returns Parsed JSON body.
   * @throws {@link Error} If the HTTP response is not OK, if the response is not JSON, or if JSON parsing fails.
   */
  private async requestJson<T>(args: RequestJsonArgs): Promise<T> {
    const url = `${this.baseUrl}${args.path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.extraHeaders,
    };

    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`;
    } else if (this.apiToken) {
      headers["token"] = this.apiToken;
      if (this.sessionBypassToken) {
        headers["x-session-bypass"] = this.sessionBypassToken;
      }
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, args.timeoutMs);

    try {
      let resp: Response;
      try {
        resp = await this.fetchFn(url, {
          method: args.method,
          headers,
          body: args.body ? JSON.stringify(args.body) : undefined,
          signal: controller.signal,
        });
      } catch (e) {
        throw buildTransportError({
          error: e,
          method: args.method,
          path: args.path,
          timeoutMs: args.timeoutMs,
          timedOut,
          cancelled: false,
        });
      }

      const text = await resp.text();
      const isJson = /application\/json/i.test(
        resp.headers.get("content-type") ?? "",
      );

      if (!resp.ok) {
        throw buildRuntimeHttpError({
          method: args.method,
          path: args.path,
          status: resp.status,
          text,
          headers: resp.headers,
        });
      }

      if (!text) {
        // Allow empty body for endpoints that might not return content.
        return JSON.parse("{}") as T;
      }

      if (!isJson) {
        throw new DcdrRuntimeError({
          code: DcdrRuntimeErrorCode.UNEXPECTED_RESPONSE,
          message: `DcdrRuntimeClient expected JSON but got content-type='${resp.headers.get("content-type") ?? ""}'`,
          method: args.method,
          path: args.path,
          status: resp.status,
          bodyPreview: buildBodyPreview(text),
        });
      }

      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Performs an HTTP request and returns the response body as plain text.
   *
   * @remarks
   * Builds the request URL by concatenating {@link DcdrRuntimeClient.baseUrl} with {@link RequestTextArgs.path}.
   * Merges {@link DcdrRuntimeClient.extraHeaders} into the request headers and applies authentication:
   * - If {@link DcdrRuntimeClient.bearerToken} is set, adds an `Authorization: Bearer <token>` header.
   * - Otherwise, if {@link DcdrRuntimeClient.apiToken} is set, adds a `token: <token>` header and, if present,
   *   adds `x-session-bypass: <token>` from {@link DcdrRuntimeClient.sessionBypassToken}.
   *
   * Uses an {@link AbortController} to abort the request after {@link RequestTextArgs.timeoutMs} milliseconds.
   *
   * @param args - Request configuration including method, path, and timeout.
   * @returns The response body as text.
   * @throws {@link Error} If the response status is not OK (`resp.ok === false`). The error message includes the
   * HTTP method, path, status code, and a bounded preview of the response body.
   */
  private async requestText(args: RequestTextArgs): Promise<string> {
    const url = `${this.baseUrl}${args.path}`;

    const headers: Record<string, string> = {
      ...this.extraHeaders,
    };

    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`;
    } else if (this.apiToken) {
      headers["token"] = this.apiToken;
      if (this.sessionBypassToken) {
        headers["x-session-bypass"] = this.sessionBypassToken;
      }
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, args.timeoutMs);

    try {
      let resp: Response;
      try {
        resp = await this.fetchFn(url, {
          method: args.method,
          headers,
          signal: controller.signal,
        });
      } catch (e) {
        throw buildTransportError({
          error: e,
          method: args.method,
          path: args.path,
          timeoutMs: args.timeoutMs,
          timedOut,
          cancelled: false,
        });
      }

      const text = await resp.text();

      if (!resp.ok) {
        throw buildRuntimeHttpError({
          method: args.method,
          path: args.path,
          status: resp.status,
          text,
          headers: resp.headers,
        });
      }

      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Builds a stable query string for asset get/delete operations.
   */
  private buildAssetQuery(assetPath: string, storageId?: string): string {
    const safeAssetPath = encodeURIComponent(String(assetPath ?? "").trim());
    const qp = [`assetPath=${safeAssetPath}`];
    const safeStorageId = String(storageId ?? "").trim();
    if (safeStorageId) {
      qp.push(`storageId=${encodeURIComponent(safeStorageId)}`);
    }

    return `?${qp.join("&")}`;
  }
}

/**
 * Builds a bounded, human-readable body preview string.
 * @param text Full response body text.
 * @returns Preview string capped to {@link ERROR_BODY_PREVIEW_MAX_CHARS}.
 */
/**
 * Reads a JSON error body, if that is what came back.
 *
 * @param text Raw response body.
 * @returns The parsed object, or `null` when it is not one.
 */
function parseErrorBody(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(String(text ?? ""));
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Digs the runtime's own error code out of an error body.
 *
 * @remarks
 * Three shapes are in the wild and all three are the runtime's: the execution envelope
 * (`{ status: "ERROR", error: { code, message } }`), a flat `{ code, error }` from the guards that
 * refuse a call before it runs, and `{ error: "CODE" }`.
 *
 * @param body Parsed error body.
 * @returns The code, or `null` when the body carried none the contracts know.
 */
function extractExecutionErrorCode(
  body: Record<string, unknown> | null,
): ExecutionErrorCode | null {
  if (!body) return null;
  const nested = body["error"];
  const candidates: unknown[] = [
    body["code"],
    typeof nested === "object" && nested !== null
      ? (nested as Record<string, unknown>)["code"]
      : undefined,
    nested,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && isExecutionErrorCode(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Maps a failed response to the client vocabulary.
 *
 * @remarks
 * The runtime's own code wins over the status where it is more precise: a `429` is a provider limit
 * or a service-token limit, and `SERVICE_TOKEN_LIMIT_EXCEEDED` says which without the caller
 * guessing. Otherwise the status decides.
 *
 * @param status HTTP status.
 * @param executionCode The runtime's code, when the body carried one.
 * @returns The transport-level code.
 */
function mapRuntimeErrorCode(
  status: number,
  executionCode: ExecutionErrorCode | null,
): DcdrRuntimeErrorCode {
  switch (executionCode) {
    case ExecutionErrorCode.RATE_LIMIT:
    case ExecutionErrorCode.PROVIDER_LIMIT_EXCEEDED:
    case ExecutionErrorCode.SERVICE_TOKEN_LIMIT_EXCEEDED:
      return DcdrRuntimeErrorCode.RATE_LIMITED;
    case ExecutionErrorCode.PAYMENT_REQUIRED:
      return DcdrRuntimeErrorCode.PAYMENT_REQUIRED;
    case ExecutionErrorCode.TIMEOUT:
      return DcdrRuntimeErrorCode.TIMEOUT;
    default:
      break;
  }

  if (status === 401) return DcdrRuntimeErrorCode.UNAUTHORIZED;
  if (status === 402) return DcdrRuntimeErrorCode.PAYMENT_REQUIRED;
  if (status === 403) return DcdrRuntimeErrorCode.FORBIDDEN;
  if (status === 404) return DcdrRuntimeErrorCode.NOT_FOUND;
  if (status === 408 || status === 504) return DcdrRuntimeErrorCode.TIMEOUT;
  if (status === 400 || status === 422) return DcdrRuntimeErrorCode.VALIDATION;
  if (status === 429) return DcdrRuntimeErrorCode.RATE_LIMITED;
  if (status >= 500) return DcdrRuntimeErrorCode.SERVER_ERROR;
  return DcdrRuntimeErrorCode.UNEXPECTED_RESPONSE;
}

/**
 * Whether an export request is a pre-encoded body.
 * @param request request
 * @returns true for a {@link DcdrOtlpRawBody}
 */
function isOtlpRawBody(
  request: DcdrOtlpExportTraceServiceRequest | DcdrOtlpExportLogsServiceRequest | DcdrOtlpRawBody,
): request is DcdrOtlpRawBody {
  return "body" in request && request.body instanceof Uint8Array;
}

/**
 * Gzips bytes with the platform's `CompressionStream`.
 * @param bytes input
 * @returns compressed bytes
 * @throws {@link DcdrRuntimeError} `CONFIGURATION` when the platform has no `CompressionStream`
 */
async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") {
    throw new DcdrRuntimeError({ code: DcdrRuntimeErrorCode.CONFIGURATION, message: "DcdrRuntimeClient gzip needs CompressionStream (Node 18+ or a current browser)" });
  }
  const stream = new Blob([copyBytes(bytes)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Copies bytes into a fresh `ArrayBuffer`-backed array (what `fetch` and `Blob` are typed to take).
 * @param bytes input
 * @returns copy
 */
function copyBytes(bytes: Uint8Array) {
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  return out;
}

/**
 * Random lowercase hex.
 * @param bytes number of random bytes
 * @returns hex string (twice as long)
 */
function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(b);
  let out = "";
  for (const x of b) out += x.toString(16).padStart(2, "0");
  // An all-zero id is invalid in OTLP.
  return /^0+$/.test(out) ? `${out.slice(0, -1)}1` : out;
}

/**
 * Reads `partialSuccess` from an OTLP/JSON export response.
 * @param text response body
 * @returns partial success, or undefined (empty body, `{}`)
 */
function parseOtlpPartialSuccessJson(text: string): DcdrTelemetryPartialSuccess | undefined {
  if (!text.trim()) return undefined;
  let parsed: { partialSuccess?: { rejectedSpans?: string | number; rejectedLogRecords?: string | number; errorMessage?: string } };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DcdrRuntimeError({ code: DcdrRuntimeErrorCode.UNEXPECTED_RESPONSE, message: "DcdrRuntimeClient expected an OTLP/JSON export response", bodyPreview: buildBodyPreview(text) });
  }
  const ps = parsed?.partialSuccess;
  if (!ps || typeof ps !== "object") return undefined;
  const out: DcdrTelemetryPartialSuccess = {};
  if (ps.rejectedSpans !== undefined) out.rejectedSpans = Number(ps.rejectedSpans);
  if (ps.rejectedLogRecords !== undefined) out.rejectedLogRecords = Number(ps.rejectedLogRecords);
  if (typeof ps.errorMessage === "string" && ps.errorMessage) out.errorMessage = ps.errorMessage;
  return Object.keys(out).length ? out : undefined;
}

/**
 * Reads `partial_success` from a protobuf export response (`field 1 { int64 rejected = 1; string error_message = 2 }`).
 * @param bytes response body
 * @param path request path (traces or logs: which rejected field to fill)
 * @returns partial success, or undefined
 */
function decodeOtlpPartialSuccessProtobuf(bytes: Uint8Array, path: string): DcdrTelemetryPartialSuccess | undefined {
  const outer = readProtoFields(bytes);
  const inner = outer.find((f) => f.field === 1 && f.bytes);
  if (!inner?.bytes) return undefined;
  const out: DcdrTelemetryPartialSuccess = {};
  for (const f of readProtoFields(inner.bytes)) {
    if (f.field === 1 && f.varint !== undefined) {
      if (path.endsWith("/logs")) out.rejectedLogRecords = f.varint;
      else out.rejectedSpans = f.varint;
    }
    if (f.field === 2 && f.bytes) out.errorMessage = new TextDecoder().decode(f.bytes);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Reads a protobuf `google.rpc.Status` (`int32 code = 1; string message = 2`).
 * @param bytes response body
 * @returns code and message
 */
function decodeOtlpStatusProtobuf(bytes: Uint8Array): { code?: number; message?: string } {
  const out: { code?: number; message?: string } = {};
  for (const f of readProtoFields(bytes)) {
    if (f.field === 1 && f.varint !== undefined) out.code = f.varint;
    if (f.field === 2 && f.bytes) out.message = new TextDecoder().decode(f.bytes);
  }
  return out;
}

/** One top-level protobuf field (varint or length-delimited only). */
interface ProtoField {
  field: number;
  varint?: number;
  bytes?: Uint8Array;
}

/**
 * Splits a protobuf message into its top-level varint and length-delimited fields (other wire types end
 * the read). Bounded by the input: never throws.
 * @param bytes message
 * @returns fields
 */
function readProtoFields(bytes: Uint8Array): ProtoField[] {
  const out: ProtoField[] = [];
  let pos = 0;
  const varint = (): number | undefined => {
    let v = 0;
    let mul = 1;
    for (let i = 0; i < 10 && pos < bytes.length; i += 1) {
      const b = bytes[pos++];
      v += (b & 0x7f) * mul;
      if (!(b & 0x80)) return v;
      mul *= 128;
    }
    return undefined;
  };
  while (pos < bytes.length) {
    const tag = varint();
    if (tag === undefined) break;
    const field = Math.floor(tag / 8);
    const wire = tag & 7;
    if (wire === 0) {
      const v = varint();
      if (v === undefined) break;
      out.push({ field, varint: v });
    } else if (wire === 2) {
      const len = varint();
      if (len === undefined || pos + len > bytes.length) break;
      out.push({ field, bytes: bytes.subarray(pos, pos + len) });
      pos += len;
    } else break;
  }
  return out;
}

/**
 * The same error with another transport code (OTLP 413 / 415 are `VALIDATION` for telemetry exports).
 * @param error original
 * @param code code to use
 * @returns new error
 */
function withRuntimeErrorCode(error: DcdrRuntimeError, code: DcdrRuntimeErrorCode): DcdrRuntimeError {
  return new DcdrRuntimeError({
    code,
    message: error.message,
    method: error.method,
    path: error.path,
    status: error.status,
    executionCode: error.executionCode,
    details: error.details,
    bodyPreview: error.bodyPreview,
    retryAfterSeconds: error.retryAfterSeconds,
  });
}

/**
 * Builds the typed error of a non-2xx answer.
 *
 * @remarks
 * The message is the one this client has always produced, character for character, because callers
 * were left no other way to read a failure and some of them parse it.
 *
 * @param args Method, path, status, raw body and response headers.
 * @returns The error to throw.
 */
function buildRuntimeHttpError(args: {
  method: string;
  path: string;
  status: number;
  text: string;
  headers?: Headers;
}): DcdrRuntimeError {
  const body = parseErrorBody(args.text);
  const executionCode = extractExecutionErrorCode(body);
  const retryAfter = Number(args.headers?.get("retry-after") ?? "");

  return new DcdrRuntimeError({
    code: mapRuntimeErrorCode(args.status, executionCode),
    message: `DcdrRuntimeClient request failed: ${args.method} ${args.path} status=${args.status} body=${buildBodyPreview(args.text)}`,
    method: args.method,
    path: args.path,
    status: args.status,
    executionCode,
    details: body,
    bodyPreview: buildBodyPreview(args.text),
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  });
}

/**
 * Tells apart the three ways a `fetch` can reject: our timeout, the caller's abort, or the network.
 *
 * @param args What was being attempted and what the transport threw.
 * @returns The error to throw, carrying the original as `cause`.
 */
function buildTransportError(args: {
  error: unknown;
  method: string;
  path: string;
  timeoutMs: number;
  timedOut: boolean;
  cancelled: boolean;
}): DcdrRuntimeError {
  if (args.timedOut) {
    return new DcdrRuntimeError({
      code: DcdrRuntimeErrorCode.TIMEOUT,
      message: `DcdrRuntimeClient request timed out after ${args.timeoutMs}ms: ${args.method} ${args.path}`,
      method: args.method,
      path: args.path,
      cause: args.error,
    });
  }
  if (args.cancelled) {
    return new DcdrRuntimeError({
      code: DcdrRuntimeErrorCode.CANCELLED,
      message: `DcdrRuntimeClient request was cancelled by the caller: ${args.method} ${args.path}`,
      method: args.method,
      path: args.path,
      cause: args.error,
    });
  }
  const detail = args.error instanceof Error ? args.error.message : String(args.error);
  return new DcdrRuntimeError({
    code: DcdrRuntimeErrorCode.NETWORK,
    message: `DcdrRuntimeClient request failed before a response: ${args.method} ${args.path} (${detail})`,
    method: args.method,
    path: args.path,
    cause: args.error,
  });
}

function buildBodyPreview(text: string): string {
  const t = String(text ?? "");
  return t.length > ERROR_BODY_PREVIEW_MAX_CHARS
    ? t.slice(0, ERROR_BODY_PREVIEW_MAX_CHARS) + "…"
    : t;
}

/**
 * Infers a likely MIME type from a common file extension.
 */
function inferMimeTypeFromAssetName(name?: string): string | undefined {
  const trimmed = normalizeOptionalString(name);
  if (!trimmed) return undefined;

  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot < 0 || lastDot === trimmed.length - 1) return undefined;

  const extension = trimmed
    .slice(lastDot + 1)
    .trim()
    .toLowerCase();
  return EXTENSION_TO_MIME_TYPE[extension];
}

/**
 * Infers the execution part type from MIME type or common file naming.
 */
function inferExecutionPartTypeForAsset(args: {
  mimeType?: string;
  name?: string;
}): ExecutionPartType {
  const mimeType =
    normalizeOptionalString(args.mimeType) ||
    inferMimeTypeFromAssetName(args.name) ||
    DEFAULT_ASSET_UPLOAD_MIME_TYPE;

  if (mimeType.startsWith("image/")) return ExecutionPartType.IMAGE;
  if (mimeType.startsWith("audio/")) return ExecutionPartType.AUDIO;
  if (mimeType.startsWith("video/")) return ExecutionPartType.VIDEO;
  if (mimeType.startsWith("text/")) return ExecutionPartType.TEXT;
  return ExecutionPartType.DOCUMENT;
}

/**
 * Trims optional strings and collapses empty values to `undefined`.
 */
function normalizeOptionalString(
  value: string | undefined,
): string | undefined {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

/**
 * Clones semantic asset metadata so callers can safely reuse their objects.
 */
function cloneAssetMetadata(metadata: DcdrAssetMetadata): DcdrAssetMetadata {
  return {
    title: metadata.title,
    description: metadata.description,
    alt: metadata.alt,
    tags: Array.isArray(metadata.tags) ? [...metadata.tags] : undefined,
    attributes: metadata.attributes ? { ...metadata.attributes } : undefined,
  };
}

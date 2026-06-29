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
      asset: {
        ...input.asset,
        datasource: input.asset.datasource
          ? { ...input.asset.datasource }
          : undefined,
      },
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
      throw new Error(
        "DcdrRuntimeClient requires baseUrl (or omit it to use https://runtime.dcdr.ai)",
      );
    }

    this.baseUrl = resolvedBaseUrlTrimmed.replace(/\/$/, "");
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
      throw new Error(
        "DcdrRuntimeClient requires a fetch implementation (global fetch missing)",
      );
    }
    this.fetchFn = f;

    // Basic config validation: do not silently pick an auth mode.
    if (this.bearerToken && this.apiToken) {
      throw new Error(
        "DcdrRuntimeClient config should not set both bearerToken and apiToken",
      );
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
   * - v1 streams a minimal envelope (`meta` then `final`). Providers without native streaming
   *   may yield zero `delta` events.
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
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const onAbort = () => controller.abort();
    if (opts?.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener("abort", onAbort);
    }

    try {
      const resp = await this.fetchFn(url, {
        method: "POST",
        headers,
        body: JSON.stringify(request ?? {}),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const text = await resp.text();
        const preview = buildBodyPreview(text);
        throw new Error(
          `DcdrRuntimeClient request failed: POST /api/execution/stream/:intent status=${resp.status} body=${preview}`,
        );
      }

      const ct = resp.headers.get("content-type") ?? "";
      if (!/text\/event-stream/i.test(ct)) {
        const text = await resp.text();
        const preview = buildBodyPreview(text);
        throw new Error(
          `DcdrRuntimeClient expected text/event-stream but got content-type='${ct}' body=${preview}`,
        );
      }

      if (!resp.body) {
        throw new Error("DcdrRuntimeClient streaming response body is missing");
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
    const timeout = setTimeout(() => controller.abort(), args.timeoutMs);

    try {
      const resp = await this.fetchFn(url, {
        method: args.method,
        headers,
        body: args.body ? JSON.stringify(args.body) : undefined,
        signal: controller.signal,
      });

      const text = await resp.text();
      const isJson = /application\/json/i.test(
        resp.headers.get("content-type") ?? "",
      );

      if (!resp.ok) {
        const preview = buildBodyPreview(text);
        throw new Error(
          `DcdrRuntimeClient request failed: ${args.method} ${args.path} status=${resp.status} body=${preview}`,
        );
      }

      if (!text) {
        // Allow empty body for endpoints that might not return content.
        return JSON.parse("{}") as T;
      }

      if (!isJson) {
        throw new Error(
          `DcdrRuntimeClient expected JSON but got content-type='${resp.headers.get("content-type") ?? ""}'`,
        );
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
    const timeout = setTimeout(() => controller.abort(), args.timeoutMs);

    try {
      const resp = await this.fetchFn(url, {
        method: args.method,
        headers,
        signal: controller.signal,
      });

      const text = await resp.text();

      if (!resp.ok) {
        const preview = buildBodyPreview(text);
        throw new Error(
          `DcdrRuntimeClient request failed: ${args.method} ${args.path} status=${resp.status} body=${preview}`,
        );
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

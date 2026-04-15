import { ExecuteIntentRequest, ExecuteIntentResponse } from "./execution.contract";

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
 * - Only exposes a small allowlist of diagnostic fields.
 */
export interface DcdrRuntimeVersionResponse {
  buildNumber?: string;
  buildDate?: string;
  gitSha?: string;

  /** Present in runtime mode (--registry). Intentionally omitted in cloud mode. */
  nodeVersion?: string;

  /** Present in runtime mode (--registry). Intentionally omitted in cloud mode. */
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
 * Minimal eval response shape.
 *
 * Notes
 * - Eval is cloud-only; runtime/freeware mode may return a 403 error.
 */
export interface DcdrRuntimeEvalResponse {
  intent: string;
  total: number;
  results: Array<{ ok: boolean }>;
}

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
 * Configuration for `DcdrRuntimeClient`.
 */
export interface DcdrRuntimeClientConfig {
  /** Base URL for the runtime, e.g. `https://dcdr.my-company.com`. */
  baseUrl: string;

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
  method: "GET" | "POST" | "PUT";
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
 * Minimal, strongly-typed client for the Dcdr Runtime HTTP API.
 *
 * Auth modes
 * - Customer mode (cloud): `bearerToken` -> `Authorization: Bearer <token>`
 * - Internal mode (dev/ops): `apiToken` -> `token: <token>` and optional `x-session-bypass`
 */
export class DcdrRuntimeClient {
  private readonly baseUrl: string;
  private readonly bearerToken?: string;
  private readonly apiToken?: string;
  private readonly sessionBypassToken?: string;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;
  private readonly fetchFn: (input: string, init?: RequestInit) => Promise<Response>;

  /**
   * Creates a new runtime client.
   * @param cfg Client configuration.
   */
  constructor(cfg: DcdrRuntimeClientConfig) {
    if (!cfg?.baseUrl) {
      throw new Error("DcdrRuntimeClient requires baseUrl");
    }

    this.baseUrl = String(cfg.baseUrl).replace(/\/$/, "");
    this.bearerToken = cfg.bearerToken ? String(cfg.bearerToken).trim() : undefined;
    this.apiToken = cfg.apiToken ? String(cfg.apiToken).trim() : undefined;
    this.sessionBypassToken = cfg.sessionBypassToken ? String(cfg.sessionBypassToken).trim() : undefined;
    this.timeoutMs = typeof cfg.timeoutMs === "number" && cfg.timeoutMs > 0 ? cfg.timeoutMs : 10_000;
    this.extraHeaders = cfg.extraHeaders ? { ...cfg.extraHeaders } : {};

    const f = cfg.fetchFn ?? (globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined);
    if (!f) {
      throw new Error("DcdrRuntimeClient requires a fetch implementation (global fetch missing)");
    }
    this.fetchFn = f;

    // Basic config validation: do not silently pick an auth mode.
    if (this.bearerToken && this.apiToken) {
      throw new Error("DcdrRuntimeClient config should not set both bearerToken and apiToken");
    }
  }

  /**
   * Calls `POST /api/execution/run/:intent`.
   * @param intent Intent name.
   * @param request Execute request payload.
   * @returns Execution result.
   */
  async executeIntent(intent: string, request: ExecuteIntentRequest): Promise<ExecuteIntentResponse> {
    const safeIntent = encodeURIComponent(String(intent ?? "").trim());
    return this.requestJson<ExecuteIntentResponse>({
      method: "POST",
      path: `/api/execution/run/${safeIntent}`,
      body: request ?? {},
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `POST /api/execution/demo/:intent`.
   * @param intent Demo intent (e.g. `DCDR_LOCAL_DEMO`).
   * @param request Execute request payload.
   * @returns Execution result.
   */
  async demo(intent: string, request: ExecuteIntentRequest): Promise<ExecuteIntentResponse> {
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
   * @returns Metrics text.
   */
  async metrics(): Promise<string> {
    return this.requestText({
      method: "GET",
      path: "/api/system/metrics",
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Calls `POST /api/execution/dry-run/:intent`.
   * @param intent Intent name.
   * @param vars Template variables.
   * @returns Dry-run response.
   */
  async dryRun(intent: string, vars: Record<string, unknown>): Promise<DcdrRuntimeDryRunResponse> {
    const safeIntent = encodeURIComponent(String(intent ?? "").trim());
    return this.requestJson<DcdrRuntimeDryRunResponse>({
      method: "POST",
      path: `/api/execution/dry-run/${safeIntent}`,
      body: { vars: vars ?? {} },
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
   * @param vars Template variables.
   * @returns Eval response.
   */
  async eval(intent: string, vars: Record<string, unknown>): Promise<DcdrRuntimeEvalResponse> {
    const safeIntent = encodeURIComponent(String(intent ?? "").trim());
    return this.requestJson<DcdrRuntimeEvalResponse>({
      method: "POST",
      path: `/api/execution/eval/${safeIntent}`,
      body: { vars: vars ?? {} },
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
   * @returns Circuit breaker snapshot.
   */
  async circuitBreakerStatus(provider: string, model?: string, tenantCid?: string): Promise<DcdrRuntimeCircuitBreakerStatusSnapshot> {
    const safeProvider = encodeURIComponent(String(provider ?? "").trim());
    const safeModel = model ? encodeURIComponent(String(model).trim()) : "";
    const safeTenant = tenantCid ? encodeURIComponent(String(tenantCid).trim()) : "";
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
   * @returns Reset operation result.
   */
  async resetCircuitBreaker(provider: string, model?: string, tenantCid?: string): Promise<DcdrRuntimeCircuitBreakerResetResponse> {
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
   * @param args Request parameters.
   * @returns Parsed JSON body.
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
      const isJson = /application\/json/i.test(resp.headers.get("content-type") ?? "");

      if (!resp.ok) {
        const preview = text.length > 4000 ? text.slice(0, 4000) + "…" : text;
        throw new Error(`DcdrRuntimeClient request failed: ${args.method} ${args.path} status=${resp.status} body=${preview}`);
      }

      if (!text) {
        // Allow empty body for endpoints that might not return content.
        return JSON.parse("{}") as T;
      }

      if (!isJson) {
        throw new Error(`DcdrRuntimeClient expected JSON but got content-type='${resp.headers.get("content-type") ?? ""}'`);
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
   * HTTP method, path, status code, and up to the first 4000 characters of the response body as a preview.
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
        const preview = text.length > 4000 ? text.slice(0, 4000) + "…" : text;
        throw new Error(`DcdrRuntimeClient request failed: ${args.method} ${args.path} status=${resp.status} body=${preview}`);
      }

      return text;
    } finally {
      clearTimeout(timeout);
    }
  }
}


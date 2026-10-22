import {
  ExecutionStreamDeltaEvent,
  ExecutionStreamErrorEvent,
  ExecutionStreamEventType,
  ExecutionStreamMetaEvent,
} from "./execution.contract";
import {
  DCDR_KNOWLEDGE_API_BASE_PATH,
  DcdrKnowledgeAnswerRequest,
  DcdrKnowledgeAnswerResponse,
  DcdrKnowledgeCollectionDetail,
  DcdrKnowledgeCollectionSummary,
  DcdrKnowledgeDocumentDetail,
  DcdrKnowledgeDocumentSummary,
  DcdrKnowledgeErrorCode,
  DcdrKnowledgeSearchRequest,
  DcdrKnowledgeSearchResponse,
  ListKnowledgeCollectionsQuery,
  ListKnowledgeDocumentsQuery,
} from "./knowledge.contract";
import { DcdrServiceTokenScope } from "./service-tokens.contract";
import { WorkflowPage } from "./workflow.client";

/**
 * Tenant knowledge API client (3.20.0): what a customer's own application calls to list, read,
 * search and answer from the knowledge collections configured in the DCDR web UI.
 *
 * It talks to the **control plane** (`/api/dcdr/knowledge/*`) with a managed **service token**, like
 * `DcdrWorkflowClient`, and is composed into `DcdrClient` the same way. It is read-only by design:
 * creating collections and uploading documents stay in the UI.
 *
 * @example
 * ```ts
 * const dcdrClient = new DcdrClient({ bearerToken: process.env.DCDR_SERVICE_TOKEN });
 * const answer = await dcdrClient.answerFromKnowledge({ collections: ["product-sheets"], question });
 * if (answer.refusal) showNoAnswer(answer.refusal);
 * else showAnswer(answer.text, answer.passages.filter((p) => answer.citedChunkIds.includes(p.chunkId)));
 * ```
 */

/** Default control-plane origin. */
export const DCDR_KNOWLEDGE_DEFAULT_BASE_URL = "https://dcdr.ai";

/** Default per-request timeout (ms) for listing, reading and searching. */
export const DCDR_KNOWLEDGE_DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Default timeout (ms) of an answer, streamed or not.
 *
 * Longer than the ordinary one because an answer waits on a model writing prose; for the stream it
 * bounds the **whole** stream, not the gap between events.
 */
export const DCDR_KNOWLEDGE_DEFAULT_ANSWER_TIMEOUT_MS = 120_000;

/** Body previews embedded in error messages are capped at this many characters. */
const ERROR_BODY_PREVIEW_MAX_CHARS = 2_000;

/** Configuration of {@link DcdrKnowledgeClient}. */
export interface DcdrKnowledgeClientConfig {
  /**
   * Control-plane origin, e.g. `https://dcdr.ai`. **Not** the runtime gateway URL.
   */
  baseUrl?: string;
  /**
   * Managed service token, sent as `Authorization: Bearer`.
   *
   * Needs {@link DcdrServiceTokenScope.KNOWLEDGE_READ} to list and read and
   * {@link DcdrServiceTokenScope.KNOWLEDGE_RUN} to search and answer - each **together with** a
   * collection grant (`knowledge:collections:*` or `knowledge:collection:<key>`).
   */
  bearerToken: string;
  /** Per-request timeout for listing, reading and searching; defaults to 15 seconds. */
  timeoutMs?: number;
  /** Timeout of an answer (and of a whole answer stream); defaults to 120 seconds. */
  answerTimeoutMs?: number;
  /** Extra headers sent on every request. */
  extraHeaders?: Record<string, string>;
  /** Optional `fetch` implementation (tests, proxies, non-standard runtimes). */
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;
}

/** Per-call options of the search and answer methods. */
export interface DcdrKnowledgeRequestOptions {
  /** Overrides the client's timeout for this call. */
  timeoutMs?: number;
  /** Cancels the call. */
  signal?: AbortSignal;
}

/** Route builder of the tenant knowledge API, relative to the control-plane origin. */
export interface DcdrKnowledgeRoutes {
  collections(): string;
  collection(idOrKey: string): string;
  documents(idOrKey: string): string;
  document(idOrKey: string, documentId: string): string;
  search(): string;
  answer(): string;
  answerStream(): string;
}

/** Payload of the answer stream's `final` event. */
export interface DcdrKnowledgeAnswerStreamFinalEventData {
  /** The full answer response, refusal included. Authoritative over every delta that preceded it. */
  response: DcdrKnowledgeAnswerResponse;
}

/**
 * The answer stream's `final` event: the same envelope as an intent stream's `final`, carrying a
 * {@link DcdrKnowledgeAnswerResponse} instead of an `ExecuteIntentResponse`.
 */
export interface DcdrKnowledgeAnswerStreamFinalEvent {
  type: ExecutionStreamEventType.FINAL;
  data: DcdrKnowledgeAnswerStreamFinalEventData;
}

/** Internal request description. */
interface KnowledgeRequestArgs {
  method: "GET" | "POST";
  path: string;
  body?: object;
  timeoutMs: number;
  signal?: AbortSignal;
  accept?: string;
}

/** One parsed SSE frame. */
interface KnowledgeSseFrame {
  event: string;
  data: string;
}

/**
 * Error thrown by every {@link DcdrKnowledgeClient} method.
 *
 * Carries the server's own error code when there was one, so callers branch on
 * {@link DcdrKnowledgeErrorCode} rather than on an HTTP status or a message string. A **refusal is not
 * an error**: it arrives as a normal answer with `refusal` set.
 */
export class DcdrKnowledgeError extends Error {
  /** Stable failure code. */
  readonly code: DcdrKnowledgeErrorCode;
  /** HTTP status, or `null` for a client-side failure (timeout, abort, transport, config). */
  readonly status: number | null;
  readonly method: string;
  readonly path: string;
  /** `details` of the server's error body, when it sent one. */
  readonly details: unknown;
  /** Bounded preview of the response body. */
  readonly bodyPreview: string | null;

  /**
   * @param args Everything known about the failure where it was detected.
   */
  constructor(args: {
    code: DcdrKnowledgeErrorCode;
    message: string;
    method: string;
    path: string;
    status?: number | null;
    details?: unknown;
    bodyPreview?: string | null;
  }) {
    super(args.message);
    this.name = "DcdrKnowledgeError";
    this.code = args.code;
    this.status = args.status ?? null;
    this.method = args.method;
    this.path = args.path;
    this.details = args.details ?? null;
    this.bodyPreview = args.bodyPreview ?? null;
  }
}

/**
 * Narrows an unknown thrown value to a {@link DcdrKnowledgeError}.
 *
 * By shape as well as by `instanceof`: two copies of `@dcdr/contracts` in one dependency tree have two
 * distinct classes, and `instanceof` then fails on an error that is one in every way that matters.
 *
 * @param value Thrown value.
 * @returns `true` when it carries a {@link DcdrKnowledgeErrorCode}.
 */
export function isDcdrKnowledgeError(value: unknown): value is DcdrKnowledgeError {
  if (value instanceof DcdrKnowledgeError) return true;
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { name?: unknown; code?: unknown };
  return candidate.name === "DcdrKnowledgeError" && (Object.values(DcdrKnowledgeErrorCode) as string[]).includes(String(candidate.code));
}

/**
 * Builds the API paths from the mount base path.
 *
 * Path parameters are trimmed and URL-encoded but never re-cased: collection keys are compared exactly
 * and may carry hyphens (`rice-literature`).
 *
 * @param basePath Mount path; defaults to {@link DCDR_KNOWLEDGE_API_BASE_PATH}.
 * @returns Route builder.
 */
export function buildDcdrKnowledgeRoutes(basePath: string = DCDR_KNOWLEDGE_API_BASE_PATH): DcdrKnowledgeRoutes {
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const segment = (value: string): string => encodeURIComponent(String(value ?? "").trim());
  const collection = (idOrKey: string): string => `${base}/collections/${segment(idOrKey)}`;

  return {
    collections: () => `${base}/collections`,
    collection: (idOrKey) => collection(idOrKey),
    documents: (idOrKey) => `${collection(idOrKey)}/documents`,
    document: (idOrKey, documentId) => `${collection(idOrKey)}/documents/${segment(documentId)}`,
    search: () => `${base}/search`,
    answer: () => `${base}/answer`,
    answerStream: () => `${base}/answer/stream`,
  };
}

/**
 * Typed HTTP client of the tenant knowledge API.
 *
 * @public
 */
export class DcdrKnowledgeClient {
  private readonly baseUrl: string;
  private readonly bearerToken: string;
  private readonly timeoutMs: number;
  private readonly answerTimeoutMs: number;
  private readonly extraHeaders: Record<string, string>;
  private readonly fetchFn: (input: string, init?: RequestInit) => Promise<Response>;

  /** Path builder of the endpoints this client calls. */
  readonly routes: DcdrKnowledgeRoutes;

  /**
   * Creates a client.
   *
   * @param cfg Client configuration.
   * @throws {@link DcdrKnowledgeError} `CONFIGURATION` when the base URL or token is blank, or no
   * `fetch` implementation is reachable.
   */
  constructor(cfg: DcdrKnowledgeClientConfig) {
    const base = String(cfg?.baseUrl ?? DCDR_KNOWLEDGE_DEFAULT_BASE_URL).trim();
    if (!base) throw configurationError("DcdrKnowledgeClient requires baseUrl (or omit it for the DCDR control plane)");
    this.baseUrl = base.endsWith("/") ? base.slice(0, -1) : base;

    const token = String(cfg?.bearerToken ?? "").trim();
    if (!token) {
      throw configurationError(
        `DcdrKnowledgeClient requires bearerToken: a service token carrying ${DcdrServiceTokenScope.KNOWLEDGE_READ} and/or ${DcdrServiceTokenScope.KNOWLEDGE_RUN} plus a collection grant`,
      );
    }
    this.bearerToken = token;

    this.timeoutMs = positiveOr(cfg?.timeoutMs, DCDR_KNOWLEDGE_DEFAULT_TIMEOUT_MS);
    this.answerTimeoutMs = positiveOr(cfg?.answerTimeoutMs, DCDR_KNOWLEDGE_DEFAULT_ANSWER_TIMEOUT_MS);
    this.extraHeaders = cfg?.extraHeaders ? { ...cfg.extraHeaders } : {};

    const resolvedFetch = cfg?.fetchFn ?? (globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined);
    if (!resolvedFetch) throw configurationError("DcdrKnowledgeClient requires a fetch implementation (global fetch missing)");
    this.fetchFn = resolvedFetch;

    this.routes = buildDcdrKnowledgeRoutes();
  }

  // ------------------------------------------------------------------ collections and documents

  /**
   * Calls `GET /api/dcdr/knowledge/collections`: the collections this token is granted.
   *
   * A collection outside the token's grant is simply absent. Page with `cursor`: pass back the
   * previous page's `nextCursor`, which is absent on the last page.
   *
   * @param query Page size and cursor.
   * @returns One page of collections.
   */
  async listKnowledgeCollections(query?: ListKnowledgeCollectionsQuery): Promise<WorkflowPage<DcdrKnowledgeCollectionSummary>> {
    const path = `${this.routes.collections()}${buildQuery({ limit: query?.limit, cursor: query?.cursor })}`;
    return this.requestJson({ method: "GET", path, timeoutMs: this.timeoutMs });
  }

  /**
   * Calls `GET /api/dcdr/knowledge/collections/:idOrKey`.
   *
   * @param idOrKey Collection key (preferred: stable across environments) or id. A UUID is read as an id.
   * @returns The collection with its index details.
   * @throws {@link DcdrKnowledgeError} `NOT_FOUND` when it does not exist or is not granted.
   */
  async getKnowledgeCollection(idOrKey: string): Promise<DcdrKnowledgeCollectionDetail> {
    requireArgument("getKnowledgeCollection", "idOrKey", idOrKey);
    return this.requestJson({ method: "GET", path: this.routes.collection(idOrKey), timeoutMs: this.timeoutMs });
  }

  /**
   * Calls `GET /api/dcdr/knowledge/collections/:idOrKey/documents`.
   *
   * @param idOrKey Collection key or id.
   * @param query Optional status filter, page size and cursor.
   * @returns One page of document summaries (metadata only).
   */
  async listKnowledgeDocuments(idOrKey: string, query?: ListKnowledgeDocumentsQuery): Promise<WorkflowPage<DcdrKnowledgeDocumentSummary>> {
    requireArgument("listKnowledgeDocuments", "idOrKey", idOrKey);
    const path = `${this.routes.documents(idOrKey)}${buildQuery({ status: query?.status, limit: query?.limit, cursor: query?.cursor })}`;
    return this.requestJson({ method: "GET", path, timeoutMs: this.timeoutMs });
  }

  /**
   * Calls `GET /api/dcdr/knowledge/collections/:idOrKey/documents/:documentId`.
   *
   * @param idOrKey Collection key or id.
   * @param documentId Document id.
   * @returns The document's metadata. Never its content or a link to the original.
   */
  async getKnowledgeDocument(idOrKey: string, documentId: string): Promise<DcdrKnowledgeDocumentDetail> {
    requireArgument("getKnowledgeDocument", "idOrKey", idOrKey);
    requireArgument("getKnowledgeDocument", "documentId", documentId);
    return this.requestJson({ method: "GET", path: this.routes.document(idOrKey, documentId), timeoutMs: this.timeoutMs });
  }

  // ------------------------------------------------------------------ search and answer

  /**
   * Calls `POST /api/dcdr/knowledge/search`: the passages that match a query, nothing generated.
   *
   * An empty `passages` list is a result, not an error.
   *
   * @param request Collections, query and optional `topK`, `modeKey`, `contextWindow`.
   * @param options Timeout override and cancellation.
   * @returns Passages, best first, and the retrieval report.
   */
  async searchKnowledge(request: DcdrKnowledgeSearchRequest, options?: DcdrKnowledgeRequestOptions): Promise<DcdrKnowledgeSearchResponse> {
    return this.requestJson({
      method: "POST",
      path: this.routes.search(),
      body: request ?? {},
      timeoutMs: positiveOr(options?.timeoutMs, this.timeoutMs),
      signal: options?.signal,
    });
  }

  /**
   * Calls `POST /api/dcdr/knowledge/answer`: a grounded answer, or a refusal.
   *
   * A refusal (`refusal !== null`, `text === ""`) is a normal result with HTTP `200`, never a thrown
   * error: show the reader why there is no answer.
   *
   * @param request Collections, question and optional `locale`, `modeKey`, `chunkIds`.
   * @param options Timeout override (default 120 s) and cancellation.
   * @returns The answer response, with the model's execution report.
   */
  async answerFromKnowledge(request: DcdrKnowledgeAnswerRequest, options?: DcdrKnowledgeRequestOptions): Promise<DcdrKnowledgeAnswerResponse> {
    return this.requestJson({
      method: "POST",
      path: this.routes.answer(),
      body: request ?? {},
      timeoutMs: positiveOr(options?.timeoutMs, this.answerTimeoutMs),
      signal: options?.signal,
    });
  }

  /**
   * Calls `POST /api/dcdr/knowledge/answer/stream` and yields its SSE events: `meta`, zero or more
   * `delta`, then exactly one `final` or `error`.
   *
   * **`final` is authoritative.** Deltas are the answer text as the model writes it, for display only,
   * and a refusal can arrive **after** text has streamed: only `NO_PASSAGES` is decided before the model
   * runs, while `NOT_IN_CORPUS`, `NO_CITATIONS`, `ANSWER_TOO_LONG` and `MODEL_FAILED` are decided once
   * it has written. When `final.data.response.refusal` is not `null`, `text` is `""` and you **must
   * discard whatever the deltas painted** - appending deltas and ignoring `final` shows an answer the
   * platform refused.
   *
   * A refusal is never an `error` event. `error` means the stream could not produce an answer at all
   * (credentials, grant, limit, index not ready, internal failure). A failure before the stream starts
   * (`401`, `404`, `409`, `429`...) is thrown as a {@link DcdrKnowledgeError}, like the other methods.
   *
   * @param request Collections, question and optional `locale`, `modeKey`, `chunkIds`.
   * @param options Timeout for the whole stream (default 120 s) and cancellation.
   * @returns An async generator of stream events.
   * @throws {@link DcdrKnowledgeError} On an HTTP error, a transport failure, a timeout, a frame that is
   * not JSON, or a stream that ends without `final` or `error`.
   */
  async *answerFromKnowledgeStream(
    request: DcdrKnowledgeAnswerRequest,
    options?: DcdrKnowledgeRequestOptions,
  ): AsyncGenerator<ExecutionStreamMetaEvent | ExecutionStreamDeltaEvent | DcdrKnowledgeAnswerStreamFinalEvent | ExecutionStreamErrorEvent, void, void> {
    const method = "POST";
    const path = this.routes.answerStream();
    const timeoutMs = positiveOr(options?.timeoutMs, this.answerTimeoutMs);
    const guard = startGuard(timeoutMs, options?.signal);

    try {
      const response = await this.send({ method, path, body: request ?? {}, timeoutMs, signal: options?.signal, accept: "text/event-stream" }, guard);
      if (!response.ok) {
        const text = await response.text();
        const isJson = /application\/json/i.test(response.headers.get("content-type") ?? "");
        throw buildHttpError({ method, path, status: response.status, text, isJson });
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!/text\/event-stream/i.test(contentType) || !response.body) {
        const text = response.body ? await response.text() : "";
        throw new DcdrKnowledgeError({
          code: DcdrKnowledgeErrorCode.UNEXPECTED_RESPONSE,
          message: `DcdrKnowledgeClient expected text/event-stream: ${method} ${path} status=${response.status} content-type='${contentType}'`,
          method,
          path,
          status: response.status,
          bodyPreview: previewBody(text),
        });
      }

      try {
        for await (const frame of parseSseFrames(response.body)) {
          const data = parseFrameData(frame, method, path);
          if (frame.event === ExecutionStreamEventType.META) {
            yield { type: ExecutionStreamEventType.META, data } as ExecutionStreamMetaEvent;
          } else if (frame.event === ExecutionStreamEventType.DELTA) {
            yield { type: ExecutionStreamEventType.DELTA, data } as ExecutionStreamDeltaEvent;
          } else if (frame.event === ExecutionStreamEventType.FINAL) {
            yield { type: ExecutionStreamEventType.FINAL, data } as DcdrKnowledgeAnswerStreamFinalEvent;
            return;
          } else if (frame.event === ExecutionStreamEventType.ERROR) {
            yield { type: ExecutionStreamEventType.ERROR, data } as ExecutionStreamErrorEvent;
            return;
          }
          // Any other event name is ignored: a newer server may add one, and a reader that knows
          // nothing about it loses nothing by skipping it.
        }
      } catch (e) {
        if (isDcdrKnowledgeError(e)) throw e;
        throw transportError(e, method, path, timeoutMs, guard.timedOut(), Boolean(options?.signal?.aborted));
      }

      throw new DcdrKnowledgeError({
        code: DcdrKnowledgeErrorCode.UNEXPECTED_RESPONSE,
        message: `DcdrKnowledgeClient stream ended without a final or error event: ${method} ${path}`,
        method,
        path,
        status: response.status,
      });
    } finally {
      guard.dispose();
    }
  }

  // ------------------------------------------------------------------ transport

  /**
   * Performs one request and parses its JSON body.
   *
   * @param args Request description.
   * @returns The parsed body.
   * @throws {@link DcdrKnowledgeError} On any non-2xx answer, transport failure or unreadable body.
   */
  private async requestJson<T>(args: KnowledgeRequestArgs): Promise<T> {
    const guard = startGuard(args.timeoutMs, args.signal);
    try {
      const response = await this.send(args, guard);
      let text: string;
      try {
        text = await response.text();
      } catch (e) {
        throw transportError(e, args.method, args.path, args.timeoutMs, guard.timedOut(), Boolean(args.signal?.aborted));
      }
      const isJson = /application\/json/i.test(response.headers.get("content-type") ?? "");
      if (!response.ok) throw buildHttpError({ method: args.method, path: args.path, status: response.status, text, isJson });

      if (!isJson || !text) {
        throw new DcdrKnowledgeError({
          code: DcdrKnowledgeErrorCode.UNEXPECTED_RESPONSE,
          message: `DcdrKnowledgeClient expected a JSON body: ${args.method} ${args.path} status=${response.status}`,
          method: args.method,
          path: args.path,
          status: response.status,
          bodyPreview: previewBody(text),
        });
      }
      try {
        return JSON.parse(text) as T;
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        throw new DcdrKnowledgeError({
          code: DcdrKnowledgeErrorCode.UNEXPECTED_RESPONSE,
          message: `DcdrKnowledgeClient could not parse the JSON body: ${args.method} ${args.path} status=${response.status} (${detail})`,
          method: args.method,
          path: args.path,
          status: response.status,
          bodyPreview: previewBody(text),
        });
      }
    } finally {
      guard.dispose();
    }
  }

  /**
   * Sends one request with auth under a timeout/cancellation guard.
   *
   * @param args Request description.
   * @param guard The guard whose signal aborts the request.
   * @returns The raw response, whatever its status.
   * @throws {@link DcdrKnowledgeError} `TIMEOUT`, `CANCELLED` or `NETWORK` when no response arrived.
   */
  private async send(args: KnowledgeRequestArgs, guard: RequestGuard): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: args.accept ?? "application/json",
      ...this.extraHeaders,
      Authorization: `Bearer ${this.bearerToken}`,
    };
    try {
      return await this.fetchFn(`${this.baseUrl}${args.path}`, {
        method: args.method,
        headers,
        body: args.body ? JSON.stringify(args.body) : undefined,
        signal: guard.signal,
      });
    } catch (e) {
      throw transportError(e, args.method, args.path, args.timeoutMs, guard.timedOut(), Boolean(args.signal?.aborted));
    }
  }
}

/** Timeout and caller-cancellation folded into one abort signal. */
interface RequestGuard {
  signal: AbortSignal;
  timedOut(): boolean;
  dispose(): void;
}

/**
 * Starts a guard: an abort signal that fires on the timeout or on the caller's own signal.
 *
 * @param timeoutMs Timeout.
 * @param callerSignal Optional caller signal.
 * @returns The guard; `dispose` must be called when the request is over.
 */
function startGuard(timeoutMs: number, callerSignal?: AbortSignal): RequestGuard {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = (): void => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", onAbort);
  }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      if (callerSignal) callerSignal.removeEventListener("abort", onAbort);
    },
  };
}

/**
 * Classifies a failure that happened before (or while) a response body was read.
 *
 * @param error What was thrown.
 * @param method HTTP method.
 * @param path Request path.
 * @param timeoutMs Timeout in force.
 * @param timedOut Whether the timeout fired.
 * @param cancelled Whether the caller's signal fired.
 * @returns The error to throw.
 */
function transportError(error: unknown, method: string, path: string, timeoutMs: number, timedOut: boolean, cancelled: boolean): DcdrKnowledgeError {
  if (timedOut) {
    return new DcdrKnowledgeError({ code: DcdrKnowledgeErrorCode.TIMEOUT, message: `DcdrKnowledgeClient request timed out after ${timeoutMs}ms: ${method} ${path}`, method, path });
  }
  if (cancelled) {
    return new DcdrKnowledgeError({ code: DcdrKnowledgeErrorCode.CANCELLED, message: `DcdrKnowledgeClient request was cancelled by the caller: ${method} ${path}`, method, path });
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new DcdrKnowledgeError({ code: DcdrKnowledgeErrorCode.NETWORK, message: `DcdrKnowledgeClient request failed before a response: ${method} ${path} (${detail})`, method, path });
}

/**
 * Builds the typed error of a non-2xx answer.
 *
 * @param args Method, path, status and raw body.
 * @returns The error to throw.
 */
function buildHttpError(args: { method: string; path: string; status: number; text: string; isJson: boolean }): DcdrKnowledgeError {
  const body = args.isJson ? safeParseObject(args.text) : null;
  const serverCode = typeof body?.code === "string" ? body.code : null;
  const serverMessage = typeof body?.message === "string" ? body.message : null;
  const code = mapErrorCode(serverCode, args.status);
  const tail = serverMessage ? ` ${serverMessage}` : ` body=${previewBody(args.text)}`;
  return new DcdrKnowledgeError({
    code,
    message: `DcdrKnowledgeClient request failed: ${args.method} ${args.path} status=${args.status} code=${code}${tail}`,
    method: args.method,
    path: args.path,
    status: args.status,
    details: body?.details ?? null,
    bodyPreview: previewBody(args.text),
  });
}

/**
 * Maps a server error code, or an HTTP status when there was none, to the client vocabulary.
 *
 * The server code wins: `429` is a tenant limit only when the body says `LIMIT_REACHED`, and a plain
 * rate limiter otherwise; `409` is "index not ready" only when it says `INVALID_STATE`. The control plane's
 * `INTERNAL` (`500`) is reported as `SERVER_ERROR`.
 *
 * @param serverCode `code` field of the error body, when present.
 * @param status HTTP status.
 * @returns The client error code.
 */
function mapErrorCode(serverCode: string | null, status: number): DcdrKnowledgeErrorCode {
  const normalized =
    serverCode === "DCDR_LIMIT_REACHED" ? DcdrKnowledgeErrorCode.LIMIT_REACHED : serverCode === "INTERNAL" ? DcdrKnowledgeErrorCode.SERVER_ERROR : serverCode;
  if (normalized && (Object.values(DcdrKnowledgeErrorCode) as string[]).includes(normalized)) return normalized as DcdrKnowledgeErrorCode;

  if (status === 401) return DcdrKnowledgeErrorCode.UNAUTHORIZED;
  if (status === 403) return DcdrKnowledgeErrorCode.FORBIDDEN;
  if (status === 404) return DcdrKnowledgeErrorCode.NOT_FOUND;
  if (status === 400 || status === 422) return DcdrKnowledgeErrorCode.VALIDATION;
  if (status === 409) return DcdrKnowledgeErrorCode.CONFLICT;
  if (status === 429) return DcdrKnowledgeErrorCode.RATE_LIMITED;
  if (status === 503) return DcdrKnowledgeErrorCode.DISABLED;
  if (status >= 500) return DcdrKnowledgeErrorCode.SERVER_ERROR;
  return DcdrKnowledgeErrorCode.UNEXPECTED_RESPONSE;
}

/**
 * Builds a `CONFIGURATION` error, thrown before anything reaches the network.
 *
 * @param message What is missing.
 * @returns The error to throw.
 */
function configurationError(message: string): DcdrKnowledgeError {
  return new DcdrKnowledgeError({ code: DcdrKnowledgeErrorCode.CONFIGURATION, message, method: "-", path: "-" });
}

/**
 * Refuses a blank path argument before it collapses a detail route into a listing route.
 *
 * `GET /collections/` with an empty key would reach the list endpoint and hand back a page typed as a
 * collection; failing here is the honest outcome.
 *
 * @param methodName Client method, for the message.
 * @param name Argument name.
 * @param value Argument value.
 * @throws {@link DcdrKnowledgeError} `CONFIGURATION` when the value is blank.
 */
function requireArgument(methodName: string, name: string, value: string): void {
  if (!String(value ?? "").trim()) throw configurationError(`DcdrKnowledgeClient.${methodName} requires a non-empty ${name}`);
}

/**
 * Builds a query string, skipping absent values.
 *
 * @param params Parameter map.
 * @returns A `?a=b&c=d` string, or an empty string.
 */
function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/**
 * Parses a JSON object body without throwing.
 *
 * @param text Body text.
 * @returns The parsed object, or `null` when it is not one.
 */
function safeParseObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Parses an SSE frame's data as JSON.
 *
 * @param frame The frame.
 * @param method HTTP method, for the error.
 * @param path Request path, for the error.
 * @returns The parsed data (`{}` for a frame with none).
 * @throws {@link DcdrKnowledgeError} `UNEXPECTED_RESPONSE` when the data is not JSON.
 */
function parseFrameData(frame: KnowledgeSseFrame, method: string, path: string): object {
  if (!frame.data) return {};
  try {
    return JSON.parse(frame.data) as object;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new DcdrKnowledgeError({
      code: DcdrKnowledgeErrorCode.UNEXPECTED_RESPONSE,
      message: `DcdrKnowledgeClient received a '${frame.event}' event that is not JSON: ${method} ${path} (${detail})`,
      method,
      path,
      bodyPreview: previewBody(frame.data),
    });
  }
}

/**
 * Splits a stream of SSE bytes into `{ event, data }` frames.
 *
 * Frames are separated by a blank line; `\r\n` line endings are accepted, comment lines (`:`, the
 * heartbeat) are skipped, and several `data:` lines are joined with a newline, as the SSE spec says.
 *
 * @param body Response body.
 * @returns The frames, in order.
 */
async function* parseSseFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<KnowledgeSseFrame, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");
      let index = buffer.indexOf("\n\n");
      while (index >= 0) {
        const frame = parseSseFrame(buffer.slice(0, index));
        buffer = buffer.slice(index + 2);
        if (frame) yield frame;
        index = buffer.indexOf("\n\n");
      }
    }
    buffer += decoder.decode().replace(/\r\n?/g, "\n");
    const frame = parseSseFrame(buffer.trim());
    if (frame) yield frame;
  } finally {
    // Cancelled rather than merely released: a consumer that stops at `final` must not leave the
    // connection open until the server closes it.
    try {
      await reader.cancel();
    } catch {
      // Already closed or errored; nothing left to free.
    }
  }
}

/**
 * Parses one SSE frame.
 *
 * @param raw Frame text, without its trailing blank line.
 * @returns The frame, or `null` for a frame with neither an event name nor data (a heartbeat).
 */
function parseSseFrame(raw: string): KnowledgeSseFrame | null {
  let event = "";
  const data: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) data.push(line.slice("data:".length).replace(/^ /, ""));
  }
  if (!event && !data.length) return null;
  return { event: event || "message", data: data.join("\n") };
}

/**
 * Returns a positive number or the fallback.
 *
 * @param value Candidate.
 * @param fallback Used when the candidate is absent or not positive.
 * @returns The resolved number.
 */
function positiveOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Builds a bounded, single-line body preview for an error message.
 *
 * @param text Full body text.
 * @returns Preview capped at {@link ERROR_BODY_PREVIEW_MAX_CHARS}.
 */
function previewBody(text: string): string {
  const compact = String(text ?? "").replace(/\s+/g, " ").trim();
  return compact.length > ERROR_BODY_PREVIEW_MAX_CHARS ? `${compact.slice(0, ERROR_BODY_PREVIEW_MAX_CHARS)}…` : compact;
}

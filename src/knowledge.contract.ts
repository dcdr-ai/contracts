import { ExecutionReport } from "./execution.contract";

/**
 * Knowledge for client apps (3.20.0): the wire shapes of the tenant knowledge API
 * (`/api/dcdr/knowledge/*` on the control plane).
 *
 * The API is **read-only**. Collections are created, documents uploaded and indexes rebuilt in the
 * DCDR web UI; from the API an application lists and reads collections and documents, searches them,
 * and asks for an answer grounded in them. The same search is reachable from a workflow as the
 * `knowledge.search` capability, so governance (scopes, usage, logs, limits) is one thing.
 *
 * The shapes mirror the control plane's own services field by field (`KnowledgeRetrievedChunk`,
 * `KnowledgeAnswer`, `KnowledgeAnswerRefusal`); a field there is a field here, under the same name.
 *
 * Access is decided by two scopes together - an action (`knowledge:read` / `knowledge:run`) **and** a
 * collection grant (`knowledge:collections:*` / `knowledge:collection:<key>`). See
 * `hasDcdrKnowledgeAccess` in `service-tokens.contract`.
 */

/** Mount path of the tenant knowledge API on the control plane. */
export const DCDR_KNOWLEDGE_API_BASE_PATH = "/api/dcdr/knowledge";

/** Most collections one search or answer may span; the control plane refuses more with `400`. */
export const DCDR_KNOWLEDGE_MAX_COLLECTIONS_PER_REQUEST = 10;

/** Largest `contextWindow` the control plane honours; a larger one is clamped to it. */
export const DCDR_KNOWLEDGE_MAX_CONTEXT_WINDOW = 3;

/**
 * Why an answer was not written.
 *
 * A refusal is a **result, not an error**: it arrives with HTTP `200` (or as the stream's `final`
 * event) and `text: ""`. *"This is not in your documents"* is the answer that makes the other answers
 * worth believing.
 */
export enum DcdrKnowledgeAnswerRefusal {
  /** Retrieval found nothing to answer from. The model is never called. */
  NO_PASSAGES = "NO_PASSAGES",
  /** The model said the passages do not support an answer. */
  NOT_IN_CORPUS = "NOT_IN_CORPUS",
  /** The model wrote an answer and cited nothing - a claim, not a grounded answer, so it is withheld. */
  NO_CITATIONS = "NO_CITATIONS",
  /** The model failed, timed out, or answered with something that is not an answer. */
  MODEL_FAILED = "MODEL_FAILED",
  /**
   * The model ran out of room and its answer was cut before it closed.
   *
   * The one refusal a reader can act on: asking for less detail gets an answer.
   */
  ANSWER_TOO_LONG = "ANSWER_TOO_LONG",
}

/** Lifecycle of a collection, as the control plane persists it. */
export enum DcdrKnowledgeCollectionStatus {
  DRAFT = "DRAFT",
  /** Documents are being parsed, chunked or embedded. */
  INDEXING = "INDEXING",
  READY = "READY",
  ARCHIVED = "ARCHIVED",
}

/** Ingestion status of one document. */
export enum DcdrKnowledgeDocumentStatus {
  PENDING = "PENDING",
  PARSING = "PARSING",
  CHUNKING = "CHUNKING",
  EMBEDDING = "EMBEDDING",
  READY = "READY",
  /** Indexed, with some pages or chunks missing. */
  PARTIAL = "PARTIAL",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED",
}

/** Where a document came from. */
export enum DcdrKnowledgeSourceType {
  UPLOAD = "UPLOAD",
  URL = "URL",
  REGISTRY = "REGISTRY",
  INLINE_TEXT = "INLINE_TEXT",
}

/**
 * Where a passage sits inside its document: what lets a citation say "page 7, Results".
 *
 * **Open to extra fields.** The control plane may add optional locator fields (unit keys, for
 * instance) without a contracts release; read the ones you know and ignore the rest.
 */
export interface DcdrKnowledgeChunkLocator {
  /** 1-based page number, when the source is paginated. */
  page?: number;
  /** Heading trail inside the document, e.g. `["Results", "Salinity tolerance"]`. */
  section?: string[];
  /** Offset of the first character of the passage in the parsed text. */
  charStart?: number;
  /** Offset just past the last character of the passage in the parsed text. */
  charEnd?: number;
  /** Bounding box in PDF user space, `[x0, y0, x1, y1]`, when layout was recovered. */
  bbox?: number[];
  /** Fields a newer control plane adds; always optional. */
  [extra: string]: string | number | boolean | null | undefined | string[] | number[];
}

/**
 * The passage around a retrieved chunk, when context expansion added one.
 *
 * Kept **beside** the chunk's own `text`, never in place of it: the citation is the chunk that matched.
 * Two hits close together share one context, so a caller building a prompt should de-duplicate by
 * `fromOrdinal`. Open to extra fields, like the locator.
 */
export interface DcdrKnowledgeRetrievedContext {
  /** The expanded passage, neighbours included, in reading order. */
  text: string;
  /** First chunk ordinal included. */
  fromOrdinal: number;
  /** Last chunk ordinal included. */
  toOrdinal: number;
  /** Tokens the passage holds. */
  tokens: number;
  /** Ordinals of the retrieved chunks this passage was built around; more than one when hits merged. */
  hitOrdinals: number[];
  /** Fields a newer control plane adds; always optional. */
  [extra: string]: string | number | boolean | null | undefined | string[] | number[];
}

/**
 * One passage a search returned, with enough provenance to cite it.
 *
 * An answer cites passages by `chunkId`; the number a reader sees is the passage's position in the
 * list.
 */
export interface DcdrKnowledgePassage {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  collectionId: string;
  /** Position of the chunk inside its document, 0-based. */
  ordinal: number;
  /** The chunk as it matched. Cite this, not `context.text`. */
  text: string;
  locator: DcdrKnowledgeChunkLocator | null;
  /** Fused score. Comparable within one result set and meaningless across two. */
  score: number;
  /** Position in the lexical arm, 1-based, or `null` when that arm did not return it. */
  lexicalRank: number | null;
  /** Position in the semantic arm, 1-based, or `null` when that arm did not return it. */
  semanticRank: number | null;
  /** The passage around the chunk, or `null` when the window is zero or nothing was added. */
  context: DcdrKnowledgeRetrievedContext | null;
}

/**
 * Which retrieval arms ran.
 *
 * Reported rather than assumed: a semantic arm skipped because the embedder was down is a **degraded**
 * result, and a caller that cannot tell degraded from complete presents both the same way.
 */
export interface DcdrKnowledgeRetrievalArms {
  lexical: boolean;
  semantic: boolean;
}

/** Candidates each arm produced before fusion. */
export interface DcdrKnowledgeRetrievalCandidates {
  lexical: number;
  semantic: number;
}

/** Where a search's time went, in milliseconds. */
export interface DcdrKnowledgeRetrievalTimings {
  /** Turning the query into a vector (the semantic arm's preparation). */
  embeddingMs: number;
  /** The fused search statement; it cannot be split between the arms. */
  searchMs: number;
  /** Probing the corpus for the terms worth requiring (the lexical arm's preparation). */
  planMs: number;
}

/**
 * What a search did, not just what it found.
 *
 * A search carries no provider report: the query is embedded by the platform's own model, so there
 * is no provider cost to report.
 */
export interface DcdrKnowledgeRetrievalReport {
  arms: DcdrKnowledgeRetrievalArms;
  candidates: DcdrKnowledgeRetrievalCandidates;
  timings: DcdrKnowledgeRetrievalTimings;
  /** Search mode the weights and limits came from. */
  modeKey: string;
  /** `true` when the passages were reused from an earlier search rather than searched for. */
  reused?: boolean;
}

/** `POST /api/dcdr/knowledge/search` request body. */
export interface DcdrKnowledgeSearchRequest {
  /**
   * Collections to search, by key or id (a UUID is read as an id, anything else as a key); 1 to
   * {@link DCDR_KNOWLEDGE_MAX_COLLECTIONS_PER_REQUEST}. Every one must be granted to the token: a
   * collection that is not answers `404` rather than being silently left out.
   */
  collections: string[];
  /** The question, as a person wrote it. */
  query: string;
  /** How many passages to return; the search mode's own default when omitted. */
  topK?: number;
  /** Search mode key; the collection's default mode when omitted. */
  modeKey?: string;
  /**
   * Neighbouring chunks added either side of each hit, 0 to {@link DCDR_KNOWLEDGE_MAX_CONTEXT_WINDOW}.
   * `0` returns the chunks exactly as ranked; omitted uses the control plane's default.
   */
  contextWindow?: number;
}

/** `POST /api/dcdr/knowledge/search` response body. */
export interface DcdrKnowledgeSearchResponse {
  /** Passages, best first. Empty when nothing matched - which is a result, not an error. */
  passages: DcdrKnowledgePassage[];
  retrieval: DcdrKnowledgeRetrievalReport;
}

/** `POST /api/dcdr/knowledge/answer` (and `/answer/stream`) request body. */
export interface DcdrKnowledgeAnswerRequest {
  /** Collections to answer from, by key or id, as in {@link DcdrKnowledgeSearchRequest.collections}. */
  collections: string[];
  /** The question. */
  question: string;
  /**
   * Language to answer in when the question is too short to tell its own. Only a tie-breaker: the
   * answer follows the language of the question.
   */
  locale?: string;
  /** Search mode key; the collection's default mode when omitted. */
  modeKey?: string;
  /**
   * Answer over exactly these passages (chunk ids from your own earlier search, in the order they are
   * to be numbered) instead of searching again. **Nothing is searched for when these are given**, so
   * the answer can only cite passages your reader has already seen.
   */
  chunkIds?: string[];
}

/** How an answer's passages were obtained. */
export interface DcdrKnowledgeAnswerRetrieval {
  arms: DcdrKnowledgeRetrievalArms;
  modeKey: string;
  /** Milliseconds retrieval took. */
  ms: number;
  /**
   * `true` when the passages came from `chunkIds` rather than a search; the arms are then all
   * `false`, meaning "did not run" rather than "found nothing".
   */
  reused: boolean;
}

/**
 * A grounded answer, or a refusal.
 *
 * Exactly one of the two holds: `refusal === null` and `text` is the answer, or `refusal` says why
 * there is none and `text` is `""`.
 */
export interface DcdrKnowledgeAnswerResponse {
  /** The answer, or `""` when there is none. */
  text: string;
  /** Why there is no answer, or `null` when there is one. */
  refusal: DcdrKnowledgeAnswerRefusal | null;
  /**
   * Passages the answer cites, by chunk id, in the order the model cited them. A subset of `passages`:
   * a passage that was retrieved and not cited stays available, because the reader may disagree about
   * which one mattered.
   */
  citedChunkIds: string[];
  /** Everything retrieval returned, cited or not. */
  passages: DcdrKnowledgePassage[];
  retrieval: DcdrKnowledgeAnswerRetrieval;
  /** Milliseconds the model took, or `0` when it was not called. */
  modelMs: number;
  /**
   * The execution report of the model call - provider, model, tokens, cache, request id - the same report
   * an intent execution returns, without `request` (the prompt variables are not replayed: the passages are
   * already in this response). `null` when the model was never called (`NO_PASSAGES`).
   */
  report: ExecutionReport | null;
}

/** One search mode a collection offers, for picking a `modeKey`. */
export interface DcdrKnowledgeSearchModeSummary {
  key: string;
  name: string;
  description: string | null;
}

/** A collection as the listing returns it. */
export interface DcdrKnowledgeCollectionSummary {
  id: string;
  /** Tenant-unique, write-once key. What scopes, workflows and code should name. */
  key: string;
  name: string;
  description: string | null;
  status: DcdrKnowledgeCollectionStatus;
  documentsCount: number;
  tags: string[];
  /** ISO-8601. */
  updatedAt: string | null;
}

/** A collection with its index details. */
export interface DcdrKnowledgeCollectionDetail extends DcdrKnowledgeCollectionSummary {
  /** Pages across the collection's documents, when the control plane reports it. */
  pageCount?: number | null;
  chunksCount: number;
  embeddedChunksCount: number;
  failedDocumentsCount: number;
  embeddingProvider: string | null;
  embeddingModel: string | null;
  /** ISO language the collection's documents default to. */
  defaultLanguage: string | null;
  /** Mode used when a request names none. */
  defaultSearchModeKey: string | null;
  searchModes: DcdrKnowledgeSearchModeSummary[];
  /** ISO-8601. */
  lastIngestedAt: string | null;
  /** ISO-8601. */
  lastEmbeddedAt: string | null;
}

/** A document as the listing returns it: metadata only, never its content. */
export interface DcdrKnowledgeDocumentSummary {
  id: string;
  collectionId: string;
  title: string;
  sourceType: DcdrKnowledgeSourceType;
  status: DcdrKnowledgeDocumentStatus;
  /** Pages in the source, for paginated formats. */
  pageCount: number | null;
  /** ISO-8601. */
  updatedAt: string | null;
}

/**
 * One document's metadata.
 *
 * Deliberately no signed URL to the original and no chunk texts: the API serves passages through
 * search, never whole documents.
 */
export interface DcdrKnowledgeDocumentDetail extends DcdrKnowledgeDocumentSummary {
  description?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  /** Size of the source in bytes. */
  sizeBytes?: number | null;
  /** ISO language of the document. */
  language?: string | null;
  author?: string | null;
  /** ISO-8601. */
  publishedAt?: string | null;
  /** The document's own reference (a DOI, a tender number). */
  reference?: string | null;
  chunksCount?: number;
  embeddedChunksCount?: number;
  /** Why ingestion failed, when it did. */
  failureCode?: string | null;
  failureReason?: string | null;
  /** ISO-8601. */
  createdAt?: string | null;
}

/** Query of `GET /api/dcdr/knowledge/collections`. */
export interface ListKnowledgeCollectionsQuery {
  /** Page size. */
  limit?: number;
  /** `nextCursor` of the previous page. Opaque: pass it back as received. */
  cursor?: string;
}

/** Query of `GET /api/dcdr/knowledge/collections/:idOrKey/documents`. */
export interface ListKnowledgeDocumentsQuery {
  /** Only documents in this ingestion status. */
  status?: DcdrKnowledgeDocumentStatus;
  /** Page size. */
  limit?: number;
  /** `nextCursor` of the previous page. Opaque: pass it back as received. */
  cursor?: string;
}

/**
 * Error codes the knowledge API answers with, in `{ code, message, details }`.
 *
 * The first four are the control plane's own codes; the rest are what the client says about a failure
 * that carried no code of its own, or never reached the server.
 */
export enum DcdrKnowledgeErrorCode {
  /** `404`: no such collection or document - or none this token is granted. The two are indistinguishable by design. */
  NOT_FOUND = "NOT_FOUND",
  /** `400`: the request is invalid; `details` carries the issues. */
  VALIDATION = "VALIDATION",
  /**
   * `409`: the collection has no embedded chunk yet, so there is nothing to search. A collection that is
   * still `INDEXING` but has some chunks embedded answers normally, over what is already indexed.
   */
  INVALID_STATE = "INVALID_STATE",
  /**
   * `429`: a knowledge limit of the tenant was reached - for an answer, the tenant's weekly assistant quota.
   * Service-token limit rules do not apply to knowledge calls.
   */
  LIMIT_REACHED = "LIMIT_REACHED",
  /** `401`: no token, or an invalid one. */
  UNAUTHORIZED = "UNAUTHORIZED",
  /** `403`: the token lacks the action scope this call needs. */
  FORBIDDEN = "FORBIDDEN",
  /** `409` without a code of its own. */
  CONFLICT = "CONFLICT",
  /** `429` without `LIMIT_REACHED`: a rate limiter refused the call. */
  RATE_LIMITED = "RATE_LIMITED",
  /** `503`: the knowledge assistant is not configured on the platform. */
  DISABLED = "DISABLED",
  /** `5xx`: the server failed. The control plane's own `INTERNAL` code (`500`, generic body) maps here. */
  SERVER_ERROR = "SERVER_ERROR",
  /** The request exceeded its timeout. */
  TIMEOUT = "TIMEOUT",
  /** The caller's `AbortSignal` fired. */
  CANCELLED = "CANCELLED",
  /** The transport failed before a response arrived. */
  NETWORK = "NETWORK",
  /** A response the client could not read as the documented shape. */
  UNEXPECTED_RESPONSE = "UNEXPECTED_RESPONSE",
  /** The client is misconfigured (no token, no `fetch`), or a required argument is blank. */
  CONFIGURATION = "CONFIGURATION",
}

/** Error body of the knowledge API. */
export interface DcdrKnowledgeErrorBody {
  /** Usually a {@link DcdrKnowledgeErrorCode}; kept open so a newer server's code still reads. */
  code: string;
  message: string;
  /** Validation issues, limit counters or other context; shape depends on `code`. */
  details?: Record<string, unknown> | unknown[] | null;
}

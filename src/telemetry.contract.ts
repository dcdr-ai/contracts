/**
 * OpenTelemetry telemetry from external AI systems (Feature #5125, since 3.25.0).
 *
 * A customer's AI app (LangChain, OpenAI Agents SDK, Vercel AI SDK, in-house code...) exports OTLP to the
 * runtime (`POST /v1/traces`, `POST /v1/logs`). The runtime normalizes every GenAI span into one
 * {@link TelemetryExecutionLogDetails} block carried by an `ExecutionLogEvent` with
 * `executionMode: TELEMETRY`, and sends those events to the control plane in batches
 * ({@link DcdrTelemetryIngestRequest}, in `logs.contract`).
 *
 * Principle: **telemetry stores what the app reports; it never infers.** Every field is copied from the
 * OTLP payload through a fixed, versioned mapping table, or computed deterministically (hashes, counts).
 * Evidence level: REPORTED (the app tells us), weaker than the gateway (ENFORCED).
 *
 * Privacy: content (prompts, completions, tool arguments and results, retrieved documents) leaves the runtime
 * only for a service whose payload level is {@link TelemetryPayloadLevel.FULL}; otherwise it is removed before
 * buffering and only a {@link TelemetryContentSummary} is sent.
 */
import { CapturedContent, DCDR_CAPTURED_CONTENT_MAX_CHARS } from "./captured-content.contract";
import { IntentProvider } from "./provider.contract";
import { ProcessingProcessor } from "./processing.contract";

/**
 * Normalized GenAI operation of one span.
 *
 * Mapped from `gen_ai.operation.name` and its equivalents in the other conventions. A span whose operation
 * the mapping table does not recognize is {@link OTHER} (never guessed); the reported value is kept in
 * {@link TelemetryExecutionLogDetails.operationReported}.
 */
export enum TelemetryOperation {
  CHAT = "CHAT",
  TEXT_COMPLETION = "TEXT_COMPLETION",
  GENERATE_CONTENT = "GENERATE_CONTENT",
  EMBEDDINGS = "EMBEDDINGS",
  EXECUTE_TOOL = "EXECUTE_TOOL",
  INVOKE_AGENT = "INVOKE_AGENT",
  INVOKE_WORKFLOW = "INVOKE_WORKFLOW",
  CREATE_AGENT = "CREATE_AGENT",
  RETRIEVAL = "RETRIEVAL",
  PLAN = "PLAN",
  /**
   * Not a GenAI operation the table knows, or a non-GenAI ancestor kept only so the trace tree stays connected.
   */
  OTHER = "OTHER",
}

/** OTLP `Span.SpanKind`, by name. */
export enum TelemetrySpanKind {
  UNSPECIFIED = "UNSPECIFIED",
  INTERNAL = "INTERNAL",
  SERVER = "SERVER",
  CLIENT = "CLIENT",
  PRODUCER = "PRODUCER",
  CONSUMER = "CONSUMER",
}

/** OTLP `Status.StatusCode`, by name. `ERROR` makes the log event's `status` `ERROR`. */
export enum TelemetrySpanStatusCode {
  UNSET = "UNSET",
  OK = "OK",
  ERROR = "ERROR",
}

/**
 * Attribute convention a span was mapped from.
 *
 * A span may carry keys of more than one convention (an OpenInference instrumentation on top of the OTel
 * SDK, say). {@link TelemetryExecutionLogDetails.sourceConvention} names the one that supplied the operation;
 * {@link TelemetryExecutionLogDetails.conventionsSeen} lists every convention whose keys were present.
 */
export enum TelemetrySourceConvention {
  /** Current OTel GenAI semantic conventions (`gen_ai.*`). */
  GEN_AI = "GEN_AI",
  /** Older `gen_ai.*` forms (`gen_ai.system`, `prompt_tokens`, indexed `gen_ai.prompt.N.*`, per-message events). */
  GEN_AI_LEGACY = "GEN_AI_LEGACY",
  /** Arize OpenInference (`openinference.span.kind`, `llm.*`, `input.value`). */
  OPENINFERENCE = "OPENINFERENCE",
  /** Traceloop OpenLLMetry (`traceloop.*`). */
  OPENLLMETRY = "OPENLLMETRY",
  /** Langfuse (`langfuse.*`). */
  LANGFUSE = "LANGFUSE",
  /** Vercel AI SDK legacy telemetry (`ai.*`). */
  VERCEL_AI = "VERCEL_AI",
  /** No known GenAI convention (a non-GenAI ancestor kept for the tree). */
  NONE = "NONE",
}

/**
 * How much content of a telemetry service leaves the runtime.
 *
 * Same vocabulary as workflow payload logging. Default for a new service: {@link METADATA}. Since 3.27.0 it is also
 * the payload level of a service token's gateway calls (`DcdrGatewayTokenCheckResponse.payloadLevel`).
 */
export enum TelemetryPayloadLevel {
  /** No content and no content summary. */
  NONE = "NONE",
  /** No content; a {@link TelemetryContentSummary} (counts, roles, tool names, keyed hashes). */
  METADATA = "METADATA",
  /** Content after the service's processors, bounded per field ({@link DCDR_TELEMETRY_CONTENT_MAX_CHARS}). */
  FULL = "FULL",
}

/**
 * How the end user id of a telemetry service leaves the runtime (since 3.26.0).
 *
 * Independent of {@link TelemetryPayloadLevel}: the payload level governs content, this mode governs the end
 * user id at every payload level. Carried per service by {@link DcdrTelemetryServiceSnapshotEntry.endUserIdMode};
 * when the snapshot entry has no mode (a control plane older than 3.26.0) the runtime keeps the earlier rule:
 * sent as reported under FULL, pseudonymised under METADATA and NONE.
 *
 * Since 3.27.0 a service token carries the same setting for the end user named on its gateway calls
 * (`DcdrGatewayTokenCheckResponse.endUserIdMode`); there, absent means {@link PSEUDONYMISED}.
 */
export enum TelemetryEndUserIdMode {
  /**
   * The id is replaced by a keyed pseudonym at every payload level, FULL included (the default for a new
   * service). See {@link telemetryEndUserPseudonym}. When the tenant key is unusable the end user is dropped,
   * never sent in clear.
   */
  PSEUDONYMISED = "PSEUDONYMISED",
  /**
   * The id is sent as reported at every payload level, NONE and METADATA included, cut at 256 characters.
   * Only on the tenant's explicit choice.
   */
  AS_SENT = "AS_SENT",
}

/** Lifecycle of a telemetry service, as the control plane holds it. */
export enum TelemetryServiceStatus {
  /** Seen in automatic discovery mode; accepted. */
  DISCOVERED = "DISCOVERED",
  /** Seen in strict mode and not registered yet: recorded, not accepted. */
  PENDING = "PENDING",
  /** Registered or acknowledged by the tenant; accepted. */
  ACKNOWLEDGED = "ACKNOWLEDGED",
  /** Refused: its telemetry is answered with an all-rejected `partial_success`. */
  BLOCKED = "BLOCKED",
}

/**
 * Policy findings on a telemetry span.
 *
 * The runtime raises only {@link CONTENT_RECEIVED} and {@link UNKNOWN_SERVICE} (as
 * {@link TelemetryExecutionLogDetails.findingsHint}); the control plane computes the others against the
 * tenant's policy.
 */
export enum TelemetryFindingCode {
  PROVIDER_NOT_ALLOWED = "PROVIDER_NOT_ALLOWED",
  MODEL_NOT_ALLOWED = "MODEL_NOT_ALLOWED",
  MODEL_RETIRED = "MODEL_RETIRED",
  /** Content arrived from a service whose payload level is not FULL (it was removed in the runtime). */
  CONTENT_RECEIVED = "CONTENT_RECEIVED",
  /** No `service.name`, or the SDK default `unknown_service[:*]`. */
  UNKNOWN_SERVICE = "UNKNOWN_SERVICE",
}

/** A content field of {@link TelemetrySpanContent} (and of any `CapturedContent`, since 3.27.0). */
export enum TelemetryContentField {
  INPUT = "input",
  OUTPUT = "output",
  SYSTEM = "system",
}

/** Service name used when the app reports none (or the SDK default `unknown_service:*`). */
export const DCDR_TELEMETRY_UNKNOWN_SERVICE_NAME = "unknown_service";

/**
 * Maximum characters (UTF-16 code units) kept per content field (`input`, `output`, `system`) on a FULL service.
 *
 * Since 3.27.0 it is {@link DCDR_CAPTURED_CONTENT_MAX_CHARS}, the one bound shared with gateway content; the value
 * is unchanged (65536).
 */
export const DCDR_TELEMETRY_CONTENT_MAX_CHARS = DCDR_CAPTURED_CONTENT_MAX_CHARS;

/** Maximum keys in {@link TelemetryExecutionLogDetails.unmapped}. */
export const DCDR_TELEMETRY_UNMAPPED_MAX_KEYS = 64;

/** Maximum characters per value in {@link TelemetryExecutionLogDetails.unmapped}. */
export const DCDR_TELEMETRY_UNMAPPED_MAX_VALUE_CHARS = 1_024;

/** Maximum names in {@link TelemetryExecutionLogDetails.droppedResourceKeys}. */
export const DCDR_TELEMETRY_DROPPED_KEYS_MAX = 64;

/** Maximum spans in one runtime -> control plane batch. */
export const DCDR_TELEMETRY_BATCH_MAX_SPANS = 100;

/**
 * Maximum serialized size (UTF-8 bytes of the JSON body) of one runtime -> control plane batch.
 *
 * A batch closes at whichever cap comes first. One span is always far below it (three content fields of at
 * most {@link DCDR_TELEMETRY_CONTENT_MAX_CHARS} each), so a batch always holds at least one span. The control
 * plane's body limit on the ingest route must be at least 5 MB.
 */
export const DCDR_TELEMETRY_BATCH_MAX_BYTES = 4 * 1024 * 1024;

/** The service a span came from, from the OTLP resource. */
export interface TelemetryServiceRef {
  /** `service.name`, or {@link DCDR_TELEMETRY_UNKNOWN_SERVICE_NAME}. */
  name: string;
  /** `deployment.environment.name` (or the older `deployment.environment`). */
  environment?: string;
  /** `service.version` as reported; never inferred. */
  version?: string;
  /** `service.namespace`. */
  namespace?: string;
  /**
   * Id of the control-plane service this span was matched to in the services snapshot. Absent for a service
   * the snapshot does not know yet (discovery happens in the control plane).
   */
  id?: string;
  /** Status of that service in the snapshot the runtime applied. */
  status?: TelemetryServiceStatus;
}

/** Instrumentation scope that produced the span (`InstrumentationScope`). */
export interface TelemetryScopeRef {
  name: string;
  version?: string;
}

/** Agent identity reported on a span (`gen_ai.agent.*` and equivalents). */
export interface TelemetryAgentRef {
  name?: string;
  id?: string;
  version?: string;
}

/** Tool identity reported on a span (`gen_ai.tool.*` and equivalents). */
export interface TelemetryToolRef {
  name?: string;
  /** `function`, `extension`, `datastore`... as reported. */
  type?: string;
  callId?: string;
}

/**
 * End user reported by the app (`user.id`, `enduser.id`, `langfuse.user.id`...).
 *
 * The service's {@link TelemetryEndUserIdMode} decides whether the runtime replaces the value with its pseudonym
 * ({@link telemetryEndUserPseudonym}: `hex(HMAC-SHA256(tenant key, utf8(value)))`) before buffering or sends it
 * as reported. Without a mode (older control plane): pseudonymised under METADATA and NONE, as reported under FULL.
 */
export interface TelemetryEndUser {
  id: string;
  pseudonymised: boolean;
  /**
   * Version of the tenant key used for the HMAC ({@link DcdrTelemetryTenantSettings.userIdKeyVersion}).
   * A rotation changes the pseudonym of the same user; the version tells "same user, new key" apart from
   * "new user". Present only when `pseudonymised` is true.
   */
  keyVersion?: number;
}

/**
 * Content summary sent instead of content (METADATA), and alongside it (FULL).
 *
 * Hashes are keyed: `hex(HMAC-SHA256(tenant key, utf8(text)))` ({@link telemetryEndUserPseudonym}) with the same
 * key and version as {@link TelemetryEndUser}, so a short prompt cannot be confirmed by hashing guesses.
 */
export interface TelemetryContentSummary {
  inputMessageCount?: number;
  outputMessageCount?: number;
  inputChars?: number;
  outputChars?: number;
  systemChars?: number;
  /** Distinct message roles seen (`system`, `user`, `assistant`, `tool`). */
  roles?: string[];
  /** Tool names declared or called. */
  toolNames?: string[];
  toolDefinitionCount?: number;
  toolCallCount?: number;
  /** Retrieval spans: documents returned. */
  documentCount?: number;
  inputHash?: string;
  outputHash?: string;
  systemHash?: string;
  /** Key version the hashes were computed with. */
  hashKeyVersion?: number;
}

/**
 * Content of a span on a FULL service, after the service's processors.
 *
 * Meaning per operation: chat and completions -> messages / response / system instructions; `EXECUTE_TOOL`
 * -> arguments / result; `RETRIEVAL` -> query / documents. Values are the reported content serialized as JSON
 * text (a JSON string stays as reported), each cut at {@link DCDR_TELEMETRY_CONTENT_MAX_CHARS}.
 *
 * Since 3.27.0 it is a {@link CapturedContent} (the shape gateway content shares), which adds the normalised
 * `chat` view; `input`, `output`, `system` and `truncated` keep their meaning. The encoding rules of the strings
 * are documented on `captured-content.contract`.
 */
export interface TelemetrySpanContent extends CapturedContent {}

/**
 * Telemetry block of an `ExecutionLogEvent` with `executionMode: TELEMETRY`.
 *
 * Reused from the event envelope (`ExecutionReport` fields), not repeated here: `cid`, `serviceTokenId`,
 * `status` (`ERROR` when the span status is ERROR), `error` (message and type as reported), `usage`
 * (`promptTokens`, `completionTokens`, `totalTokens`, `cachedPromptTokens`, `cacheWritePromptTokens`),
 * `timing` (`startedAt` / `endedAt` ISO from the span times, `latencyMs`), `context` (allow-listed resource
 * attributes) and `processing` (the processors' report on a FULL service). The envelope's `input` / `output`
 * are **not** used for telemetry: content travels in {@link content}.
 */
export interface TelemetryExecutionLogDetails {
  /** 32 lowercase hex characters. */
  traceId: string;
  /** 16 lowercase hex characters. */
  spanId: string;
  parentSpanId?: string;
  /** Span start, Unix nanoseconds as a decimal string (the control plane's partition key comes from it). */
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  service: TelemetryServiceRef;
  scope?: TelemetryScopeRef;
  spanName: string;
  spanKind: TelemetrySpanKind;
  spanStatus: TelemetrySpanStatusCode;
  operation: TelemetryOperation;
  /** Operation as reported (`chat`, `invoke_agent`, `LLM`, `ai.generateText`...). */
  operationReported?: string;
  /**
   * Provider, when the reported value maps through the fixed table (`openai`, `openai.chat` ->
   * `OPEN_AI`; `anthropic` -> `ANTHROPIC`...). Never inferred from the model name.
   */
  provider?: IntentProvider;
  /** Provider as reported (`gen_ai.provider.name`, `gen_ai.system`, `llm.provider`...). */
  providerReported?: string;
  /** Model requested (`gen_ai.request.model`). */
  requestModel?: string;
  /** Model that answered (`gen_ai.response.model`). */
  responseModel?: string;
  /** `gen_ai.response.id`. */
  responseId?: string;
  agent?: TelemetryAgentRef;
  tool?: TelemetryToolRef;
  /** `gen_ai.conversation.id`, `session.id`... as reported. */
  conversationId?: string;
  endUser?: TelemetryEndUser;
  finishReasons?: string[];
  /** Reasoning tokens (`gen_ai.usage.reasoning.output_tokens` and equivalents); a subset of completion tokens. */
  reasoningTokens?: number;
  sourceConvention: TelemetrySourceConvention;
  conventionsSeen?: TelemetrySourceConvention[];
  /** `schema_url` of the resource or scope, as reported. */
  schemaUrl?: string;
  /** Payload level the runtime applied. */
  payloadLevel: TelemetryPayloadLevel;
  /** Whether the app sent content on this span (prompts, completions, tool arguments...), whatever was kept. */
  contentReceived: boolean;
  contentSummary?: TelemetryContentSummary;
  /** FULL only. */
  content?: TelemetrySpanContent;
  /** Findings the runtime can tell on its own: {@link TelemetryFindingCode.CONTENT_RECEIVED}, `UNKNOWN_SERVICE`. */
  findingsHint?: TelemetryFindingCode[];
  /**
   * Span attributes no mapping table consumed, content keys excluded, values as text. Bounded:
   * {@link DCDR_TELEMETRY_UNMAPPED_MAX_KEYS} keys, {@link DCDR_TELEMETRY_UNMAPPED_MAX_VALUE_CHARS} per value.
   */
  unmapped?: Record<string, string>;
  /** Names (never values) of resource attributes dropped by the allow-list (`host.*`, `process.*`...). */
  droppedResourceKeys?: string[];
  /** Span events seen / links seen, for the trace view. */
  eventCount?: number;
  linkCount?: number;
  /** When the runtime received the request (ISO). */
  receivedAt: string;
}

/** One telemetry service in the services snapshot. */
export interface DcdrTelemetryServiceSnapshotEntry {
  id: string;
  serviceName: string;
  /** `null` = the service has no environment (matches spans without one). */
  environment: string | null;
  status: TelemetryServiceStatus;
  payloadLevel: TelemetryPayloadLevel;
  /** The service's own processors (same shape as intent processors). INPUT stage runs on input and system content, OUTPUT on output. */
  processors?: ProcessingProcessor[];
  /** Whether the tenant's global processors (the registry's `processors`) run before the service's own. */
  applyGlobalProcessors: boolean;
  /**
   * How the service's end user id leaves the runtime, at every payload level (since 3.26.0). Absent (a control
   * plane older than 3.26.0): sent as reported under FULL, pseudonymised under METADATA and NONE.
   */
  endUserIdMode?: TelemetryEndUserIdMode;
}

/** Tenant-wide telemetry settings carried by the snapshot. */
export interface DcdrTelemetryTenantSettings {
  /** The tenant's plan includes telemetry. When `false` the receivers answer 403 for every request of this tenant. */
  enabled: boolean;
  /** Strict mode: only registered services are accepted; unknown ones are recorded (PENDING) and refused. */
  strictMode: boolean;
  /**
   * Per-tenant key for `user.id` pseudonyms and content hashes: 32 random bytes, base64. Never logged on
   * either side. Delivered only on the per-tenant snapshot route.
   */
  userIdKey: string;
  /** Increments on every rotation; part of the snapshot ETag. */
  userIdKeyVersion: number;
  /** Monthly span quota. `null` = unlimited. Over quota the receivers answer 429 with `Retry-After`. */
  maxSpansPerMonth: number | null;
  /** Spans the control plane counted in the current period when it built the snapshot. */
  spansUsedThisPeriod: number;
  /** Period of that count, `YYYY-MM` (UTC). */
  periodKey: string;
}

/**
 * Per-tenant telemetry services snapshot (`GET /api/dcdr/telemetry/services_snapshot?cid=<cid>`).
 *
 * A tenant without services gets `services: []` with its settings (never a 404): strict mode, the key and the
 * quota already apply to the first span of an unknown service. The ETag covers the whole body, the key version
 * included.
 */
export interface DcdrTelemetryServicesSnapshot {
  cid: string;
  generatedAt: string;
  settings: DcdrTelemetryTenantSettings;
  services: DcdrTelemetryServiceSnapshotEntry[];
}

/** Control plane answer to an ingest batch. */
export interface DcdrTelemetryIngestResponse {
  /** Spans enqueued. */
  accepted: number;
}

/**
 * Idempotency key of a telemetry span: `cid:traceId:spanId`.
 *
 * Trace ids are chosen by the client, so two tenants can send the same one: the customer is part of the key.
 * OTLP exporters retry, so the control plane stores a span once per key.
 *
 * @param cid Customer id.
 * @param traceId 32-hex trace id.
 * @param spanId 16-hex span id.
 * @returns The key.
 */
export function telemetrySpanIdempotencyKey(cid: string, traceId: string, spanId: string): string {
  return `${cid}:${String(traceId).toLowerCase()}:${String(spanId).toLowerCase()}`;
}

/**
 * Finds the snapshot entry a span belongs to: same service name and same environment (a missing environment
 * matches only an entry whose environment is `null`).
 *
 * @param snapshot Tenant snapshot.
 * @param serviceName `service.name` as normalized.
 * @param environment Environment as reported, if any.
 * @returns The entry, or `undefined` for a service the control plane does not know yet.
 */
export function findDcdrTelemetryService(
  snapshot: Pick<DcdrTelemetryServicesSnapshot, "services"> | null | undefined,
  serviceName: string,
  environment?: string | null,
): DcdrTelemetryServiceSnapshotEntry | undefined {
  const env = environment === undefined || environment === "" ? null : environment;
  return (snapshot?.services ?? []).find((s) => s.serviceName === serviceName && (s.environment ?? null) === env);
}

/**
 * Whether the runtime accepts a service's telemetry.
 *
 * Unknown services are accepted in automatic mode and refused in strict mode; `PENDING` and `BLOCKED` are refused.
 *
 * @param settings Tenant settings.
 * @param entry Snapshot entry, `undefined` for an unknown service.
 * @returns `true` when the spans are accepted.
 */
export function isDcdrTelemetryServiceAccepted(
  settings: Pick<DcdrTelemetryTenantSettings, "enabled" | "strictMode">,
  entry: Pick<DcdrTelemetryServiceSnapshotEntry, "status"> | undefined,
): boolean {
  if (!settings.enabled) return false;
  if (!entry) return !settings.strictMode;
  return entry.status === TelemetryServiceStatus.DISCOVERED || entry.status === TelemetryServiceStatus.ACKNOWLEDGED;
}

// ---------------------------------------------------------------------------------------------------
// End-user pseudonym and keyed hashes (since 3.26.0)
// ---------------------------------------------------------------------------------------------------

/** One running HMAC computation (Node's `crypto.Hmac` satisfies it). */
export interface TelemetryHmac {
  /** Adds `data`, encoded as UTF-8, to the input. */
  update(data: string, inputEncoding: "utf8"): TelemetryHmac;
  /** Ends the computation; lowercase hex. */
  digest(encoding: "hex"): string;
}

/**
 * HMAC primitive injected by the caller, so this module never imports `crypto` (it is bundled for the web too).
 * Node's `crypto` module satisfies it as is: `telemetryEndUserPseudonym(crypto, key, value)`.
 */
export interface TelemetryHmacDeps {
  /** Starts an HMAC-SHA256 computation with the raw key bytes. */
  createHmac(algorithm: "sha256", key: Uint8Array): TelemetryHmac;
}

/** One reference input and result of {@link telemetryEndUserPseudonym}. */
export interface DcdrTelemetryPseudonymTestVector {
  /** Tenant key, base64 (as in {@link DcdrTelemetryTenantSettings.userIdKey}). */
  key: string;
  /** End user id exactly as the app reported it. */
  value: string;
  /** Expected pseudonym: `hex(HMAC-SHA256(key bytes, utf8(value)))`, lowercase. */
  expected: string;
}

/** Shortest decoded tenant key accepted for pseudonyms and hashes, in bytes (the control plane issues 32). */
export const DCDR_TELEMETRY_HASH_KEY_MIN_BYTES = 16;

/**
 * Reference vectors for {@link telemetryEndUserPseudonym}, computed with Node's `crypto`. Any other
 * implementation (the control plane looking a user up by id, another language) must reproduce every one.
 * They pin UTF-8 encoding of non-ASCII ids, no case folding (`ada@` and `Ada@` differ) and that the full
 * reported id is hashed, not the 256-character cut used when an id is sent as reported.
 */
export const DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS: readonly DcdrTelemetryPseudonymTestVector[] = Object.freeze([
  {
    key: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
    value: "ada@example.com",
    expected: "5c820b4a5aac8f31eb6741825bfecb8e97f00488d5edaed1ae2908c29d0b7e38",
  },
  {
    key: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
    value: "Ada@Example.com",
    expected: "787fbfb0243a60f5d91d9566ce05f7a4a95af00d677ecd983c814deca9dce3a2",
  },
  {
    key: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
    value: "José@ejemplo.es",
    expected: "29248a3e0ce6ca4ec7097d96990947ad859aad99fb116c2a36e40f16c3cd1173",
  },
  {
    key: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
    value: "用户-😀",
    expected: "9cfaf98d85373ed8be6c231b3bada83a13a4df96768778e501b55ce9e48d5f9d",
  },
  {
    // 325 characters: longer than the 256-character cut of an id sent as reported.
    key: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
    value: "user-" + "0123456789abcdef".repeat(20),
    expected: "b142f9326d0957150f43e2a2a390a6a2a5a7cb21105b74adfddc54b987cff002",
  },
  {
    // The shortest usable key (16 bytes).
    key: "oKGio6SlpqeoqaqrrK2urw==",
    value: "ada@example.com",
    expected: "9656eb275fd81bae4b35600d68d637d7fc1b78786951b439b73e6f9cfb1680b3",
  },
].map((v) => Object.freeze(v)));

/** Standard and URL-safe base64 alphabets share one table: `+` and `-` are 62, `/` and `_` are 63. */
const BASE64_SEXTETS: Readonly<Record<string, number>> = (() => {
  const table: Record<string, number> = {};
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let i = 0; i < alphabet.length; i++) table[alphabet[i]] = i;
  table["-"] = 62;
  table["_"] = 63;
  return Object.freeze(table);
})();

/**
 * Decodes a tenant telemetry key (base64) into its bytes.
 *
 * Same rules as Node's `Buffer.from(key, "base64")`, without `Buffer`, so the result is identical in the runtime,
 * the control plane and a browser: standard and URL-safe alphabets, characters outside them skipped (whitespace
 * included), decoding stops at the first `=`, a trailing group of 2 or 3 characters yields 1 or 2 bytes (a lone
 * character yields none), and each UTF-16 code unit is read by its low byte as Node does.
 *
 * @param base64Key Key text.
 * @returns The key bytes, or `undefined` when the key is unusable: not a string, empty, or shorter than
 *   {@link DCDR_TELEMETRY_HASH_KEY_MIN_BYTES} once decoded (nothing is pseudonymised or hashed with a weak key).
 */
export function decodeTelemetryHashKey(base64Key: string): Uint8Array | undefined {
  if (!base64Key || typeof base64Key !== "string") return undefined;
  const bytes: number[] = [];
  let acc = 0;
  let sextets = 0;
  for (let i = 0; i < base64Key.length; i++) {
    const ch = String.fromCharCode(base64Key.charCodeAt(i) & 0xff);
    const v = Object.prototype.hasOwnProperty.call(BASE64_SEXTETS, ch) ? BASE64_SEXTETS[ch] : undefined;
    if (v === undefined) {
      if (ch === "=") break;
      continue;
    }
    acc = (acc << 6) | v;
    sextets++;
    if (sextets === 4) {
      bytes.push((acc >> 16) & 0xff, (acc >> 8) & 0xff, acc & 0xff);
      acc = 0;
      sextets = 0;
    }
  }
  if (sextets === 2) bytes.push((acc >> 4) & 0xff);
  else if (sextets === 3) bytes.push((acc >> 10) & 0xff, (acc >> 2) & 0xff);
  return bytes.length >= DCDR_TELEMETRY_HASH_KEY_MIN_BYTES ? Uint8Array.from(bytes) : undefined;
}

/**
 * Keyed pseudonym of an end user id: `hex(HMAC-SHA256(key bytes, utf8(value)))`, lowercase.
 *
 * The single implementation of the telemetry keyed hash: the runtime computes end user pseudonyms and the
 * content summary hashes ({@link TelemetryContentSummary.inputHash} and siblings) with it. To find a user's
 * spans, hash the id exactly as the app reports it (no trimming, no case folding, the full id even when it is
 * longer than 256 characters) with every key version the tenant has had, and match each result against
 * {@link TelemetryEndUser.id} with the same {@link TelemetryEndUser.keyVersion}.
 *
 * @param deps HMAC primitive (Node: the `crypto` module).
 * @param base64Key Tenant key, base64 ({@link DcdrTelemetryTenantSettings.userIdKey}).
 * @param value Value to pseudonymise.
 * @returns The 64-character hex pseudonym, or `undefined` when the key is unusable ({@link decodeTelemetryHashKey}).
 */
export function telemetryEndUserPseudonym(deps: TelemetryHmacDeps, base64Key: string, value: string): string | undefined {
  const key = decodeTelemetryHashKey(base64Key);
  if (!key) return undefined;
  return deps.createHmac("sha256", key).update(value, "utf8").digest("hex");
}

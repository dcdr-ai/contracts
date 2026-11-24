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
 * Same vocabulary as workflow payload logging. Default for a new service: {@link METADATA}.
 */
export enum TelemetryPayloadLevel {
  /** No content and no content summary. */
  NONE = "NONE",
  /** No content; a {@link TelemetryContentSummary} (counts, roles, tool names, keyed hashes). */
  METADATA = "METADATA",
  /** Content after the service's processors, bounded per field ({@link DCDR_TELEMETRY_CONTENT_MAX_CHARS}). */
  FULL = "FULL",
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

/** A content field of {@link TelemetrySpanContent}. */
export enum TelemetryContentField {
  INPUT = "input",
  OUTPUT = "output",
  SYSTEM = "system",
}

/** Service name used when the app reports none (or the SDK default `unknown_service:*`). */
export const DCDR_TELEMETRY_UNKNOWN_SERVICE_NAME = "unknown_service";

/** Maximum characters kept per content field (`input`, `output`, `system`) on a FULL service. */
export const DCDR_TELEMETRY_CONTENT_MAX_CHARS = 65_536;

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
 * Under METADATA (and NONE) the runtime replaces the value with
 * `hex(HMAC-SHA256(tenant key, value))` before buffering; under FULL it is sent as reported.
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
 * Hashes are keyed: `hex(HMAC-SHA256(tenant key, utf8(text)))` with the same key and version as
 * {@link TelemetryEndUser}, so a short prompt cannot be confirmed by hashing guesses.
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
 */
export interface TelemetrySpanContent {
  input?: string;
  output?: string;
  system?: string;
  /** Fields that were cut at the bound. */
  truncated?: TelemetryContentField[];
}

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

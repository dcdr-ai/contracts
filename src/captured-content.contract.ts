/**
 * Captured content: the prompts and answers of one AI call, as the runtime hands them to the control plane
 * (since 3.27.0).
 *
 * Two producers share this one shape:
 * - **Telemetry** ({@link TelemetrySpanContent}, in `telemetry.contract`): the content an external AI app reported
 *   on an OpenTelemetry span, on a service whose payload level is FULL.
 * - **The AI Gateway** (`GatewayExecutionLogDetails.content`, in `logs.contract`): the request and response of a
 *   `/v1/*` call, on a service token whose payload level is FULL.
 *
 * The three strings (`input`, `output`, `system`) are the content **as reported**: their encoding rules are part
 * of the contract, their inner shape is whatever the SDK or the wire carried. A consumer that needs to read
 * messages uses {@link CapturedContent.chat}, a normalised view the runtime builds when it can; it must never parse
 * the strings by the span's source convention (a convention names the operation table, not the content shape).
 *
 * Encoding rules of the strings
 * - Telemetry: a string attribute is kept as reported; a structured attribute (array, map) is serialised as JSON
 *   text; several attributes feeding one field become one JSON object keyed by attribute name; content reported
 *   as log events becomes a JSON array of messages.
 * - Gateway: `JSON.stringify` of the request or response member of the surface (for example `messages` of a chat
 *   completion, the `response` object of the Responses API), so the text is valid JSON unless it was cut.
 * - Cut: a field longer than {@link DCDR_CAPTURED_CONTENT_MAX_CHARS} UTF-16 code units is cut to a plain prefix of
 *   at most that many units, never splitting a surrogate pair. A cut field is not valid JSON and is **always**
 *   listed in {@link CapturedContent.truncated}.
 *
 * Processors (the tenant's and the service's) have already run on every field when it leaves the runtime.
 *
 * `TelemetryContentField` is imported as a type only, so this module has no runtime import of
 * `telemetry.contract` (which imports this one): there is no module cycle at run time.
 */
import type { TelemetryContentField } from "./telemetry.contract";

/**
 * Maximum UTF-16 code units kept per content field (`input`, `output`, `system`).
 *
 * The same bound for telemetry and the gateway; `DCDR_TELEMETRY_CONTENT_MAX_CHARS` is this value.
 */
export const DCDR_CAPTURED_CONTENT_MAX_CHARS = 65_536;

/**
 * Role of a message in {@link CapturedChatContent}.
 *
 * Normalised from the role the SDK or the wire reported (`system`, `developer`, `user`, `assistant`, `tool`, and
 * their equivalents such as `human` / `ai` / `model` / `function`). A role the table does not recognise is
 * {@link OTHER}, never guessed.
 */
export enum CapturedChatRole {
  /** System instructions. */
  SYSTEM = "system",
  /** Developer instructions (OpenAI's successor of `system` for reasoning models). */
  DEVELOPER = "developer",
  /** The end user (or the app speaking for them). */
  USER = "user",
  /** The model. */
  ASSISTANT = "assistant",
  /** A tool result handed back to the model. */
  TOOL = "tool",
  /** A role the normalisation table does not know. */
  OTHER = "other",
}

/** Why content was not attached to a gateway log although the payload level is FULL. */
export enum CapturedContentWithheldReason {
  /**
   * The tenant's global processors could not be loaded, so the content could not be processed before leaving
   * the runtime. The content is dropped (never sent unprocessed); the content summary is still sent.
   */
  PROCESSORS_UNAVAILABLE = "PROCESSORS_UNAVAILABLE",
  /** A processor denied every captured field. The call itself was not blocked: processors act on the copy only. */
  PROCESSOR_BLOCKED = "PROCESSOR_BLOCKED",
}

/** One tool call requested by the model, in {@link CapturedChatMessage.toolCalls}. */
export interface CapturedChatToolCall {
  /** Tool call id as reported, when there is one (it links the call to the `tool` message that answers it). */
  id?: string;
  /** Tool (function) name as reported. */
  name: string;
  /** Arguments as JSON text, exactly as the model sent them (not re-serialised, not validated). */
  arguments?: string;
}

/** One message of {@link CapturedChatContent}. */
export interface CapturedChatMessage {
  /** Normalised role. */
  role: CapturedChatRole;
  /** Text parts of the message joined with `"\n"`. Absent when the message has no text part. */
  text?: string;
  /** Tool calls the model requested in this message (assistant messages). */
  toolCalls?: CapturedChatToolCall[];
  /** For a `tool` message: the id of the tool call it answers. */
  toolCallId?: string;
  /** Number of non-text parts left out (images, audio, files, refusals...). Absent when none was left out. */
  omittedParts?: number;
}

/**
 * Normalised chat view of a captured content block: the same messages, whatever the SDK or wire format.
 *
 * System instructions reported apart from the messages appear as a leading {@link CapturedChatRole.SYSTEM}
 * message of {@link messages}.
 */
export interface CapturedChatContent {
  /** Messages sent to the model, in order. */
  messages: CapturedChatMessage[];
  /** Messages the model produced (one per choice or output item), in order. Absent when there is no output. */
  output?: CapturedChatMessage[];
}

/**
 * Content of one AI call, after processors, bounded per field.
 *
 * Meaning per operation or surface: chat and completions -> messages / response / system instructions;
 * `EXECUTE_TOOL` spans -> arguments / result; `RETRIEVAL` spans -> query / documents; gateway embeddings -> the
 * `input` only. Encoding rules are in the module documentation.
 */
export interface CapturedContent {
  /** What was sent to the model (messages, prompt, tool arguments, query...), as JSON text or as reported. */
  input?: string;
  /** What the model or tool produced (completion, response object, tool result, documents...). */
  output?: string;
  /** System instructions reported apart from the messages, when there were any. */
  system?: string;
  /** Fields that were cut at {@link DCDR_CAPTURED_CONTENT_MAX_CHARS}. A cut field is not valid JSON. */
  truncated?: TelemetryContentField[];
  /**
   * Normalised chat view. Present only when every source field parsed and none was cut: it is built from the
   * processed text, so it never shows content the processors removed, and it is omitted rather than partial.
   */
  chat?: CapturedChatContent;
}

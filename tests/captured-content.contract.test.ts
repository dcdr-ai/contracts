/// <reference types="jest" />

/**
 * Captured content (3.27.0, #5196 / #5197). Every enum value here is wire-level between the runtime and the control
 * plane, so each is pinned; the round-trips prove the new optional fields survive JSON, and the "3.26 shape" cases
 * prove the change is additive (an event, token check or snapshot written against 3.26.0 still type-checks).
 */
import {
  CapturedChatContent,
  CapturedChatRole,
  CapturedContent,
  CapturedContentWithheldReason,
  DCDR_CAPTURED_CONTENT_MAX_CHARS,
} from "../src/captured-content.contract";
import { CapabilityKey } from "../src/capabilities.contract";
import { ExecutionStatus } from "../src/execution.contract";
import { ExecutionLogEvent, ExecutionLogMode, GatewayExecutionLogDetails, GatewayLogSurface } from "../src/logs.contract";
import { ProcessingProcessor } from "../src/processing.contract";
import { IntentProvider } from "../src/provider.contract";
import {
  DcdrGatewayTokenCheckResponse,
  DcdrServiceTokenSnapshotItem,
  DcdrServiceTokensContentSettings,
  DcdrServiceTokensSnapshotContract,
} from "../src/service-tokens.contract";
import {
  DCDR_TELEMETRY_CONTENT_MAX_CHARS,
  TelemetryContentField,
  TelemetryEndUserIdMode,
  TelemetryPayloadLevel,
  TelemetrySpanContent,
} from "../src/telemetry.contract";
import * as barrel from "../src/index";

/** `TelemetrySpanContent` exactly as published in 3.26.0, for the backward-compatibility checks. */
interface TelemetrySpanContent326 {
  input?: string;
  output?: string;
  system?: string;
  truncated?: TelemetryContentField[];
}

/**
 * JSON round-trip, as the runtime -> control plane transport does it.
 *
 * @param value Any JSON-serialisable value.
 * @returns A deep copy produced by `JSON.stringify` + `JSON.parse`.
 */
function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const chat: CapturedChatContent = {
  messages: [
    { role: CapturedChatRole.SYSTEM, text: "Be brief." },
    { role: CapturedChatRole.USER, text: "Weather in Madrid?\nAnd Seville?", omittedParts: 1 },
    {
      role: CapturedChatRole.ASSISTANT,
      toolCalls: [{ id: "call_1", name: "get_weather", arguments: '{"city":"Madrid"}' }],
    },
    { role: CapturedChatRole.TOOL, toolCallId: "call_1", text: '{"tempC":21}' },
  ],
  output: [{ role: CapturedChatRole.ASSISTANT, text: "21 C in Madrid." }],
};

describe("captured-content.contract", () => {
  it("pins the wire values of CapturedChatRole and CapturedContentWithheldReason", () => {
    expect(Object.values(CapturedChatRole)).toEqual(["system", "developer", "user", "assistant", "tool", "other"]);
    expect(Object.values(CapturedContentWithheldReason)).toEqual(["PROCESSORS_UNAVAILABLE", "PROCESSOR_BLOCKED"]);
  });

  it("keeps one content bound: DCDR_TELEMETRY_CONTENT_MAX_CHARS is DCDR_CAPTURED_CONTENT_MAX_CHARS (65536)", () => {
    expect(DCDR_CAPTURED_CONTENT_MAX_CHARS).toBe(65_536);
    expect(DCDR_TELEMETRY_CONTENT_MAX_CHARS).toBe(DCDR_CAPTURED_CONTENT_MAX_CHARS);
  });

  it("round-trips a CapturedContent with the normalised chat view", () => {
    const content: CapturedContent = {
      input: JSON.stringify([{ role: "user", content: "Weather in Madrid?" }]),
      output: JSON.stringify({ object: "chat.completion" }),
      system: "Be brief.",
      chat,
    };
    expect(roundTrip(content)).toEqual(content);
  });

  it("round-trips a cut content block: truncated lists the field, chat is omitted", () => {
    const content: CapturedContent = {
      input: "x".repeat(DCDR_CAPTURED_CONTENT_MAX_CHARS),
      truncated: [TelemetryContentField.INPUT],
    };
    const copy = roundTrip(content);
    expect(copy.truncated).toEqual(["input"]);
    expect(copy.chat).toBeUndefined();
    expect(copy.input).toHaveLength(DCDR_CAPTURED_CONTENT_MAX_CHARS);
  });

  it("TelemetrySpanContent is a CapturedContent and stays compatible with the 3.26.0 shape", () => {
    const old: TelemetrySpanContent326 = { input: "[]", output: "{}", system: "s", truncated: [TelemetryContentField.OUTPUT] };
    // 3.26 value -> 3.27 type.
    const span: TelemetrySpanContent = old;
    // 3.27 value (with chat) -> CapturedContent and back to a 3.26-shaped consumer type.
    const withChat: TelemetrySpanContent = { ...span, chat };
    const asCaptured: CapturedContent = withChat;
    const asOld: TelemetrySpanContent326 = withChat;
    expect(asCaptured.chat?.messages).toHaveLength(4);
    expect(asOld.truncated).toEqual(["output"]);
  });

  it("round-trips a gateway log with every 3.27.0 content field", () => {
    const gateway: GatewayExecutionLogDetails = {
      surface: GatewayLogSurface.CHAT_COMPLETIONS,
      route: "/v1/chat/completions",
      httpStatus: 200,
      dispatched: true,
      resolvedProvider: IntentProvider.OPEN_AI,
      payloadLevel: TelemetryPayloadLevel.FULL,
      contentReceived: true,
      contentSummary: { inputMessageCount: 2, outputMessageCount: 1, inputHash: "ab", hashKeyVersion: 3 },
      content: { input: "[]", output: "{}", truncated: [TelemetryContentField.OUTPUT] },
      endUser: { id: "f".repeat(64), pseudonymised: true, keyVersion: 3 },
      streamInterrupted: true,
    };
    const event: ExecutionLogEvent = { executionMode: ExecutionLogMode.GATEWAY, status: ExecutionStatus.OK, gateway };
    const copy = roundTrip(event);
    expect(copy).toEqual(event);
    expect(copy.gateway?.payloadLevel).toBe("FULL");
    expect(copy.gateway?.content?.truncated).toEqual(["output"]);

    const withheld: GatewayExecutionLogDetails = {
      surface: GatewayLogSurface.RESPONSES,
      route: "/v1/responses",
      payloadLevel: TelemetryPayloadLevel.FULL,
      contentReceived: true,
      contentSummary: { inputChars: 10 },
      contentWithheld: CapturedContentWithheldReason.PROCESSORS_UNAVAILABLE,
    };
    expect(roundTrip(withheld).contentWithheld).toBe("PROCESSORS_UNAVAILABLE");
  });

  it("accepts a 3.26.0 gateway log (no content fields)", () => {
    const old: GatewayExecutionLogDetails = {
      surface: GatewayLogSurface.MESSAGES,
      route: "/v1/messages",
      httpStatus: 200,
      dispatched: true,
      traceId: "0".repeat(32),
      parentSpanId: "0".repeat(16),
    };
    const copy = roundTrip(old);
    expect(copy.payloadLevel).toBeUndefined();
    expect(copy.content).toBeUndefined();
  });

  it("round-trips the token content settings on the token check, its token block and the snapshot item", () => {
    const processors: ProcessingProcessor[] = [];
    const check: DcdrGatewayTokenCheckResponse = {
      valid: true,
      cid: "c1",
      tokenId: "t1",
      payloadLevel: TelemetryPayloadLevel.METADATA,
      endUserIdMode: TelemetryEndUserIdMode.AS_SENT,
      processors,
      applyGlobalProcessors: true,
      token: {
        id: "t1",
        payloadLevel: TelemetryPayloadLevel.METADATA,
        endUserIdMode: TelemetryEndUserIdMode.AS_SENT,
        processors,
        applyGlobalProcessors: true,
      },
    };
    expect(roundTrip(check)).toEqual(check);
    // The tenant key never travels on the token check.
    expect(Object.keys(check)).not.toContain("contentSettings");

    const item: DcdrServiceTokenSnapshotItem = {
      id: "t1",
      sha256: "abc",
      status: "ACTIVE",
      scopes: ["gateway"],
      payloadLevel: TelemetryPayloadLevel.FULL,
      endUserIdMode: TelemetryEndUserIdMode.PSEUDONYMISED,
      processors,
      applyGlobalProcessors: false,
    };
    expect(roundTrip(item)).toEqual(item);
  });

  it("round-trips contentSettings on the per-tenant snapshot, and a 3.26.0 snapshot still type-checks", () => {
    const contentSettings: DcdrServiceTokensContentSettings = { userIdKey: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=", userIdKeyVersion: 2 };
    const snapshot: DcdrServiceTokensSnapshotContract = { cid: "c1", tokens: [], iat: 1, contentSettings };
    expect(roundTrip(snapshot).contentSettings).toEqual(contentSettings);

    const old: DcdrServiceTokensSnapshotContract = { cid: "c1", tokens: [{ id: "t1", sha256: "abc", status: "ACTIVE", scopes: [] }] };
    const oldCheck: DcdrGatewayTokenCheckResponse = { valid: true, token: { id: "t1", scopes: ["gateway"] } };
    expect(roundTrip(old).contentSettings).toBeUndefined();
    expect(roundTrip(oldCheck).payloadLevel).toBeUndefined();
  });

  it("pins CapabilityKey.AI_GATEWAY_CONTENT_CAPTURE", () => {
    expect(CapabilityKey.AI_GATEWAY_CONTENT_CAPTURE).toBe("AI_GATEWAY_CONTENT_CAPTURE");
  });

  it("is exported from the root barrel", () => {
    expect(barrel.CapturedChatRole.ASSISTANT).toBe("assistant");
    expect(barrel.CapturedContentWithheldReason.PROCESSOR_BLOCKED).toBe("PROCESSOR_BLOCKED");
    expect(barrel.DCDR_CAPTURED_CONTENT_MAX_CHARS).toBe(65_536);
    expect(barrel.DCDR_TELEMETRY_CONTENT_MAX_CHARS).toBe(65_536);
  });
});

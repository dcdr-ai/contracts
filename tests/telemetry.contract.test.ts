/// <reference types="jest" />

/**
 * Telemetry contract (Feature #5125, 3.25.0). Every enum value here is wire-level between the runtime and the
 * control plane (stored in columns, compared in SQL), so each one is pinned; the helpers encode the rules both
 * sides must apply identically (idempotency key, service matching, acceptance).
 */
import {
  DcdrTelemetryIngestRequest,
  ExecutionLogMode,
  isTelemetryExecutionLogEvent,
  TelemetryExecutionLogEvent,
} from "../src/logs.contract";
import { ExecutionStatus } from "../src/execution.contract";
import { IntentProvider } from "../src/provider.contract";
import { DcdrServiceTokenScope, hasDcdrServiceTokenScope } from "../src/service-tokens.contract";
import {
  DCDR_TELEMETRY_BATCH_MAX_BYTES,
  DCDR_TELEMETRY_BATCH_MAX_SPANS,
  DCDR_TELEMETRY_CONTENT_MAX_CHARS,
  DCDR_TELEMETRY_UNKNOWN_SERVICE_NAME,
  DcdrTelemetryServicesSnapshot,
  findDcdrTelemetryService,
  isDcdrTelemetryServiceAccepted,
  TelemetryContentField,
  TelemetryFindingCode,
  TelemetryOperation,
  TelemetryPayloadLevel,
  TelemetryServiceStatus,
  TelemetrySourceConvention,
  TelemetrySpanKind,
  TelemetrySpanStatusCode,
  telemetrySpanIdempotencyKey,
} from "../src/telemetry.contract";
import * as barrel from "../src/index";

/**
 * A snapshot with one service per status, plus one without environment.
 *
 * @param strictMode Tenant strict mode.
 * @param enabled Whether the plan includes telemetry.
 * @returns The snapshot.
 */
function snapshot(strictMode: boolean, enabled = true): DcdrTelemetryServicesSnapshot {
  return {
    cid: "c1",
    generatedAt: "2026-11-23T00:00:00.000Z",
    settings: {
      enabled,
      strictMode,
      userIdKey: "a2V5",
      userIdKeyVersion: 1,
      maxSpansPerMonth: 500_000,
      spansUsedThisPeriod: 0,
      periodKey: "2026-11",
    },
    services: [
      { id: "s1", serviceName: "support-bot", environment: "prod", status: TelemetryServiceStatus.ACKNOWLEDGED, payloadLevel: TelemetryPayloadLevel.METADATA, applyGlobalProcessors: true },
      { id: "s2", serviceName: "support-bot", environment: null, status: TelemetryServiceStatus.DISCOVERED, payloadLevel: TelemetryPayloadLevel.NONE, applyGlobalProcessors: false },
      { id: "s3", serviceName: "shadow", environment: "prod", status: TelemetryServiceStatus.BLOCKED, payloadLevel: TelemetryPayloadLevel.METADATA, applyGlobalProcessors: true },
      { id: "s4", serviceName: "pending", environment: "prod", status: TelemetryServiceStatus.PENDING, payloadLevel: TelemetryPayloadLevel.METADATA, applyGlobalProcessors: true },
    ],
  };
}

/**
 * A minimal valid telemetry event.
 *
 * @returns The event.
 */
function event(): TelemetryExecutionLogEvent {
  return {
    executionMode: ExecutionLogMode.TELEMETRY,
    status: ExecutionStatus.OK,
    cid: "c1",
    serviceTokenId: "tok-1",
    usage: { promptTokens: 12, completionTokens: 30, totalTokens: 42, cachedPromptTokens: 4 },
    timing: { startedAt: "2026-11-23T10:00:00.000Z", endedAt: "2026-11-23T10:00:01.250Z", latencyMs: 1250 },
    context: { "deployment.environment.name": "prod" },
    telemetry: {
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
      parentSpanId: "00f067aa0ba902b7",
      startTimeUnixNano: "1795428000000000000",
      endTimeUnixNano: "1795428001250000000",
      service: { name: "support-bot", environment: "prod", version: "1.4.2", id: "s1", status: TelemetryServiceStatus.ACKNOWLEDGED },
      scope: { name: "opentelemetry.instrumentation.openai_v2", version: "2.4b0" },
      spanName: "chat gpt-4o-mini",
      spanKind: TelemetrySpanKind.CLIENT,
      spanStatus: TelemetrySpanStatusCode.UNSET,
      operation: TelemetryOperation.CHAT,
      operationReported: "chat",
      provider: IntentProvider.OPEN_AI,
      providerReported: "openai",
      requestModel: "gpt-4o-mini",
      responseModel: "gpt-4o-mini-2024-07-18",
      endUser: { id: "f".repeat(64), pseudonymised: true, keyVersion: 1 },
      finishReasons: ["stop"],
      sourceConvention: TelemetrySourceConvention.GEN_AI,
      conventionsSeen: [TelemetrySourceConvention.GEN_AI],
      payloadLevel: TelemetryPayloadLevel.METADATA,
      contentReceived: true,
      contentSummary: { inputMessageCount: 2, outputMessageCount: 1, roles: ["system", "user", "assistant"], inputHash: "ab", hashKeyVersion: 1 },
      findingsHint: [TelemetryFindingCode.CONTENT_RECEIVED],
      unmapped: { "gen_ai.openai.request.service_tier": "auto" },
      droppedResourceKeys: ["host.name", "process.command_line"],
      receivedAt: "2026-11-23T10:00:02.000Z",
    },
  };
}

describe("telemetry.contract wire values", () => {
  it("pins the execution log mode and the scope", () => {
    expect(ExecutionLogMode.TELEMETRY).toBe("TELEMETRY");
    expect(ExecutionLogMode.INTENT).toBe("INTENT");
    expect(ExecutionLogMode.GATEWAY).toBe("GATEWAY");
    expect(DcdrServiceTokenScope.TRACES_WRITE).toBe("traces:write");
    // `logs:write` keeps its runtime write-back meaning and does not grant telemetry, nor the reverse.
    expect(hasDcdrServiceTokenScope(["logs:write"], DcdrServiceTokenScope.TRACES_WRITE)).toBe(false);
    expect(hasDcdrServiceTokenScope(["traces:write"], DcdrServiceTokenScope.LOGS_WRITE)).toBe(false);
  });

  it("pins every enum value", () => {
    expect(Object.values(TelemetryOperation)).toEqual([
      "CHAT", "TEXT_COMPLETION", "GENERATE_CONTENT", "EMBEDDINGS", "EXECUTE_TOOL", "INVOKE_AGENT",
      "INVOKE_WORKFLOW", "CREATE_AGENT", "RETRIEVAL", "PLAN", "OTHER",
    ]);
    expect(Object.values(TelemetrySpanKind)).toEqual(["UNSPECIFIED", "INTERNAL", "SERVER", "CLIENT", "PRODUCER", "CONSUMER"]);
    expect(Object.values(TelemetrySpanStatusCode)).toEqual(["UNSET", "OK", "ERROR"]);
    expect(Object.values(TelemetrySourceConvention)).toEqual([
      "GEN_AI", "GEN_AI_LEGACY", "OPENINFERENCE", "OPENLLMETRY", "LANGFUSE", "VERCEL_AI", "NONE",
    ]);
    expect(Object.values(TelemetryPayloadLevel)).toEqual(["NONE", "METADATA", "FULL"]);
    expect(Object.values(TelemetryServiceStatus)).toEqual(["DISCOVERED", "PENDING", "ACKNOWLEDGED", "BLOCKED"]);
    expect(Object.values(TelemetryFindingCode)).toEqual([
      "PROVIDER_NOT_ALLOWED", "MODEL_NOT_ALLOWED", "MODEL_RETIRED", "CONTENT_RECEIVED", "UNKNOWN_SERVICE",
    ]);
    expect(Object.values(TelemetryContentField)).toEqual(["input", "output", "system"]);
  });

  it("pins the bounds both sides size against", () => {
    expect(DCDR_TELEMETRY_UNKNOWN_SERVICE_NAME).toBe("unknown_service");
    expect(DCDR_TELEMETRY_CONTENT_MAX_CHARS).toBe(65_536);
    expect(DCDR_TELEMETRY_BATCH_MAX_SPANS).toBe(100);
    expect(DCDR_TELEMETRY_BATCH_MAX_BYTES).toBe(4 * 1024 * 1024);
    // A span with three full content fields (4 UTF-8 bytes per char at worst) always fits in one batch.
    expect(3 * DCDR_TELEMETRY_CONTENT_MAX_CHARS * 4).toBeLessThan(DCDR_TELEMETRY_BATCH_MAX_BYTES);
  });

  it("is exported from the package barrel", () => {
    expect(barrel.TelemetryOperation.CHAT).toBe("CHAT");
    expect(typeof barrel.telemetrySpanIdempotencyKey).toBe("function");
    expect(typeof barrel.isTelemetryExecutionLogEvent).toBe("function");
    expect(typeof barrel.findDcdrTelemetryService).toBe("function");
  });
});

describe("telemetry events", () => {
  it("survives a JSON round trip as an ingest batch", () => {
    const body: DcdrTelemetryIngestRequest = { spans: [event()] };
    const back = JSON.parse(JSON.stringify(body)) as DcdrTelemetryIngestRequest;
    expect(back).toEqual(body);
    expect(isTelemetryExecutionLogEvent(back.spans[0])).toBe(true);
  });

  it("recognizes only TELEMETRY events with a block and a customer", () => {
    const e = event();
    expect(isTelemetryExecutionLogEvent(e)).toBe(true);
    expect(isTelemetryExecutionLogEvent({ ...e, executionMode: ExecutionLogMode.GATEWAY })).toBe(false);
    expect(isTelemetryExecutionLogEvent({ ...e, telemetry: undefined })).toBe(false);
    expect(isTelemetryExecutionLogEvent({ ...e, cid: "" })).toBe(false);
    expect(isTelemetryExecutionLogEvent(undefined)).toBe(false);
  });
});

describe("telemetrySpanIdempotencyKey", () => {
  it("scopes the key by customer, because trace ids are chosen by the client", () => {
    const a = telemetrySpanIdempotencyKey("c1", "0af7651916cd43dd8448eb211c80319c", "b7ad6b7169203331");
    const b = telemetrySpanIdempotencyKey("c2", "0af7651916cd43dd8448eb211c80319c", "b7ad6b7169203331");
    expect(a).toBe("c1:0af7651916cd43dd8448eb211c80319c:b7ad6b7169203331");
    expect(a).not.toBe(b);
  });

  it("is case-insensitive on the hex ids", () => {
    expect(telemetrySpanIdempotencyKey("c1", "0AF7651916CD43DD8448EB211C80319C", "B7AD6B7169203331")).toBe(
      telemetrySpanIdempotencyKey("c1", "0af7651916cd43dd8448eb211c80319c", "b7ad6b7169203331"),
    );
  });
});

describe("services snapshot rules", () => {
  it("matches service name and environment exactly; no environment matches only a null one", () => {
    const snap = snapshot(false);
    expect(findDcdrTelemetryService(snap, "support-bot", "prod")?.id).toBe("s1");
    expect(findDcdrTelemetryService(snap, "support-bot")?.id).toBe("s2");
    expect(findDcdrTelemetryService(snap, "support-bot", "")?.id).toBe("s2");
    expect(findDcdrTelemetryService(snap, "support-bot", "staging")).toBeUndefined();
    expect(findDcdrTelemetryService(null, "support-bot", "prod")).toBeUndefined();
  });

  it("accepts unknown services in automatic mode and refuses them in strict mode", () => {
    expect(isDcdrTelemetryServiceAccepted(snapshot(false).settings, undefined)).toBe(true);
    expect(isDcdrTelemetryServiceAccepted(snapshot(true).settings, undefined)).toBe(false);
  });

  it("accepts DISCOVERED and ACKNOWLEDGED, refuses PENDING and BLOCKED, in both modes", () => {
    for (const strict of [false, true]) {
      const snap = snapshot(strict);
      expect(isDcdrTelemetryServiceAccepted(snap.settings, findDcdrTelemetryService(snap, "support-bot", "prod"))).toBe(true);
      expect(isDcdrTelemetryServiceAccepted(snap.settings, findDcdrTelemetryService(snap, "support-bot"))).toBe(true);
      expect(isDcdrTelemetryServiceAccepted(snap.settings, findDcdrTelemetryService(snap, "shadow", "prod"))).toBe(false);
      expect(isDcdrTelemetryServiceAccepted(snap.settings, findDcdrTelemetryService(snap, "pending", "prod"))).toBe(false);
    }
  });

  it("refuses everything when the tenant's plan does not include telemetry", () => {
    const snap = snapshot(false, false);
    expect(isDcdrTelemetryServiceAccepted(snap.settings, undefined)).toBe(false);
    expect(isDcdrTelemetryServiceAccepted(snap.settings, findDcdrTelemetryService(snap, "support-bot", "prod"))).toBe(false);
  });
});

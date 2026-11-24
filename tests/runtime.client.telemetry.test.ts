/// <reference types="jest" />

/**
 * `DcdrRuntimeClient` telemetry export (`POST /v1/traces`, `POST /v1/logs`, since 3.25.0): request shape,
 * auth, gzip, raw bodies, the OTLP responses (JSON and protobuf) and the typed errors. `fetch` is injected,
 * as in the other client suites; no network.
 */
import { gunzipSync } from "zlib";

import { DcdrClient } from "../src/dcdr.client";
import {
  DCDR_DEFAULT_TELEMETRY_URL,
  DCDR_TELEMETRY_TEST_SERVICE_NAME,
  DcdrOtlpContentEncoding,
  DcdrOtlpContentType,
  DcdrRuntimeClient,
  DcdrRuntimeError,
  DcdrRuntimeErrorCode,
  buildTelemetryTestTracesRequest,
} from "../src/runtime.client";

/** One recorded call. */
interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Uint8Array;
}

/**
 * A fake `fetch` answering one canned response.
 * @param status HTTP status
 * @param body response bytes or text
 * @param headers response headers
 * @returns fetch and its calls
 */
function fakeFetch(status: number, body: Uint8Array | string = "", headers: Record<string, string> = { "content-type": "application/json" }) {
  const calls: Call[] = [];
  const fetchFn = async (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url: input, method: String(init?.method), headers: { ...((init?.headers as Record<string, string>) ?? {}) }, body: init?.body as Uint8Array });
    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(headers),
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      text: async () => new TextDecoder().decode(bytes),
    } as unknown as Response;
  };
  return { fetchFn, calls };
}

describe("buildTelemetryTestTracesRequest", () => {
  it("builds one GenAI chat span with no content, valid ids and nanosecond times", () => {
    const req = buildTelemetryTestTracesRequest({ serviceName: "shop-bot", environment: "prod", serviceVersion: "1.2.3", nowMs: 1_790_000_000_000 });
    const rs = req.resourceSpans[0];
    expect(rs.resource?.attributes).toEqual([
      { key: "service.name", value: { stringValue: "shop-bot" } },
      { key: "deployment.environment.name", value: { stringValue: "prod" } },
      { key: "service.version", value: { stringValue: "1.2.3" } },
    ]);
    const span = rs.scopeSpans[0].spans[0];
    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(span.startTimeUnixNano).toBe("1790000000000000000");
    expect(span.attributes?.map((a) => a.key)).toEqual(["gen_ai.operation.name", "gen_ai.provider.name", "gen_ai.request.model", "gen_ai.usage.input_tokens", "gen_ai.usage.output_tokens"]);
    expect(JSON.stringify(req)).not.toMatch(/input\.messages|output\.messages|content/);
  });

  it("defaults the service name and draws fresh ids each time", () => {
    const a = buildTelemetryTestTracesRequest();
    const b = buildTelemetryTestTracesRequest();
    expect(a.resourceSpans[0].resource?.attributes?.[0].value.stringValue).toBe(DCDR_TELEMETRY_TEST_SERVICE_NAME);
    expect(a.resourceSpans[0].scopeSpans[0].spans[0].traceId).not.toBe(b.resourceSpans[0].scopeSpans[0].spans[0].traceId);
  });
});

describe("DcdrRuntimeClient.exportTelemetryTraces / exportTelemetryLogs", () => {
  it("posts OTLP/JSON to /v1/traces with the bearer and reads a full success", async () => {
    const { fetchFn, calls } = fakeFetch(200, "{}");
    const client = new DcdrRuntimeClient({ baseUrl: "https://rt.example", bearerToken: "svc-token", fetchFn });
    const result = await client.exportTelemetryTraces(buildTelemetryTestTracesRequest({ nowMs: 1 }));
    expect(result).toEqual({ status: 200 });
    expect(calls[0].url).toBe("https://rt.example/v1/traces");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers).toEqual(expect.objectContaining({ Authorization: "Bearer svc-token", "Content-Type": "application/json" }));
    expect(JSON.parse(new TextDecoder().decode(calls[0].body)).resourceSpans).toHaveLength(1);
  });

  it("reads partialSuccess (int64 as string) from JSON and from protobuf", async () => {
    const json = fakeFetch(200, JSON.stringify({ partialSuccess: { rejectedLogRecords: "2", errorMessage: "dropped" } }));
    const logs = await new DcdrRuntimeClient({ baseUrl: "https://rt.example", bearerToken: "t", fetchFn: json.fetchFn }).exportTelemetryLogs({ resourceLogs: [] });
    expect(logs).toEqual({ status: 200, partialSuccess: { rejectedLogRecords: 2, errorMessage: "dropped" } });
    expect(json.calls[0].url).toBe("https://rt.example/v1/logs");

    // field 1 { field 1 varint 300; field 2 "bad" }
    const inner = [0x08, 0xac, 0x02, 0x12, 0x03, 0x62, 0x61, 0x64];
    const pb = fakeFetch(200, new Uint8Array([0x0a, inner.length, ...inner]), { "content-type": "application/x-protobuf" });
    const traces = await new DcdrRuntimeClient({ baseUrl: "https://rt.example", bearerToken: "t", fetchFn: pb.fetchFn }).exportTelemetryTraces({
      body: new Uint8Array([1, 2, 3]),
      contentType: DcdrOtlpContentType.PROTOBUF,
    });
    expect(traces).toEqual({ status: 200, partialSuccess: { rejectedSpans: 300, errorMessage: "bad" } });
    expect(pb.calls[0].headers["Content-Type"]).toBe("application/x-protobuf");
    expect(Array.from(pb.calls[0].body)).toEqual([1, 2, 3]);
  });

  it("gzips on request, and sends an already compressed raw body as is", async () => {
    const { fetchFn, calls } = fakeFetch(200, "{}");
    const client = new DcdrRuntimeClient({ baseUrl: "https://rt.example", bearerToken: "t", fetchFn });
    const req = buildTelemetryTestTracesRequest({ nowMs: 1 });
    await client.exportTelemetryTraces(req, { gzip: true });
    expect(calls[0].headers["Content-Encoding"]).toBe("gzip");
    expect(JSON.parse(gunzipSync(Buffer.from(calls[0].body)).toString("utf8"))).toEqual(req);
    await client.exportTelemetryTraces({ body: new Uint8Array([9]), contentType: DcdrOtlpContentType.PROTOBUF, contentEncoding: DcdrOtlpContentEncoding.DEFLATE }, { gzip: true });
    expect(calls[1].headers["Content-Encoding"]).toBe("deflate");
    expect(Array.from(calls[1].body)).toEqual([9]);
  });

  it.each([
    [400, DcdrRuntimeErrorCode.VALIDATION],
    [401, DcdrRuntimeErrorCode.UNAUTHORIZED],
    [403, DcdrRuntimeErrorCode.FORBIDDEN],
    [404, DcdrRuntimeErrorCode.NOT_FOUND],
    [413, DcdrRuntimeErrorCode.VALIDATION],
    [415, DcdrRuntimeErrorCode.VALIDATION],
    [429, DcdrRuntimeErrorCode.RATE_LIMITED],
    [503, DcdrRuntimeErrorCode.SERVER_ERROR],
  ])("maps HTTP %s to %s, with Retry-After", async (status, code) => {
    const { fetchFn } = fakeFetch(status, JSON.stringify({ code: 8, message: "nope" }), { "content-type": "application/json", "retry-after": "7" });
    const client = new DcdrRuntimeClient({ baseUrl: "https://rt.example", bearerToken: "t", fetchFn });
    const err = await client.exportTelemetryTraces({ resourceSpans: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(DcdrRuntimeError);
    expect(err.code).toBe(code);
    expect(err.status).toBe(status);
    expect(err.retryAfterSeconds).toBe(7);
    expect(err.details).toEqual({ code: 8, message: "nope" });
  });

  it("decodes a protobuf google.rpc.Status error body into details", async () => {
    // code 16, message "bad token"
    const msg = new TextEncoder().encode("bad token");
    const { fetchFn } = fakeFetch(401, new Uint8Array([0x08, 16, 0x12, msg.length, ...msg]), { "content-type": "application/x-protobuf" });
    const client = new DcdrRuntimeClient({ baseUrl: "https://rt.example", bearerToken: "t", fetchFn });
    const err = await client.exportTelemetryTraces({ body: new Uint8Array(), contentType: DcdrOtlpContentType.PROTOBUF }).catch((e) => e);
    expect(err.code).toBe(DcdrRuntimeErrorCode.UNAUTHORIZED);
    expect(err.details).toEqual({ code: 16, message: "bad token" });
  });

  it("refuses to send without a bearer token (CONFIGURATION, no request made)", async () => {
    const { fetchFn, calls } = fakeFetch(200, "{}");
    const client = new DcdrRuntimeClient({ baseUrl: "https://rt.example", apiToken: "internal", fetchFn });
    for (const call of [() => client.exportTelemetryTraces({ resourceSpans: [] }), () => client.exportTelemetryLogs({ resourceLogs: [] }), () => client.telemetryTest()]) {
      const err = await call().catch((e) => e);
      expect(err).toBeInstanceOf(DcdrRuntimeError);
      expect(err.code).toBe(DcdrRuntimeErrorCode.CONFIGURATION);
    }
    expect(calls).toHaveLength(0);
  });

  it("maps a transport failure to NETWORK", async () => {
    const client = new DcdrRuntimeClient({ baseUrl: "https://rt.example", bearerToken: "t", fetchFn: async () => Promise.reject(new Error("ECONNREFUSED")) });
    const err = await client.exportTelemetryTraces({ resourceSpans: [] }).catch((e) => e);
    expect(err.code).toBe(DcdrRuntimeErrorCode.NETWORK);
  });
});

describe("telemetryTest", () => {
  it("sends the synthetic span and returns the ids it used, through DcdrClient too", async () => {
    const { fetchFn, calls } = fakeFetch(200, "{}");
    const dcdr = new DcdrClient({ bearerToken: "t", runtime: { baseUrl: "https://rt.example" }, fetchFn });
    const result = await dcdr.telemetryTest({ serviceName: "shop-bot", environment: "prod" });
    expect(result.status).toBe(200);
    expect(result.serviceName).toBe("shop-bot");
    const sent = JSON.parse(new TextDecoder().decode(calls[0].body));
    expect(sent.resourceSpans[0].scopeSpans[0].spans[0].traceId).toBe(result.traceId);
    expect(sent.resourceSpans[0].scopeSpans[0].spans[0].spanId).toBe(result.spanId);
    expect(calls[0].url).toBe("https://rt.example/v1/traces");
  });
});

describe("telemetry host (3.25.1)", () => {
  /**
   * A fake `fetch` that answers 200 `{}` to everything and records each URL.
   * @returns fetch and the URLs it saw
   */
  function okFetch() {
    const urls: string[] = [];
    const fetchFn = async (input: string): Promise<Response> => {
      urls.push(input);
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
    return { fetchFn, urls };
  }

  it("defaults telemetry to DCDR Cloud's telemetry host when no URL was given; other calls keep runtime.dcdr.ai", async () => {
    const { fetchFn, urls } = okFetch();
    const client = new DcdrRuntimeClient({ bearerToken: "t", fetchFn });
    await client.exportTelemetryTraces({ resourceSpans: [] });
    await client.exportTelemetryLogs({ resourceLogs: [] });
    await client.telemetryTest();
    await client.healthcheck();
    expect(DCDR_DEFAULT_TELEMETRY_URL).toBe("https://telemetry.dcdr.ai");
    expect(urls).toEqual([
      "https://telemetry.dcdr.ai/v1/traces",
      "https://telemetry.dcdr.ai/v1/logs",
      "https://telemetry.dcdr.ai/v1/traces",
      "https://runtime.dcdr.ai/api/system/healthcheck",
    ]);
  });

  it("sends telemetry to the given baseUrl (an install keeps its runtime host)", async () => {
    const { fetchFn, urls } = okFetch();
    const client = new DcdrRuntimeClient({ baseUrl: " https://dcdr.acme.example/ ", bearerToken: "t", fetchFn });
    await client.exportTelemetryTraces({ resourceSpans: [] });
    await client.healthcheck();
    expect(urls).toEqual(["https://dcdr.acme.example/v1/traces", "https://dcdr.acme.example/api/system/healthcheck"]);
  });

  it("an explicit telemetryUrl wins (trimmed, trailing slash removed) and leaves the other calls on baseUrl", async () => {
    const { fetchFn, urls } = okFetch();
    const client = new DcdrRuntimeClient({ baseUrl: "https://rt.example", telemetryUrl: "  https://otel.example/ ", bearerToken: "t", fetchFn });
    await client.exportTelemetryLogs({ resourceLogs: [] });
    await client.healthcheck();
    expect(urls).toEqual(["https://otel.example/v1/logs", "https://rt.example/api/system/healthcheck"]);
  });

  it.each(["", "   "])("refuses a blank telemetryUrl (%j) at construction with CONFIGURATION", (telemetryUrl) => {
    const { fetchFn } = okFetch();
    let err: unknown;
    try {
      new DcdrRuntimeClient({ telemetryUrl, bearerToken: "t", fetchFn });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DcdrRuntimeError);
    expect((err as DcdrRuntimeError).code).toBe(DcdrRuntimeErrorCode.CONFIGURATION);
  });

  it("DcdrClient: no URLs -> telemetry host; runtimeUrl -> that; telemetryUrl -> that; runtime.telemetryUrl override wins", async () => {
    const cases: Array<{ config: ConstructorParameters<typeof DcdrClient>[0]; telemetry: string; runtime: string }> = [
      { config: {}, telemetry: "https://telemetry.dcdr.ai/v1/traces", runtime: "https://runtime.dcdr.ai/api/system/healthcheck" },
      { config: { runtimeUrl: "https://dcdr.acme.example" }, telemetry: "https://dcdr.acme.example/v1/traces", runtime: "https://dcdr.acme.example/api/system/healthcheck" },
      { config: { runtime: { baseUrl: "https://rt.example" } }, telemetry: "https://rt.example/v1/traces", runtime: "https://rt.example/api/system/healthcheck" },
      { config: { runtimeUrl: "https://dcdr.acme.example", telemetryUrl: "https://otel.example/" }, telemetry: "https://otel.example/v1/traces", runtime: "https://dcdr.acme.example/api/system/healthcheck" },
      {
        config: { telemetryUrl: "https://otel.example", runtime: { telemetryUrl: "https://otel-override.example" } },
        telemetry: "https://otel-override.example/v1/traces",
        runtime: "https://runtime.dcdr.ai/api/system/healthcheck",
      },
      // An override object carrying an explicit undefined key must not fall back to the runtime host.
      { config: { runtime: { telemetryUrl: undefined } }, telemetry: "https://telemetry.dcdr.ai/v1/traces", runtime: "https://runtime.dcdr.ai/api/system/healthcheck" },
    ];
    for (const c of cases) {
      const { fetchFn, urls } = okFetch();
      const dcdr = new DcdrClient({ bearerToken: "t", fetchFn, ...c.config });
      await dcdr.exportTelemetryTraces({ resourceSpans: [] });
      await dcdr.healthcheck();
      expect(urls).toEqual([c.telemetry, c.runtime]);
    }
  });
});

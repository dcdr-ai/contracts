/// <reference types="jest" />

import { DcdrRuntimeClient } from "../src/runtime.client";
import { ExecutionStreamEventType } from "../src/execution.contract";

function makeMockResponse(args: {
  ok: boolean;
  status: number;
  json: object;
  contentType?: string;
}): Response {
  const body = JSON.stringify(args.json);
  const headers = new Headers({
    "content-type": args.contentType ?? "application/json",
  });

  return {
    ok: args.ok,
    status: args.status,
    headers,
    text: async () => body,
  } as unknown as Response;
}

function makeMockTextResponse(args: {
  ok: boolean;
  status: number;
  text: string;
  contentType?: string;
}): Response {
  const headers = new Headers({
    "content-type": args.contentType ?? "text/plain; version=0.0.4",
  });

  return {
    ok: args.ok,
    status: args.status,
    headers,
    text: async () => args.text,
  } as unknown as Response;
}

function stringToReadableStream(
  text: string,
  chunkSize = 1024,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(encoder.encode(text.slice(i, i + chunkSize)));
  }

  let idx = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (idx >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[idx]);
      idx += 1;
    },
  });
}

function makeMockStreamResponse(args: {
  ok: boolean;
  status: number;
  sseText: string;
  contentType?: string;
  body?: ReadableStream<Uint8Array> | null;
}): Response {
  const headers = new Headers({
    "content-type": args.contentType ?? "text/event-stream",
  });

  const body = Object.prototype.hasOwnProperty.call(args, "body")
    ? args.body
    : stringToReadableStream(args.sseText, 13);

  return {
    ok: args.ok,
    status: args.status,
    headers,
    body: body ?? undefined,
    text: async () => args.sseText,
  } as unknown as Response;
}

describe("DcdrRuntimeClient", () => {
  it("throws when baseUrl is empty/whitespace", () => {
    const fetchFn = jest.fn(async () =>
      makeMockResponse({ ok: true, status: 200, json: { status: "OK" } }),
    );
    expect(
      () => new DcdrRuntimeClient({ baseUrl: "   ", apiToken: "API", fetchFn }),
    ).toThrow("DcdrRuntimeClient requires baseUrl");
  });

  it("throws when both bearerToken and apiToken are set", () => {
    const fetchFn = jest.fn(async () =>
      makeMockResponse({ ok: true, status: 200, json: { status: "OK" } }),
    );
    expect(
      () =>
        new DcdrRuntimeClient({
          baseUrl: "https://example.invalid",
          bearerToken: "B",
          apiToken: "A",
          fetchFn,
        }),
    ).toThrow("should not set both bearerToken and apiToken");
  });

  it("throws when no fetchFn is provided and global fetch is missing", () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, "fetch");
    try {
      Object.defineProperty(globalThis, "fetch", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      expect(
        () =>
          new DcdrRuntimeClient({
            baseUrl: "https://example.invalid",
            apiToken: "API",
          }),
      ).toThrow("requires a fetch implementation");
    } finally {
      if (desc) Object.defineProperty(globalThis, "fetch", desc);
      else (globalThis as unknown as { fetch?: undefined }).fetch = undefined;
    }
  });

  it("defaults baseUrl to https://runtime.dcdr.ai when omitted", async () => {
    const fetchFn = jest.fn(async (url: string) => {
      expect(url).toBe("https://runtime.dcdr.ai/api/system/healthcheck");
      return makeMockResponse({
        ok: true,
        status: 200,
        json: { status: "OK" },
      });
    });

    const client = new DcdrRuntimeClient({
      bearerToken: "TOKEN",
      fetchFn,
    });

    const res = await client.healthcheck();
    expect(res.status).toBe("OK");
  });

  it("trims a trailing slash from baseUrl", async () => {
    const fetchFn = jest.fn(async (url: string) => {
      expect(url).toBe("https://example.invalid/api/system/healthcheck");
      return makeMockResponse({
        ok: true,
        status: 200,
        json: { status: "OK" },
      });
    });

    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid/",
      bearerToken: "TOKEN",
      fetchFn,
    });

    const res = await client.healthcheck();
    expect(res.status).toBe("OK");
  });

  it("sends Authorization Bearer when bearerToken is configured", async () => {
    const fetchFn = jest.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer TOKEN");
      return makeMockResponse({
        ok: true,
        status: 200,
        json: { status: "OK" },
      });
    });

    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      bearerToken: "TOKEN",
      fetchFn,
    });

    const res = await client.healthcheck();
    expect(res.status).toBe("OK");
  });

  it("sends token + x-session-bypass when apiToken and sessionBypassToken are configured", async () => {
    const fetchFn = jest.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers["token"]).toBe("API");
      expect(headers["x-session-bypass"]).toBe("BYPASS");
      return makeMockResponse({
        ok: true,
        status: 200,
        json: { status: "OK" },
      });
    });

    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      sessionBypassToken: "BYPASS",
      fetchFn,
    });

    const res = await client.healthcheck();
    expect(res.status).toBe("OK");
  });

  it("calls /api/execution/run/:intent for executeIntent", async () => {
    const fetchFn = jest.fn(async (url: string) => {
      expect(url).toBe("https://example.invalid/api/execution/run/MY_INTENT");
      return makeMockResponse({
        ok: true,
        status: 200,
        json: {
          status: "OK",
          input: [],
          output: {},
          report: {
            attempts: [],
            timing: { startedAt: "", endedAt: "", latencyMs: 0 },
            sessionId: "",
            appId: "",
            gatewayRequestId: "",
            intent: "MY_INTENT",
            prompt: { id: "", version: "", sha256: "" },
            finalImplementation: {
              provider: "RULES",
              model: "",
              implementationId: "",
              latencyMs: 0,
            },
          },
        },
      });
    });

    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });

    const res = await client.executeIntent("MY_INTENT", { vars: { a: 1 } });
    expect(res.status).toBe("OK");
  });

  it("calls /api/system/metrics for metrics()", async () => {
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://example.invalid/api/system/metrics");
      expect(init?.method).toBe("GET");
      return makeMockTextResponse({
        ok: true,
        status: 200,
        text: "# HELP x y\n",
      });
    });

    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });

    const text = await client.metrics();
    expect(text).toContain("# HELP");
  });

  it("calls /api/system/metrics?token=... when token is provided", async () => {
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(
        "https://example.invalid/api/system/metrics?token=SECRET",
      );
      expect(init?.method).toBe("GET");
      return makeMockTextResponse({
        ok: true,
        status: 200,
        text: "# HELP x y\n",
      });
    });

    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });

    const text = await client.metrics("SECRET");
    expect(text).toContain("# HELP");
  });

  it("calls GET /api/auth/check for authCheck()", async () => {
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://example.invalid/api/auth/check");
      expect(init?.method).toBe("GET");
      return makeMockResponse({
        ok: true,
        status: 200,
        json: { valid: true, nowMs: 123 },
      });
    });

    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });

    const res = await client.authCheck();
    expect(res.valid).toBe(true);
    expect(res.nowMs).toBe(123);
  });

  it("calls /api/execution/dry-run/:intent for dryRun()", async () => {
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(
        "https://example.invalid/api/execution/dry-run/MY_INTENT",
      );
      expect(init?.method).toBe("POST");
      return makeMockResponse({
        ok: true,
        status: 200,
        json: { status: "OK" },
      });
    });

    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });

    const res = await client.dryRun("MY_INTENT", { name: "Jose" });
    expect(res.status).toBe("OK");
  });

  it("calls /api/execution/eval/:intent for eval()", async () => {
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://example.invalid/api/execution/eval/MY_INTENT");
      expect(init?.method).toBe("POST");
      return makeMockResponse({
        ok: true,
        status: 200,
        json: { intent: "MY_INTENT", total: 0, results: [] },
      });
    });

    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });

    const res = await client.eval("MY_INTENT", { name: "Jose" });
    expect(res.intent).toBe("MY_INTENT");
  });

  it("calls /api/execution/circuit-breakers for circuitBreakerStatus()", async () => {
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(
        "https://example.invalid/api/execution/circuit-breakers?tenantCid=CUST_X&provider=OPEN_AI&model=gpt-4",
      );
      expect(init?.method).toBe("GET");
      return makeMockResponse({
        ok: true,
        status: 200,
        json: {
          tenantCid: "CUST_X",
          provider: "OPEN_AI",
          model: "gpt-4",
          failures: 0,
          blocked: false,
        },
      });
    });

    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });

    const res = await client.circuitBreakerStatus("OPEN_AI", "gpt-4", "CUST_X");
    expect(res.tenantCid).toBe("CUST_X");
    expect(res.provider).toBe("OPEN_AI");
    expect(res.blocked).toBe(false);
  });

  it("calls PUT /api/execution/circuit-breakers/reset for resetCircuitBreaker()", async () => {
    const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(
        "https://example.invalid/api/execution/circuit-breakers/reset",
      );
      expect(init?.method).toBe("PUT");

      const bodyRaw = String(init?.body ?? "");
      expect(bodyRaw).toContain('"tenantCid":"CUST_X"');
      expect(bodyRaw).toContain('"provider":"OPEN_AI"');
      expect(bodyRaw).toContain('"model":"gpt-4"');
      return makeMockResponse({ ok: true, status: 200, json: { ok: true } });
    });

    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });

    const res = await client.resetCircuitBreaker("OPEN_AI", "gpt-4", "CUST_X");
    expect(res.ok).toBe(true);
  });

  it("treats an empty JSON body as {} (version() tolerates missing fields)", async () => {
    const fetchFn = jest.fn(async () => {
      const headers = new Headers({ "content-type": "application/json" });
      return {
        ok: true,
        status: 200,
        headers,
        text: async () => "",
      } as unknown as Response;
    });

    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });
    const res = await client.version();
    expect(res.buildNumber).toBeUndefined();
  });

  it("throws when a JSON endpoint returns non-JSON content-type", async () => {
    const fetchFn = jest.fn(async () =>
      makeMockTextResponse({
        ok: true,
        status: 200,
        text: "OK",
        contentType: "text/plain",
      }),
    );
    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });
    await expect(client.healthcheck()).rejects.toThrow("expected JSON");
  });

  it("includes a bounded body preview when a JSON request fails", async () => {
    const big = "x".repeat(4100);
    const fetchFn = jest.fn(async () =>
      makeMockResponse({ ok: false, status: 500, json: { error: big } }),
    );
    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });
    await expect(client.version()).rejects.toThrow("status=500");
    await expect(client.version()).rejects.toThrow("…");
  });

  it("includes a bounded body preview when a text request fails (metrics)", async () => {
    const big = "y".repeat(4100);
    const fetchFn = jest.fn(async () =>
      makeMockTextResponse({ ok: false, status: 503, text: big }),
    );
    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });
    await expect(client.metrics()).rejects.toThrow("GET /api/system/metrics");
    await expect(client.metrics()).rejects.toThrow("…");
  });

  it("throws when executeIntentStream gets a non-OK response (includes preview)", async () => {
    const fetchFn = jest.fn(async () =>
      makeMockStreamResponse({
        ok: false,
        status: 401,
        sseText: "unauthorized",
      }),
    );
    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });

    const iter = client.executeIntentStream("MY_INTENT", { vars: { a: 1 } });
    await expect(iter.next()).rejects.toThrow("status=401");
  });

  it("throws when executeIntentStream gets the wrong content-type", async () => {
    const fetchFn = jest.fn(async () =>
      makeMockStreamResponse({
        ok: true,
        status: 200,
        sseText: "hello",
        contentType: "text/plain",
      }),
    );
    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });

    const iter = client.executeIntentStream("MY_INTENT", { vars: { a: 1 } });
    await expect(iter.next()).rejects.toThrow("expected text/event-stream");
  });

  it("throws when executeIntentStream response body is missing", async () => {
    const fetchFn = jest.fn(async () =>
      makeMockStreamResponse({
        ok: true,
        status: 200,
        sseText: "",
        body: null,
      }),
    );
    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });

    const iter = client.executeIntentStream("MY_INTENT", { vars: { a: 1 } });
    await expect(iter.next()).rejects.toThrow(
      "streaming response body is missing",
    );
  });

  it("yields meta then final for executeIntentStream and then completes", async () => {
    const sse = [
      ": keep-alive\n\n",
      `event: ${ExecutionStreamEventType.META}\n`,
      `data: {"gatewayRequestId":"g1","intent":"MY_INTENT","startedAt":"2026-05-05T00:00:00Z"}\n\n`,
      `event: ignored\n`,
      `data: {}\n\n`,
      `event: ${ExecutionStreamEventType.FINAL}\n`,
      `data: {"response":{"status":"OK","input":[],"output":{},"report":{"attempts":[],"timing":{"startedAt":"","endedAt":"","latencyMs":0},"sessionId":"","appId":"","gatewayRequestId":"","intent":"MY_INTENT","prompt":{"id":"","version":"","sha256":""},"finalImplementation":{"provider":"RULES","model":"","implementationId":"","latencyMs":0}}}}\n\n`,
    ].join("");

    const fetchFn = jest.fn(async () =>
      makeMockStreamResponse({ ok: true, status: 200, sseText: sse }),
    );
    const client = new DcdrRuntimeClient({
      baseUrl: "https://example.invalid",
      apiToken: "API",
      fetchFn,
    });

    const events: Array<{ type: string }> = [];
    for await (const evt of client.executeIntentStream("MY_INTENT", {
      vars: { a: 1 },
    })) {
      events.push({ type: evt.type });
      if (evt.type === ExecutionStreamEventType.FINAL) {
        expect(evt.data.response.status).toBe("OK");
      }
    }

    expect(events.map((e) => e.type)).toEqual([
      ExecutionStreamEventType.META,
      ExecutionStreamEventType.FINAL,
    ]);
  });
});

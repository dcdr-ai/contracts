/// <reference types="jest" />

import { ExecutionErrorCode } from "../src/errors.contract";
import {
  DcdrRuntimeClient,
  DcdrRuntimeError,
  DcdrRuntimeErrorCode,
  isDcdrRuntimeError,
} from "../src/runtime.client";

/**
 * What a caller is told when a runtime call fails.
 *
 * The workflow half of the client has thrown a typed `DcdrWorkflowError` since 3.10.0 while this half
 * threw a plain `Error` with everything buried in the message, so every consumer that wanted to tell
 * "your quota is spent" from "the model is not allowed" parsed that string. Two things matter here and
 * they pull against each other: the fields have to carry the answer, and **the message has to stay
 * exactly what it was**, because the string is what those consumers are matching on today.
 */
function jsonResponse(args: { status: number; json: object; headers?: Record<string, string> }): Response {
  const body = JSON.stringify(args.json);
  return {
    ok: args.status >= 200 && args.status < 300,
    status: args.status,
    headers: new Headers({ "content-type": "application/json", ...(args.headers ?? {}) }),
    text: async () => body,
  } as unknown as Response;
}

const client = (fetchFn: jest.Mock): DcdrRuntimeClient => new DcdrRuntimeClient({ baseUrl: "https://example.invalid", apiToken: "API", fetchFn });

describe("DcdrRuntimeError", () => {
  it("keeps the message this client has always produced, so message matchers survive the upgrade", async () => {
    const fetchFn = jest.fn(async () => jsonResponse({ status: 500, json: { error: "boom" } }));
    await expect(client(fetchFn).version()).rejects.toThrow('DcdrRuntimeClient request failed: GET /api/system/version status=500 body={"error":"boom"}');
  });

  it("is an Error, so nothing that caught one before stops catching it", async () => {
    const fetchFn = jest.fn(async () => jsonResponse({ status: 500, json: {} }));
    const error = await client(fetchFn)
      .version()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DcdrRuntimeError);
    expect(isDcdrRuntimeError(error)).toBe(true);
  });

  it("carries the runtime's own code, which is the one worth showing a person", async () => {
    // The shape the service-token guard sends when a limit rule has no room left.
    const fetchFn = jest.fn(async () =>
      jsonResponse({
        status: 429,
        json: { error: "service token quota exceeded", code: ExecutionErrorCode.SERVICE_TOKEN_LIMIT_EXCEEDED },
        headers: { "retry-after": "42" },
      }),
    );
    const error = (await client(fetchFn)
      .executeIntent("X", { vars: {} })
      .catch((e: unknown) => e)) as DcdrRuntimeError;

    expect(error.code).toBe(DcdrRuntimeErrorCode.RATE_LIMITED);
    expect(error.executionCode).toBe(ExecutionErrorCode.SERVICE_TOKEN_LIMIT_EXCEEDED);
    expect(error.status).toBe(429);
    expect(error.method).toBe("POST");
    expect(error.path).toBe("/api/execution/run/X");
    expect(error.retryAfterSeconds).toBe(42);
    expect(error.details).toEqual({ error: "service token quota exceeded", code: ExecutionErrorCode.SERVICE_TOKEN_LIMIT_EXCEEDED });
  });

  it("finds the code in the execution envelope too, not only in a flat body", async () => {
    const fetchFn = jest.fn(async () => jsonResponse({ status: 422, json: { status: "ERROR", error: { code: ExecutionErrorCode.SCHEMA_FAIL, message: "output did not validate" } } }));
    const error = (await client(fetchFn)
      .executeIntent("X", { vars: {} })
      .catch((e: unknown) => e)) as DcdrRuntimeError;

    expect(error.executionCode).toBe(ExecutionErrorCode.SCHEMA_FAIL);
    expect(error.code).toBe(DcdrRuntimeErrorCode.VALIDATION);
  });

  it("lets the runtime's code win over the status where the status is the vaguer of the two", async () => {
    // 402 by status, but the body says why: the tenant's plan does not cover the virtual provider.
    const paid = jest.fn(async () => jsonResponse({ status: 500, json: { code: ExecutionErrorCode.PAYMENT_REQUIRED, message: "disabled for this tenant" } }));
    const error = (await client(paid)
      .executeIntent("X", { vars: {} })
      .catch((e: unknown) => e)) as DcdrRuntimeError;
    expect(error.code).toBe(DcdrRuntimeErrorCode.PAYMENT_REQUIRED);
  });

  it("falls back to the status when the body is not the runtime's (a proxy, a gateway, HTML)", async () => {
    const cases: Array<[number, DcdrRuntimeErrorCode]> = [
      [401, DcdrRuntimeErrorCode.UNAUTHORIZED],
      [403, DcdrRuntimeErrorCode.FORBIDDEN],
      [404, DcdrRuntimeErrorCode.NOT_FOUND],
      [400, DcdrRuntimeErrorCode.VALIDATION],
      [429, DcdrRuntimeErrorCode.RATE_LIMITED],
      [504, DcdrRuntimeErrorCode.TIMEOUT],
      [502, DcdrRuntimeErrorCode.SERVER_ERROR],
    ];
    for (const [status, expected] of cases) {
      const fetchFn = jest.fn(async () => jsonResponse({ status, json: { error: "Forbidden" } }));
      const error = (await client(fetchFn)
        .version()
        .catch((e: unknown) => e)) as DcdrRuntimeError;
      expect([status, error.code]).toEqual([status, expected]);
      expect(error.executionCode).toBeNull();
    }
  });

  it("tells our own timeout from a dead socket, and keeps the original as `cause`", async () => {
    const dead = jest.fn(async () => {
      throw new Error("socket hang up");
    });
    const network = (await client(dead)
      .version()
      .catch((e: unknown) => e)) as DcdrRuntimeError;
    expect(network.code).toBe(DcdrRuntimeErrorCode.NETWORK);
    expect(network.message).toContain("socket hang up");
    expect((network.cause as Error).message).toBe("socket hang up");

    const slow = jest.fn(
      async (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("The operation was aborted")));
        }),
    );
    const timedOut = (await new DcdrRuntimeClient({ baseUrl: "https://example.invalid", apiToken: "API", timeoutMs: 5, fetchFn: slow })
      .version()
      .catch((e: unknown) => e)) as DcdrRuntimeError;
    expect(timedOut.code).toBe(DcdrRuntimeErrorCode.TIMEOUT);
    expect(timedOut.message).toContain("timed out after 5ms");
    expect(timedOut.status).toBeNull();
  });

  it("marks a response it cannot read as UNEXPECTED_RESPONSE rather than as a failure of the call", async () => {
    const fetchFn = jest.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/html" }),
          text: async () => "<html>nope</html>",
        }) as unknown as Response,
    );
    const error = (await client(fetchFn)
      .version()
      .catch((e: unknown) => e)) as DcdrRuntimeError;
    expect(error.code).toBe(DcdrRuntimeErrorCode.UNEXPECTED_RESPONSE);
    expect(error.status).toBe(200);
    expect(error.message).toContain("expected JSON");
  });

  it("reports a misconfigured client as CONFIGURATION, before any request goes out", () => {
    const error = (() => {
      try {
        // eslint-disable-next-line no-new
        new DcdrRuntimeClient({ baseUrl: "", apiToken: "API" });
        return null;
      } catch (e: unknown) {
        return e as DcdrRuntimeError;
      }
    })();
    expect(error?.code).toBe(DcdrRuntimeErrorCode.CONFIGURATION);
    expect(error?.status).toBeNull();
    expect(error?.path).toBeNull();
  });

  it("recognises an error from a second copy of the package, which `instanceof` cannot", () => {
    // What a duplicated @dcdr/contracts in a dependency tree produces: same shape, different class.
    const foreign = Object.assign(new Error("from another copy"), { name: "DcdrRuntimeError", code: DcdrRuntimeErrorCode.RATE_LIMITED });
    expect(foreign instanceof DcdrRuntimeError).toBe(false);
    expect(isDcdrRuntimeError(foreign)).toBe(true);

    expect(isDcdrRuntimeError(new Error("plain"))).toBe(false);
    expect(isDcdrRuntimeError({ name: "DcdrRuntimeError", code: "NOT_A_CODE" })).toBe(false);
    expect(isDcdrRuntimeError(null)).toBe(false);
  });
});

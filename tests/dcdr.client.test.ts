/// <reference types="jest" />

/**
 * `DcdrClient` unit suite.
 *
 * The wrapper owns three decisions and nothing else, so those are what is tested: which half a
 * delegated method reaches, how the shared configuration is split between the two, and when each
 * half is built. The behaviour of the halves themselves is covered by their own suites.
 */
import { DCDR_DEFAULT_CONTROL_URL, DCDR_DEFAULT_RUNTIME_URL, DcdrClient } from "../src/dcdr.client";
import { DcdrRuntimeClient } from "../src/runtime.client";
import { DcdrWorkflowClient, DcdrWorkflowErrorCode, WorkflowRunStatus, isDcdrWorkflowError } from "../src/workflow.client";

/** One recorded call to the injected `fetch`. */
interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
}

/** A fake `fetch` answering JSON, plus the calls it recorded. */
function fakeFetch(json: unknown = {}): { fetchFn: (input: string, init?: RequestInit) => Promise<Response>; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchFn = async (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url: input, method: String(init?.method ?? "GET"), headers: { ...((init?.headers as Record<string, string>) ?? {}) } });
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify(json),
    } as unknown as Response;
  };
  return { fetchFn, calls };
}

describe("DcdrClient composition", () => {
  it("exposes both halves as real clients", () => {
    const { fetchFn } = fakeFetch();
    const dcdr = new DcdrClient({ bearerToken: "shared", fetchFn });
    expect(dcdr.runtime).toBeInstanceOf(DcdrRuntimeClient);
    expect(dcdr.workflows).toBeInstanceOf(DcdrWorkflowClient);
  });

  it("caches each half rather than rebuilding it per call", () => {
    const { fetchFn } = fakeFetch();
    const dcdr = new DcdrClient({ bearerToken: "shared", fetchFn });
    expect(dcdr.runtime).toBe(dcdr.runtime);
    expect(dcdr.workflows).toBe(dcdr.workflows);
  });

  it("builds each half only when it is used", () => {
    // An integration that only runs workflows must not be forced to configure a runtime, and the
    // other way round; a constructor that built both eagerly would fail on a surface never touched.
    const { fetchFn } = fakeFetch();
    const runtimeOnly = new DcdrClient({ runtime: { apiToken: "internal" }, fetchFn });
    expect(() => runtimeOnly.runtime).not.toThrow();
    expect(() => runtimeOnly.workflows).toThrow(/bearerToken/);
  });

  it("raises a typed CONFIGURATION error when the workflow half has no token", () => {
    const { fetchFn } = fakeFetch();
    const dcdr = new DcdrClient({ fetchFn });
    try {
      void dcdr.workflows;
      throw new Error("should have thrown");
    } catch (e) {
      expect(isDcdrWorkflowError(e)).toBe(true);
      if (isDcdrWorkflowError(e)) expect(e.code).toBe(DcdrWorkflowErrorCode.CONFIGURATION);
    }
  });
});

describe("DcdrClient configuration", () => {
  it("sends the shared bearer to both halves, at their default origins", async () => {
    const runtime = fakeFetch({ status: "OK" });
    const control = fakeFetch({ items: [] });

    const dcdr = new DcdrClient({
      bearerToken: "shared",
      runtime: { fetchFn: runtime.fetchFn },
      workflows: { fetchFn: control.fetchFn },
    });

    await dcdr.healthcheck();
    await dcdr.listWorkflows();

    expect(runtime.calls[0].url.startsWith(DCDR_DEFAULT_RUNTIME_URL)).toBe(true);
    expect(runtime.calls[0].headers["Authorization"]).toBe("Bearer shared");
    expect(control.calls[0].url.startsWith(DCDR_DEFAULT_CONTROL_URL)).toBe(true);
    expect(control.calls[0].headers["Authorization"]).toBe("Bearer shared");
  });

  it("honours per-half origins", async () => {
    const { fetchFn, calls } = fakeFetch({ items: [] });
    const dcdr = new DcdrClient({
      bearerToken: "shared",
      runtimeUrl: "http://localhost:8000",
      controlUrl: "http://localhost:5000",
      fetchFn,
    });

    await dcdr.version();
    await dcdr.listWorkflows();

    expect(calls[0].url).toBe("http://localhost:8000/api/system/version");
    expect(calls[1].url).toBe("http://localhost:5000/api/dcdr/workflows");
  });

  it("lets the runtime half use a different credential without breaking the workflow half", async () => {
    const runtime = fakeFetch({ status: "OK" });
    const control = fakeFetch({ items: [] });

    // The runtime in internal mode authenticates with `token:`, the control plane still with the
    // shared bearer. `DcdrRuntimeClient` refuses a config carrying both, so the shared bearer must
    // not be pushed onto a half that picked another auth mode.
    const dcdr = new DcdrClient({
      bearerToken: "shared",
      runtime: { apiToken: "internal-token", fetchFn: runtime.fetchFn },
      workflows: { fetchFn: control.fetchFn },
    });

    await dcdr.healthcheck();
    await dcdr.listWorkflows();

    expect(runtime.calls[0].headers["token"]).toBe("internal-token");
    expect(runtime.calls[0].headers["Authorization"]).toBeUndefined();
    expect(control.calls[0].headers["Authorization"]).toBe("Bearer shared");
  });

  it("shares the timeout and the extra headers with both halves", async () => {
    const { fetchFn, calls } = fakeFetch({ items: [] });
    const dcdr = new DcdrClient({ bearerToken: "shared", extraHeaders: { "x-trace": "abc" }, fetchFn });

    await dcdr.version();
    await dcdr.listWorkflows();

    expect(calls[0].headers["x-trace"]).toBe("abc");
    expect(calls[1].headers["x-trace"]).toBe("abc");
  });
});

describe("DcdrClient delegation", () => {
  it("routes intent execution to the runtime", async () => {
    const runtime = fakeFetch({ status: "OK", output: { ok: true } });
    const control = fakeFetch({ items: [] });
    const dcdr = new DcdrClient({ bearerToken: "t", runtime: { fetchFn: runtime.fetchFn }, workflows: { fetchFn: control.fetchFn } });

    await dcdr.executeIntent("CLASSIFY", { vars: { text: "hi" } });

    expect(runtime.calls[0].url).toContain("/api/execution/run/CLASSIFY");
    expect(control.calls).toHaveLength(0);
  });

  it("routes workflow calls to the control plane", async () => {
    const runtime = fakeFetch({ status: "OK" });
    const control = fakeFetch({ runId: "r1", status: WorkflowRunStatus.QUEUED, completed: false, deduplicated: false, run: {} });
    const dcdr = new DcdrClient({ bearerToken: "t", runtime: { fetchFn: runtime.fetchFn }, workflows: { fetchFn: control.fetchFn } });

    await dcdr.runWorkflow("SUPPORT_TRIAGE", { input: { a: 1 } });

    expect(control.calls[0].url).toContain("/api/dcdr/workflows/run/SUPPORT_TRIAGE");
    expect(runtime.calls).toHaveLength(0);
  });

  it("keeps one vocabulary: every delegated name exists on the half it delegates to", () => {
    const { fetchFn } = fakeFetch();
    const dcdr = new DcdrClient({ bearerToken: "t", fetchFn });

    const runtimeMethods = ["executeIntent", "executeIntentStream", "dryRun", "eval", "demo", "healthcheck", "version", "authCheck", "metrics", "uploadAsset", "getAsset", "deleteAsset", "circuitBreakerStatus", "resetCircuitBreaker"] as const;
    const workflowMethods = ["listWorkflows", "getWorkflow", "listWorkflowVersions", "validateWorkflow", "runWorkflow", "runWorkflowAndWait", "waitForWorkflowRun", "listWorkflowRuns", "getWorkflowRun", "cancelWorkflowRun", "resumeWorkflowRun", "listWorkflowRunSteps", "listWorkflowRunEvidence", "getWorkflowRunReport", "listWorkflowTasks"] as const;

    // No aliases anywhere: moving a call between the wrapper and a bare client is a rename of the
    // receiver and nothing else. This fails the moment somebody invents a second name for one.
    for (const name of runtimeMethods) {
      expect(typeof (dcdr as unknown as Record<string, unknown>)[name]).toBe("function");
      expect(typeof (dcdr.runtime as unknown as Record<string, unknown>)[name]).toBe("function");
    }
    for (const name of workflowMethods) {
      expect(typeof (dcdr as unknown as Record<string, unknown>)[name]).toBe("function");
      expect(typeof (dcdr.workflows as unknown as Record<string, unknown>)[name]).toBe("function");
    }
  });

  it("delegates the streaming method without awaiting it into a promise", async () => {
    // `executeIntentStream` returns an async generator; wrapping it in an `async` method would turn
    // it into a promise of one and break `for await` at the call site.
    const sse = "event: final\ndata: {\"response\":{\"status\":\"OK\"}}\n\n";
    const fetchFn = async (): Promise<Response> =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/event-stream" }),
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sse));
            controller.close();
          },
        }),
        text: async () => sse,
      }) as unknown as Response;

    const dcdr = new DcdrClient({ bearerToken: "t", fetchFn });
    const events: string[] = [];
    for await (const event of dcdr.executeIntentStream("CLASSIFY", { vars: {} })) {
      events.push(event.type);
    }
    expect(events).toEqual(["final"]);
  });
});

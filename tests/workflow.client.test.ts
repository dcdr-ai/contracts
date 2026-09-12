/// <reference types="jest" />

/**
 * `DcdrWorkflowClient` unit suite: deterministic, no network, no timers.
 *
 * Every case runs against an injected `fetch`, and the wait loop against an injected clock and
 * sleep, so the backoff is asserted as *values* rather than observed as elapsed wall time. A polling
 * test that really sleeps is either slow or flaky, and usually both.
 *
 * What is deliberately pinned here is the **wire**: paths, headers, status-code semantics and the
 * error vocabulary. Those are what a published client cannot change without breaking somebody.
 */
import {
  DCDR_WORKFLOW_API_BASE_PATH,
  DCDR_WORKFLOW_IDEMPOTENCY_KEY_HEADER,
  DCDR_WORKFLOW_MAX_WAIT_FOR_RESULT_MS,
  DcdrWorkflowClient,
  DcdrWorkflowErrorCode,
  WORKFLOW_RUN_TERMINAL_STATUSES,
  WorkflowRunStatus,
  WorkflowRunStepStatus,
  WorkflowTriggerType,
  WorkflowWaitOutcome,
  buildDcdrWorkflowRoutes,
  isDcdrWorkflowError,
  isWorkflowRunSuccessful,
  isWorkflowRunTerminal,
} from "../src/workflow.client";

/** One recorded call to the injected `fetch`. */
interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** A canned response the fake `fetch` answers with. */
interface CannedResponse {
  status?: number;
  json?: unknown;
  text?: string;
  contentType?: string;
}

/**
 * Builds a `Response`-shaped object the client can read.
 */
function makeResponse(canned: CannedResponse): Response {
  const status = canned.status ?? 200;
  const isJson = canned.json !== undefined;
  const body = isJson ? JSON.stringify(canned.json) : (canned.text ?? "");
  const headers = new Headers({ "content-type": canned.contentType ?? (isJson ? "application/json" : "text/plain; charset=utf-8") });

  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    text: async () => body,
  } as unknown as Response;
}

/** A client wired to canned responses, plus the calls it recorded. */
function makeClient(responses: CannedResponse[], overrides?: Record<string, unknown>): { client: DcdrWorkflowClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  let index = 0;

  const fetchFn = async (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: input,
      method: String(init?.method ?? "GET"),
      headers: { ...((init?.headers as Record<string, string>) ?? {}) },
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const canned = responses[Math.min(index, responses.length - 1)] ?? {};
    index += 1;
    return makeResponse(canned);
  };

  const client = new DcdrWorkflowClient({
    baseUrl: "https://control.invalid",
    bearerToken: "svc-token",
    fetchFn,
    ...overrides,
  });
  return { client, calls };
}

/** Minimal run DTO. */
function makeRun(status: WorkflowRunStatus, extra?: Record<string, unknown>): Record<string, unknown> {
  return {
    runId: "11111111-1111-4111-8111-111111111111",
    workflow: "SUPPORT_TRIAGE",
    version: "1.0.0",
    status,
    trigger: WorkflowTriggerType.HTTP,
    test: false,
    progress: 0,
    transitions: 0,
    output: null,
    error: null,
    summary: null,
    waits: [],
    usage: null,
    ...extra,
  };
}

/** A deterministic clock + sleep pair; every slept duration is recorded. */
function fakeClock(): { nowFn: () => number; sleepFn: (ms: number) => Promise<void>; slept: number[] } {
  let current = 0;
  const slept: number[] = [];
  return {
    nowFn: () => current,
    sleepFn: async (ms: number) => {
      slept.push(ms);
      current += ms;
    },
    slept,
  };
}

describe("DcdrWorkflowClient configuration", () => {
  it("refuses a blank base URL", () => {
    expect(() => new DcdrWorkflowClient({ baseUrl: "   ", bearerToken: "t", fetchFn: async () => makeResponse({}) })).toThrow(/requires baseUrl/);
  });

  it("refuses a missing token, naming the scopes it needs", () => {
    try {
      new DcdrWorkflowClient({ baseUrl: "https://x.invalid", bearerToken: "", fetchFn: async () => makeResponse({}) });
      throw new Error("should have thrown");
    } catch (e) {
      expect(isDcdrWorkflowError(e)).toBe(true);
      if (isDcdrWorkflowError(e)) {
        expect(e.code).toBe(DcdrWorkflowErrorCode.CONFIGURATION);
        expect(e.message).toContain("workflows:read");
        expect(e.message).toContain("workflows:run");
      }
    }
  });

  it("throws when no fetch implementation is reachable", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
    try {
      Object.defineProperty(globalThis, "fetch", { value: undefined, configurable: true, writable: true });
      expect(() => new DcdrWorkflowClient({ baseUrl: "https://x.invalid", bearerToken: "t" })).toThrow(/fetch implementation/);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "fetch", descriptor);
    }
  });

  it("trims a trailing slash off the base URL", async () => {
    const { client, calls } = makeClient([{ json: { items: [] } }], { baseUrl: "https://control.invalid/" });
    await client.listWorkflows();
    expect(calls[0].url).toBe(`https://control.invalid${DCDR_WORKFLOW_API_BASE_PATH}`);
  });

  it("sends the service token as a bearer on every call", async () => {
    const { client, calls } = makeClient([{ json: { items: [] } }]);
    await client.listWorkflows();
    expect(calls[0].headers["Authorization"]).toBe("Bearer svc-token");
  });

  it("merges configured extra headers", async () => {
    const { client, calls } = makeClient([{ json: { items: [] } }], { extraHeaders: { "x-trace": "abc" } });
    await client.listWorkflows();
    expect(calls[0].headers["x-trace"]).toBe("abc");
  });

  it("never lets an extra header overwrite the Authorization header", async () => {
    // A caller passing `Authorization` in extraHeaders must not silently unauthenticate the client.
    const { client, calls } = makeClient([{ json: { items: [] } }], { extraHeaders: { Authorization: "Bearer somebody-else" } });
    await client.listWorkflows();
    expect(calls[0].headers["Authorization"]).toBe("Bearer svc-token");
  });
});

describe("buildDcdrWorkflowRoutes", () => {
  const routes = buildDcdrWorkflowRoutes();

  it("builds every path under the tenant mount", () => {
    expect(routes.workflows()).toBe("/api/dcdr/workflows");
    expect(routes.workflow("SUPPORT_TRIAGE")).toBe("/api/dcdr/workflows/SUPPORT_TRIAGE");
    expect(routes.versions("SUPPORT_TRIAGE")).toBe("/api/dcdr/workflows/SUPPORT_TRIAGE/versions");
    expect(routes.run("SUPPORT_TRIAGE")).toBe("/api/dcdr/workflows/run/SUPPORT_TRIAGE");
    expect(routes.validate()).toBe("/api/dcdr/workflows/validate");
    expect(routes.runs()).toBe("/api/dcdr/workflows/runs");
    expect(routes.runById("r1")).toBe("/api/dcdr/workflows/runs/r1");
    expect(routes.runCancel("r1")).toBe("/api/dcdr/workflows/runs/r1/cancel");
    expect(routes.runResume("r1")).toBe("/api/dcdr/workflows/runs/r1/resume");
    expect(routes.runSteps("r1")).toBe("/api/dcdr/workflows/runs/r1/steps");
    expect(routes.runEvidence("r1")).toBe("/api/dcdr/workflows/runs/r1/evidence");
    expect(routes.runReport("r1")).toBe("/api/dcdr/workflows/runs/r1/report");
    expect(routes.tasks()).toBe("/api/dcdr/workflows/tasks");
  });

  it("upper-cases workflow keys, because the server does", () => {
    expect(routes.workflow(" support_triage ")).toBe("/api/dcdr/workflows/SUPPORT_TRIAGE");
    expect(routes.run("support_triage")).toBe("/api/dcdr/workflows/run/SUPPORT_TRIAGE");
  });

  it("encodes every path segment", () => {
    expect(routes.workflow("a/b")).toBe("/api/dcdr/workflows/A%2FB");
    expect(routes.runById("a b")).toBe("/api/dcdr/workflows/runs/a%20b");
  });

  it("honours an overridden mount path", () => {
    const custom = buildDcdrWorkflowRoutes("/proxy/wf/");
    expect(custom.workflows()).toBe("/proxy/wf");
    expect(custom.runCancel("r1")).toBe("/proxy/wf/runs/r1/cancel");
  });
});

describe("DcdrWorkflowClient catalogue", () => {
  it("lists workflows with an optional page size", async () => {
    const { client, calls } = makeClient([{ json: { items: [{ key: "SUPPORT_TRIAGE", runnable: true }] } }]);
    const page = await client.listWorkflows({ limit: 10 });
    expect(page.items[0].key).toBe("SUPPORT_TRIAGE");
    expect(calls[0].url).toBe(`https://control.invalid${DCDR_WORKFLOW_API_BASE_PATH}?limit=10`);
  });

  it("omits absent query parameters entirely", async () => {
    const { client, calls } = makeClient([{ json: { items: [] } }]);
    await client.listWorkflows();
    expect(calls[0].url).not.toContain("?");
  });

  it("reads one workflow with its input and output schemas", async () => {
    const { client, calls } = makeClient([
      { json: { key: "SUPPORT_TRIAGE", inputSchema: { ticketId: { type: "string" } }, outputSchema: null, runnable: true } },
    ]);
    const detail = await client.getWorkflow("support_triage");
    expect(detail.inputSchema).toEqual({ ticketId: { type: "string" } });
    expect(calls[0].url).toContain("/SUPPORT_TRIAGE");
  });

  it("lists versions", async () => {
    const { client, calls } = makeClient([{ json: { items: [{ version: "1.0.0", published: true }] } }]);
    const page = await client.listWorkflowVersions("SUPPORT_TRIAGE");
    expect(page.items[0].version).toBe("1.0.0");
    expect(calls[0].url).toContain("/SUPPORT_TRIAGE/versions");
  });

  it("posts a definition under `definition` when validating", async () => {
    const { client, calls } = makeClient([{ json: { valid: true, issues: [], stateCount: 1, nestingDepth: 0, registrySha256: "abc" } }]);
    const result = await client.validateWorkflow({ key: "K" } as never);
    expect(result.valid).toBe(true);
    expect(result.registrySha256).toBe("abc");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toContain("/validate");
    expect(calls[0].body).toEqual({ definition: { key: "K" } });
  });
});

describe("DcdrWorkflowClient running", () => {
  it("posts the run body and upper-cases the key", async () => {
    const { client, calls } = makeClient([
      { status: 202, json: { runId: "r1", status: "QUEUED", completed: false, deduplicated: false, run: makeRun(WorkflowRunStatus.QUEUED) } },
    ]);
    await client.runWorkflow(" support_triage ", { input: { a: 1 }, correlationId: "c-1" });
    expect(calls[0].url).toBe(`https://control.invalid${DCDR_WORKFLOW_API_BASE_PATH}/run/SUPPORT_TRIAGE`);
    expect(calls[0].body).toEqual({ input: { a: 1 }, correlationId: "c-1" });
  });

  it("sends the idempotency key as a header", async () => {
    const { client, calls } = makeClient([{ status: 202, json: { runId: "r1", status: "QUEUED", completed: false, deduplicated: false, run: makeRun(WorkflowRunStatus.QUEUED) } }]);
    await client.runWorkflow("K", {}, { idempotencyKey: "T-1" });
    expect(calls[0].headers[DCDR_WORKFLOW_IDEMPOTENCY_KEY_HEADER]).toBe("T-1");
  });

  it("prefers the option over the body idempotency key, and falls back to the body", async () => {
    const preferred = makeClient([{ status: 202, json: { runId: "r1", status: "QUEUED", completed: false, deduplicated: false, run: makeRun(WorkflowRunStatus.QUEUED) } }]);
    await preferred.client.runWorkflow("K", { idempotencyKey: "from-body" }, { idempotencyKey: "from-option" });
    expect(preferred.calls[0].headers[DCDR_WORKFLOW_IDEMPOTENCY_KEY_HEADER]).toBe("from-option");

    const fallback = makeClient([{ status: 202, json: { runId: "r1", status: "QUEUED", completed: false, deduplicated: false, run: makeRun(WorkflowRunStatus.QUEUED) } }]);
    await fallback.client.runWorkflow("K", { idempotencyKey: "from-body" });
    expect(fallback.calls[0].headers[DCDR_WORKFLOW_IDEMPOTENCY_KEY_HEADER]).toBe("from-body");
  });

  it("surfaces the deduplicated flag of a repeated idempotency key", async () => {
    const { client } = makeClient([{ status: 202, json: { runId: "r1", status: "QUEUED", completed: false, deduplicated: true, run: makeRun(WorkflowRunStatus.QUEUED) } }]);
    const result = await client.runWorkflow("K", {}, { idempotencyKey: "T-1" });
    expect(result.deduplicated).toBe(true);
  });
});

describe("DcdrWorkflowClient run and wait", () => {
  it("runs and polls until the run completes", async () => {
    const { client, calls } = makeClient([
      { status: 202, json: { runId: "r1", status: "QUEUED", completed: false, deduplicated: false, run: makeRun(WorkflowRunStatus.QUEUED) } },
      { json: makeRun(WorkflowRunStatus.RUNNING) },
      { json: makeRun(WorkflowRunStatus.COMPLETED, { output: { category: "billing" } }) },
    ]);
    const clock = fakeClock();

    const result = await client.runWorkflowAndWait("SUPPORT_TRIAGE", { input: { ticketId: "T-1" } }, { nowFn: clock.nowFn, sleepFn: clock.sleepFn });

    expect(result.outcome).toBe(WorkflowWaitOutcome.FINISHED);
    expect(result.succeeded).toBe(true);
    expect(result.output).toEqual({ category: "billing" });
    expect(result.polls).toBe(2);
    expect(calls[0].url).toContain("/run/SUPPORT_TRIAGE");
    expect(calls[1].url).toContain("/runs/");
  });

  it("does not poll at all when the server's own hold already caught the end", async () => {
    const { client, calls } = makeClient([
      { json: { runId: "r1", status: "COMPLETED", completed: true, deduplicated: false, run: makeRun(WorkflowRunStatus.COMPLETED, { output: { ok: true } }) } },
    ]);
    const clock = fakeClock();
    const result = await client.runWorkflowAndWait("K", { waitForResultMs: 30_000 }, { nowFn: clock.nowFn, sleepFn: clock.sleepFn });

    expect(result.outcome).toBe(WorkflowWaitOutcome.FINISHED);
    expect(result.output).toEqual({ ok: true });
    expect(result.polls).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it("backs off geometrically up to the ceiling", async () => {
    const { client } = makeClient([
      { status: 202, json: { runId: "r1", status: "QUEUED", completed: false, deduplicated: false, run: makeRun(WorkflowRunStatus.QUEUED) } },
      { json: makeRun(WorkflowRunStatus.RUNNING) },
      { json: makeRun(WorkflowRunStatus.RUNNING) },
      { json: makeRun(WorkflowRunStatus.RUNNING) },
      { json: makeRun(WorkflowRunStatus.COMPLETED) },
    ]);
    const clock = fakeClock();
    await client.runWorkflowAndWait("K", {}, { initialDelayMs: 100, backoffFactor: 2, maxDelayMs: 300, nowFn: clock.nowFn, sleepFn: clock.sleepFn });
    expect(clock.slept).toEqual([100, 200, 300]);
  });

  it("counts COMPLETED_WITH_ERRORS as a success, because the workflow reached its end", async () => {
    const { client } = makeClient([{ json: makeRun(WorkflowRunStatus.COMPLETED_WITH_ERRORS) }]);
    const clock = fakeClock();
    const result = await client.waitForWorkflowRun("r1", { nowFn: clock.nowFn, sleepFn: clock.sleepFn });
    expect(result.outcome).toBe(WorkflowWaitOutcome.FINISHED);
    expect(result.succeeded).toBe(true);
  });

  it("reports a failed run as finished but not successful, with its error", async () => {
    const { client } = makeClient([{ json: makeRun(WorkflowRunStatus.FAILED, { error: { code: "HTTP_5XX", message: "upstream", stateId: "fetch" } }) }]);
    const clock = fakeClock();
    const result = await client.waitForWorkflowRun("r1", { nowFn: clock.nowFn, sleepFn: clock.sleepFn });
    expect(result.succeeded).toBe(false);
    expect(result.error).toEqual({ code: "HTTP_5XX", message: "upstream", stateId: "fetch" });
  });

  it("stops when the run parks on a person, by default, and never sleeps", async () => {
    const { client } = makeClient([
      { json: makeRun(WorkflowRunStatus.WAITING, { waits: [{ frameId: "f1", path: "approve", stateId: "approve", kind: null, human: true, approval: true, eventKey: null, assignmentGroupKey: null, instructions: null, since: null, timeoutAt: null }] }) },
    ]);
    const clock = fakeClock();
    const result = await client.waitForWorkflowRun("r1", { nowFn: clock.nowFn, sleepFn: clock.sleepFn });
    expect(result.outcome).toBe(WorkflowWaitOutcome.WAITING);
    expect(result.succeeded).toBe(false);
    expect(result.run.waits[0].human).toBe(true);
    expect(clock.slept).toEqual([]);
  });

  it("keeps polling through a wait when asked to", async () => {
    const { client } = makeClient([
      { json: makeRun(WorkflowRunStatus.WAITING) },
      { json: makeRun(WorkflowRunStatus.RUNNING) },
      { json: makeRun(WorkflowRunStatus.COMPLETED) },
    ]);
    const clock = fakeClock();
    const result = await client.waitForWorkflowRun("r1", { stopWhenWaiting: false, initialDelayMs: 10, nowFn: clock.nowFn, sleepFn: clock.sleepFn });
    expect(result.outcome).toBe(WorkflowWaitOutcome.FINISHED);
    expect(result.polls).toBe(3);
  });

  it("gives up with TIMED_OUT and never sleeps past its own deadline", async () => {
    const { client } = makeClient([{ json: makeRun(WorkflowRunStatus.RUNNING) }]);
    const clock = fakeClock();
    const result = await client.waitForWorkflowRun("r1", { timeoutMs: 250, initialDelayMs: 100, backoffFactor: 2, nowFn: clock.nowFn, sleepFn: clock.sleepFn });
    expect(result.outcome).toBe(WorkflowWaitOutcome.TIMED_OUT);
    expect(result.status).toBe(WorkflowRunStatus.RUNNING);
    expect(clock.slept).toEqual([100, 150]);
    expect(clock.slept.reduce((a, b) => a + b, 0)).toBe(250);
  });

  it("reports progress through onPoll", async () => {
    const { client } = makeClient([
      { json: makeRun(WorkflowRunStatus.RUNNING, { progress: 0.5 }) },
      { json: makeRun(WorkflowRunStatus.COMPLETED, { progress: 1 }) },
    ]);
    const clock = fakeClock();
    const seen: number[] = [];
    await client.waitForWorkflowRun("r1", { initialDelayMs: 1, nowFn: clock.nowFn, sleepFn: clock.sleepFn, onPoll: (run) => seen.push(run.progress) });
    expect(seen).toEqual([0.5, 1]);
  });

  it("throws CANCELLED when the caller's signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const { client } = makeClient([{ json: makeRun(WorkflowRunStatus.RUNNING) }]);
    await expect(client.waitForWorkflowRun("r1", { signal: controller.signal })).rejects.toMatchObject({ code: DcdrWorkflowErrorCode.CANCELLED });
  });
});

describe("DcdrWorkflowClient runs and observability", () => {
  it("passes every run filter through, and serialises a Date `since`", async () => {
    const { client, calls } = makeClient([{ json: { items: [] } }]);
    await client.listWorkflowRuns({
      workflow: "SUPPORT_TRIAGE",
      status: WorkflowRunStatus.FAILED,
      correlationId: "T-1",
      since: new Date("2026-09-01T00:00:00.000Z"),
      limit: 10,
      cursor: "abc",
    });
    const url = calls[0].url;
    expect(url).toContain("workflow=SUPPORT_TRIAGE");
    expect(url).toContain("status=FAILED");
    expect(url).toContain("correlationId=T-1");
    expect(url).toContain(`since=${encodeURIComponent("2026-09-01T00:00:00.000Z")}`);
    expect(url).toContain("limit=10");
    expect(url).toContain("cursor=abc");
  });

  it("carries the cursor of a page back into the next request", async () => {
    const { client, calls } = makeClient([{ json: { items: [makeRun(WorkflowRunStatus.COMPLETED)], nextCursor: "next-page" } }]);
    const page = await client.listWorkflowRuns();
    expect(page.nextCursor).toBe("next-page");
    await client.listWorkflowRuns({ cursor: page.nextCursor });
    expect(calls[1].url).toContain("cursor=next-page");
  });

  it("cancels and resumes a run", async () => {
    const cancel = makeClient([{ json: makeRun(WorkflowRunStatus.RUNNING) }]);
    await cancel.client.cancelWorkflowRun("r1");
    expect(cancel.calls[0].method).toBe("POST");
    expect(cancel.calls[0].url).toContain("/runs/r1/cancel");

    const resume = makeClient([{ json: makeRun(WorkflowRunStatus.QUEUED) }]);
    await resume.client.resumeWorkflowRun("r1", { approved: true, comment: "ok" });
    expect(resume.calls[0].body).toEqual({ payload: { approved: true, comment: "ok" } });

    // Addressed form: a run parked on several frames answers one of them by name. The bare payload
    // above still has to work, because it was the whole API before frames and the server resolves
    // the frame itself when there is only one.
    const addressed = makeClient([{ json: makeRun(WorkflowRunStatus.QUEUED) }]);
    await addressed.client.resumeWorkflowRun("r1", { frameId: "root/each:7/fan:sign", payload: { approved: true } });
    expect(addressed.calls[0].body).toEqual({ frameId: "root/each:7/fan:sign", payload: { approved: true } });
  });

  it("reads steps, evidence, report and tasks", async () => {
    const steps = makeClient([{ json: { items: [{ sequence: 1, stateId: "classify", status: WorkflowRunStepStatus.COMPLETED }] } }]);
    expect((await steps.client.listWorkflowRunSteps("r1")).items[0].stateId).toBe("classify");
    expect(steps.calls[0].url).toContain("/runs/r1/steps");

    const evidence = makeClient([{ json: { items: [{ kind: "URL", ref: "https://x.invalid", assurance: "ENFORCED", sequence: 1, stateId: "fetch", iteration: null, toolId: null }] } }]);
    expect((await evidence.client.listWorkflowRunEvidence("r1")).items[0].assurance).toBe("ENFORCED");

    const report = makeClient([{ json: { run: makeRun(WorkflowRunStatus.COMPLETED), steps: { total: 2, failed: 0, byStatus: { COMPLETED: 2 }, timeline: [] }, evidence: [] } }]);
    expect((await report.client.getWorkflowRunReport("r1")).steps.total).toBe(2);

    // Every inbox row carries the frame it belongs to. Without it a caller reading the inbox can
    // only send the run id, and a run holding three tasks refuses that as ambiguous - so this is
    // what makes the inbox actionable rather than just readable.
    const tasks = makeClient([
      {
        json: {
          items: [
            { runId: "r1", frameId: "root/each:0/fan:sign", path: "root/each:0/fan:sign", workflow: "K", approval: true, overdue: false },
            { runId: "r1", frameId: "root/each:1/fan:sign", path: "root/each:1/fan:sign", workflow: "K", approval: true, overdue: false },
          ],
        },
      },
    ]);
    const inbox = await tasks.client.listWorkflowTasks({ groupKey: "finance", limit: 5 });
    expect(tasks.calls[0].url).toContain("groupKey=finance");
    expect(tasks.calls[0].url).toContain("limit=5");
    // Two rows, one run, and they are tellable apart - which is the whole point of the two fields.
    expect(inbox.items.map((task) => task.runId)).toEqual(["r1", "r1"]);
    expect(inbox.items.map((task) => task.frameId)).toEqual(["root/each:0/fan:sign", "root/each:1/fan:sign"]);
    expect(inbox.items.map((task) => task.path)).toEqual(["root/each:0/fan:sign", "root/each:1/fan:sign"]);
  });
});

describe("DcdrWorkflowClient error mapping", () => {
  it("maps the 401 this API answers every auth failure with", async () => {
    const { client } = makeClient([{ status: 401, json: { code: "UNAUTHORIZED", message: "A service token with the workflows:read scope is required.", details: null } }]);
    await expect(client.listWorkflows()).rejects.toMatchObject({ code: DcdrWorkflowErrorCode.UNAUTHORIZED, status: 401 });
  });

  it("maps a 404 to NOT_FOUND", async () => {
    const { client } = makeClient([{ status: 404, json: { code: "NOT_FOUND", message: "Workflow not found.", details: null } }]);
    await expect(client.getWorkflow("NOPE")).rejects.toMatchObject({ code: DcdrWorkflowErrorCode.NOT_FOUND });
  });

  it("prefers the server code over the status, since INVALID_STATE and CONFLICT share 409", async () => {
    const { client } = makeClient([{ status: 409, json: { code: "INVALID_STATE", message: "The run already finished (COMPLETED).", details: null } }]);
    await expect(client.cancelWorkflowRun("r1")).rejects.toMatchObject({ code: DcdrWorkflowErrorCode.INVALID_STATE, status: 409 });
  });

  it("parses the tenant limit payload into typed counters", async () => {
    const { client } = makeClient([
      { status: 409, json: { code: "DCDR_LIMIT_REACHED", limitKey: "maxWorkflowRunsPerDay", current: 50, max: 50, tier: "PRO" } },
    ]);
    const error = await client.runWorkflow("K").catch((e: unknown) => e);
    expect(isDcdrWorkflowError(error)).toBe(true);
    if (isDcdrWorkflowError(error)) {
      expect(error.code).toBe(DcdrWorkflowErrorCode.LIMIT_REACHED);
      expect(error.limit).toEqual({ limitKey: "maxWorkflowRunsPerDay", current: 50, max: 50, tier: "PRO" });
    }
  });

  it("carries structured validation issues in `details`", async () => {
    const { client } = makeClient([{ status: 400, json: { code: "VALIDATION", message: "Invalid run id.", details: ["not a uuid"] } }]);
    const error = await client.getWorkflowRun("nope").catch((e: unknown) => e);
    expect(isDcdrWorkflowError(error)).toBe(true);
    if (isDcdrWorkflowError(error)) expect(error.details).toEqual(["not a uuid"]);
  });

  it("maps statuses that arrive with no server code", async () => {
    const cases: Array<{ status: number; code: DcdrWorkflowErrorCode }> = [
      { status: 403, code: DcdrWorkflowErrorCode.FORBIDDEN },
      { status: 429, code: DcdrWorkflowErrorCode.RATE_LIMITED },
      { status: 503, code: DcdrWorkflowErrorCode.DISABLED },
      { status: 500, code: DcdrWorkflowErrorCode.SERVER_ERROR },
    ];
    for (const testCase of cases) {
      const { client } = makeClient([{ status: testCase.status, text: "nope" }]);
      await expect(client.listWorkflows()).rejects.toMatchObject({ code: testCase.code });
    }
  });

  it("refuses a 2xx body that is not JSON", async () => {
    const { client } = makeClient([{ status: 200, text: "<html>maintenance</html>" }]);
    await expect(client.listWorkflows()).rejects.toMatchObject({ code: DcdrWorkflowErrorCode.UNEXPECTED_RESPONSE });
  });

  it("reports a transport failure as NETWORK rather than letting it escape raw", async () => {
    const client = new DcdrWorkflowClient({
      baseUrl: "https://control.invalid",
      bearerToken: "t",
      fetchFn: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    const error = await client.listWorkflows().catch((e: unknown) => e);
    expect(isDcdrWorkflowError(error)).toBe(true);
    if (isDcdrWorkflowError(error)) {
      expect(error.code).toBe(DcdrWorkflowErrorCode.NETWORK);
      expect(error.message).toContain("ECONNREFUSED");
    }
  });

  it("reports its own timeout as TIMEOUT", async () => {
    const client = new DcdrWorkflowClient({
      baseUrl: "https://control.invalid",
      bearerToken: "t",
      timeoutMs: 5,
      fetchFn: (_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    });
    await expect(client.listWorkflows()).rejects.toMatchObject({ code: DcdrWorkflowErrorCode.TIMEOUT });
  });

  it("reports a caller abort as CANCELLED rather than as a timeout", async () => {
    const controller = new AbortController();
    const client = new DcdrWorkflowClient({
      baseUrl: "https://control.invalid",
      bearerToken: "t",
      timeoutMs: 60_000,
      fetchFn: (_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    });
    const pending = client.runWorkflow("K", {}, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: DcdrWorkflowErrorCode.CANCELLED });
  });

  it("bounds the body preview it embeds in the message", async () => {
    const { client } = makeClient([{ status: 500, text: "x".repeat(9000) }]);
    const error = await client.listWorkflows().catch((e: unknown) => e);
    expect(isDcdrWorkflowError(error)).toBe(true);
    if (isDcdrWorkflowError(error)) expect((error.bodyPreview ?? "").length).toBeLessThanOrEqual(2001);
  });
});

describe("workflow client wire vocabulary", () => {
  it("keeps the run statuses stable (they are persisted varchar values)", () => {
    expect(Object.values(WorkflowRunStatus)).toEqual([
      "QUEUED",
      "RUNNING",
      "WAITING",
      "COMPLETED",
      "COMPLETED_WITH_ERRORS",
      "FAILED",
      "CANCELLED",
      "TIMEOUT",
    ]);
  });

  it("keeps the trigger types and step statuses stable", () => {
    expect(Object.values(WorkflowTriggerType)).toEqual(["MANUAL", "HTTP", "CRON", "EVENT"]);
    expect(Object.values(WorkflowRunStepStatus)).toEqual(["RUNNING", "COMPLETED", "FAILED", "WAITING", "CANCELLED"]);
  });

  it("keeps the mount path and the server-side hold ceiling stable", () => {
    expect(DCDR_WORKFLOW_API_BASE_PATH).toBe("/api/dcdr/workflows");
    expect(DCDR_WORKFLOW_MAX_WAIT_FOR_RESULT_MS).toBe(120_000);
    expect(DCDR_WORKFLOW_IDEMPOTENCY_KEY_HEADER).toBe("Idempotency-Key");
  });

  it("agrees with itself about which statuses are terminal", () => {
    for (const status of Object.values(WorkflowRunStatus)) {
      expect(isWorkflowRunTerminal(status)).toBe(WORKFLOW_RUN_TERMINAL_STATUSES.includes(status));
    }
    expect(isWorkflowRunTerminal(null)).toBe(false);
    expect(isWorkflowRunTerminal(undefined)).toBe(false);
  });

  it("treats only the two completed statuses as successful", () => {
    expect(isWorkflowRunSuccessful(WorkflowRunStatus.COMPLETED)).toBe(true);
    expect(isWorkflowRunSuccessful(WorkflowRunStatus.COMPLETED_WITH_ERRORS)).toBe(true);
    for (const status of [WorkflowRunStatus.FAILED, WorkflowRunStatus.CANCELLED, WorkflowRunStatus.TIMEOUT, WorkflowRunStatus.WAITING, WorkflowRunStatus.QUEUED, WorkflowRunStatus.RUNNING]) {
      expect(isWorkflowRunSuccessful(status)).toBe(false);
    }
  });
});

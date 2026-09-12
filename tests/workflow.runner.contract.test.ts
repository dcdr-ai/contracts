/// <reference types="jest" />
import {
  buildWorkflowRunnerRoutes,
  DcdrWorkflowRunnerClient,
  isWorkflowRunnerTerminate,
  WORKFLOW_RUNNER_BASE_PATH,
  WORKFLOW_RUNNER_TERMINATE_ID,
  WORKFLOW_RUNNER_TOKEN_HEADER,
  WorkflowRunnerCapability,
  WorkflowRunnerLogFileType,
  WorkflowRunnerLogLevel,
  WorkflowRunnerOutputRequest,
  WorkflowRunnerPayloadLogging,
  WorkflowRunnerStepsRequest,
  WorkflowRunnerAgentCursor,
  WorkflowRunnerStepStatus,
  WorkflowRunOutputStatus,
    WorkflowRunnerFrameKind,
    WorkflowRunnerFrameStatus,
} from "../src/workflow.runner.contract";
import { WorkflowEvidenceKind, WorkflowStateRunStatus, WorkflowStateType, WorkflowWaitKind } from "../src/workflow.contract";

interface RecordedCall {
  url: string;
  init?: RequestInit;
}

/**
 * Builds a fake fetch that records calls and returns the configured responses in order.
 */
function makeFetch(responses: Array<{ ok?: boolean; status?: number; json?: unknown; text?: string; contentType?: string }>) {
  const calls: RecordedCall[] = [];
  let index = 0;
  const fetchFn = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    const spec = responses[Math.min(index, responses.length - 1)];
    index++;
    const body = spec.text !== undefined ? spec.text : spec.json === undefined ? "" : JSON.stringify(spec.json);
    const headers = new Headers({ "content-type": spec.contentType ?? "application/json" });
    return {
      ok: spec.ok ?? true,
      status: spec.status ?? 200,
      headers,
      text: async () => body,
    } as unknown as Response;
  };
  return { fetchFn, calls };
}

/**
 * Parses the JSON body of a recorded call.
 */
function bodyOf(call: RecordedCall): unknown {
  return call.init?.body ? JSON.parse(String(call.init.body)) : undefined;
}

/**
 * Reads a header from a recorded call.
 */
function headerOf(call: RecordedCall, name: string): string | undefined {
  const headers = call.init?.headers as Record<string, string> | undefined;
  return headers?.[name];
}

describe("workflow.runner.contract routes and constants", () => {
  it("keeps the wire-level constants and enums stable", () => {
    expect(WORKFLOW_RUNNER_BASE_PATH).toBe("/api/workflows");
    expect(WORKFLOW_RUNNER_TERMINATE_ID).toBe("TERMINATE");
    expect(WORKFLOW_RUNNER_TOKEN_HEADER).toBe("token");
    expect(Object.values(WorkflowRunOutputStatus)).toEqual(["COMPLETED", "ERROR", "TIMEOUT", "CANCELED", "WAITING"]);
    expect(Object.values(WorkflowRunnerStepStatus)).toEqual(["RUNNING", "COMPLETED", "FAILED", "WAITING", "CANCELLED"]);
    expect(Object.values(WorkflowRunnerPayloadLogging)).toEqual(["NONE", "METADATA", "FULL"]);
    expect(WorkflowRunnerCapability.WORKFLOW_RUNNER).toBe("WORKFLOW_RUNNER");
    expect(Object.values(WorkflowRunnerLogFileType)).toEqual(["RUN_LOG", "ARTIFACT"]);
  });

  it("builds every route under the base path with encoded ids", () => {
    const routes = buildWorkflowRunnerRoutes();
    expect(routes.next()).toBe("/api/workflows/next");
    expect(routes.configuration("r1")).toBe("/api/workflows/r1/configuration");
    expect(routes.input("r1")).toBe("/api/workflows/r1/input");
    expect(routes.connection("r1", "crm/eu")).toBe("/api/workflows/r1/connection/crm%2Feu");
    expect(routes.aiExecutionPlan("r1", "SUPPORT_TICKET_CLASSIFIER")).toBe("/api/workflows/r1/ai/SUPPORT_TICKET_CLASSIFIER");
    expect(routes.isCanceled("r1")).toBe("/api/workflows/r1/is_canceled");
    expect(routes.progress("r1")).toBe("/api/workflows/r1/progress");
    expect(routes.log("r1")).toBe("/api/workflows/r1/log");
    expect(routes.logFileUrl("r1", WorkflowRunnerLogFileType.RUN_LOG)).toBe("/api/workflows/r1/logs/run_log/url");
    expect(routes.logFile("r1", WorkflowRunnerLogFileType.ARTIFACT)).toBe("/api/workflows/r1/logs/artifact");
    expect(routes.steps("r1")).toBe("/api/workflows/r1/steps");
    expect(routes.output("r1")).toBe("/api/workflows/r1/output");
    expect(buildWorkflowRunnerRoutes("/custom/").next()).toBe("/custom/next");
  });

  it("detects the TERMINATE sentinel", () => {
    expect(isWorkflowRunnerTerminate({ id: "TERMINATE" })).toBe(true);
    expect(isWorkflowRunnerTerminate({ id: "run-1" })).toBe(false);
    expect(isWorkflowRunnerTerminate({ id: null })).toBe(false);
    expect(isWorkflowRunnerTerminate(null)).toBe(false);
  });

  it("round-trips request shapes through JSON", () => {
    const steps: WorkflowRunnerStepsRequest = {
      steps: [
        {
          sequence: 3,
          stateId: "classify",
          type: WorkflowStateType.INTENT,
          attempt: 1,
          status: WorkflowRunnerStepStatus.COMPLETED,
          startedAt: "2026-09-06T00:00:00.000Z",
          finishedAt: "2026-09-06T00:00:01.000Z",
          latencyMs: 1000,
          output: { category: "x" },
          gatewayRequestId: "gw-1",
          chosenNext: "route",
        },
        { sequence: 4, stateId: "route", type: WorkflowStateType.CHOICE, attempt: 1, status: WorkflowRunnerStepStatus.COMPLETED, startedAt: "2026-09-06T00:00:01.000Z", caseId: null, chosenNext: "respond" },
        {
          sequence: 5,
          stateId: "research",
          type: WorkflowStateType.AGENT,
          attempt: 1,
          iteration: 3,
          toolId: "fetch",
          status: WorkflowRunnerStepStatus.COMPLETED,
          startedAt: "2026-09-06T00:00:02.000Z",
          details: { httpStatus: 200, bytes: 1024 },
          evidence: [{ kind: WorkflowEvidenceKind.URL, ref: "https://example.org/report", sha256: "abc", capturedAt: "2026-09-06T00:00:02.500Z", iteration: 3 }],
        },
      ],
      cursor: { frames: [{ id: "root", kind: WorkflowRunnerFrameKind.ROOT, depth: 0, path: "root", status: WorkflowRunnerFrameStatus.RUNNING, currentStateId: "respond", transitions: 4, states: {} }] },
    };
    expect(JSON.parse(JSON.stringify(steps))).toEqual(steps);

    const agentCursor: WorkflowRunnerAgentCursor = {
      stateId: "research",
      iteration: 4,
      history: [{ iteration: 3, tool: "fetch", args: { url: "https://example.org/report" }, output: { ok: true }, notes: "report found" }],
      notes: ["report found"],
      trackedCalls: 7,
      estimatedCost: 1.25,
      startedAt: "2026-09-06T00:00:00.000Z",
    };
    // The agent's place rides on the frame that holds it, which is what retired the standalone
    // cursor beside it.
    const parked: WorkflowRunnerStepsRequest = {
      steps: [],
      cursor: { frames: [{ id: "root", kind: WorkflowRunnerFrameKind.ROOT, depth: 0, path: "root", status: WorkflowRunnerFrameStatus.RUNNING, currentStateId: "research", transitions: 5, states: {}, agentCursor }] },
    };
    expect(JSON.parse(JSON.stringify(parked))).toEqual(parked);

    const output: WorkflowRunnerOutputRequest = {
      status: WorkflowRunOutputStatus.WAITING,
      waits: [{ frameId: "root", path: "root", details: { stateId: "approve", kind: WorkflowWaitKind.HUMAN_TASK, timeoutAt: "2026-09-07T00:00:00.000Z", assignees: ["ana@example.com"] } }],
      usage: { trackedCalls: 2 },
      transitions: 5,
    };
    expect(JSON.parse(JSON.stringify(output))).toEqual(output);
  });
});

describe("workflow.runner.contract DcdrWorkflowRunnerClient", () => {
  it("requires baseUrl and token", () => {
    expect(() => new DcdrWorkflowRunnerClient({ baseUrl: "", token: "t" })).toThrow("baseUrl");
    expect(() => new DcdrWorkflowRunnerClient({ baseUrl: "https://x", token: "" })).toThrow("token");
  });

  it("polls next with the token header and normalizes idle/terminate responses", async () => {
    const { fetchFn, calls } = makeFetch([{ json: { id: "run-1" } }, { text: "" }, { json: null }, { json: { id: "TERMINATE" } }]);
    const client = new DcdrWorkflowRunnerClient({ baseUrl: "https://dcdr.example/", token: "secret", fetchFn, extraHeaders: { "x-runner": "1" } });
    const request = { server: "runner-1", capabilities: { [WorkflowRunnerCapability.WORKFLOW_RUNNER]: "true", [WorkflowRunnerCapability.WORKFLOW_RUNNER_VERSION]: "20260906.1" }, upSince: 1 };

    expect(await client.next(request)).toEqual({ id: "run-1" });
    expect(calls[0].url).toBe("https://dcdr.example/api/workflows/next");
    expect(calls[0].init?.method).toBe("POST");
    expect(headerOf(calls[0], "token")).toBe("secret");
    expect(headerOf(calls[0], "x-runner")).toBe("1");
    expect(bodyOf(calls[0])).toEqual(request);

    expect(await client.next(request)).toEqual({ id: null });
    expect(await client.next(request)).toEqual({ id: null });
    const terminate = await client.next(request);
    expect(isWorkflowRunnerTerminate(terminate)).toBe(true);
  });

  it("calls every endpoint with the expected method and path", async () => {
    const { fetchFn, calls } = makeFetch([
      { json: { runId: "r1", deadlineAt: "d", timeoutMs: 1, limits: { maxTransitionsPerRun: 1, payloadLogging: "METADATA", maxStepPayloadBytes: 1, defaultStateTimeoutMs: 1 }, allowLogs: true, logLevel: "INFO" } },
      { json: { run: { id: "r1" }, workflow: { key: "K" }, definition: {}, input: {}, connections: [] } },
      { json: { key: "crm", headers: [{ name: "Authorization", value: "Bearer x" }] } },
      { json: { baseUrl: "https://rt", intent: "I", sessionToken: "s", timeoutMs: 1, expiresAt: "e" } },
      { json: { canceled: true } },
      { json: { ok: true } },
      { json: { ok: true } },
      { json: { uploadUrl: "https://s3/u", method: "PUT", expiresAt: "e" } },
      { json: { ok: true } },
      { json: { accepted: 2, canceled: false } },
      { json: { ok: true } },
    ]);
    const client = new DcdrWorkflowRunnerClient({ baseUrl: "https://dcdr.example", token: "secret", fetchFn });

    expect((await client.configuration("r1")).runId).toBe("r1");
    expect((await client.input("r1")).workflow.key).toBe("K");
    expect((await client.connectionSecrets("r1", "crm")).headers?.[0]?.name).toBe("Authorization");
    expect((await client.aiExecutionPlan("r1", "I")).sessionToken).toBe("s");
    expect(await client.isCanceled("r1")).toBe(true);
    expect((await client.progress("r1", { progress: 0.5, currentStateId: "a" })).ok).toBe(true);
    expect((await client.log("r1", { entries: [{ level: WorkflowRunnerLogLevel.INFO, message: "m", at: "t" }] })).ok).toBe(true);
    expect((await client.logFileUploadUrl("r1", WorkflowRunnerLogFileType.RUN_LOG, { id: "f1", fileName: "run.log" })).uploadUrl).toBe("https://s3/u");
    expect((await client.registerLogFile("r1", WorkflowRunnerLogFileType.RUN_LOG, { id: "f1", fileName: "run.log" })).ok).toBe(true);
    const stepsRes = await client.steps("r1", { steps: [], cursor: { frames: [] } });
    expect(stepsRes.accepted).toBe(2);
    expect((await client.output("r1", { status: WorkflowRunOutputStatus.COMPLETED, output: { x: 1 }, transitions: 3 })).ok).toBe(true);

    const seen = calls.map((c) => `${c.init?.method} ${c.url.replace("https://dcdr.example", "")}`);
    expect(seen).toEqual([
      "GET /api/workflows/r1/configuration",
      "GET /api/workflows/r1/input",
      "GET /api/workflows/r1/connection/crm",
      "GET /api/workflows/r1/ai/I",
      "GET /api/workflows/r1/is_canceled",
      "POST /api/workflows/r1/progress",
      "POST /api/workflows/r1/log",
      "POST /api/workflows/r1/logs/run_log/url",
      "POST /api/workflows/r1/logs/run_log",
      "POST /api/workflows/r1/steps",
      "POST /api/workflows/r1/output",
    ]);
    expect(calls.every((c) => headerOf(c, "token") === "secret")).toBe(true);
    expect(bodyOf(calls[10])).toEqual({ status: "COMPLETED", output: { x: 1 }, transitions: 3 });
  });

  it("formats HTTP and content-type errors with a bounded preview", async () => {
    const { fetchFn } = makeFetch([
      { ok: false, status: 403, text: "You don't have permissions ".repeat(20) },
      { text: "<html>oops</html>", contentType: "text/html" },
    ]);
    const client = new DcdrWorkflowRunnerClient({ baseUrl: "https://dcdr.example", token: "secret", fetchFn });
    await expect(client.isCanceled("r1")).rejects.toThrow(/POST|GET \/api\/workflows\/r1\/is_canceled status=403 body=You don't have permissions/);
    await expect(client.isCanceled("r1")).rejects.toThrow("expected JSON");
  });

  it("hands the agent cursor back through the resume state (v3.1.0)", async () => {
    const cursor: WorkflowRunnerAgentCursor = {
      stateId: "research",
      iteration: 3,
      history: [{ iteration: 1, tool: "search", args: { q: "acme" }, output: { hits: 2 } }, { iteration: 2, tool: "ask_human", args: { question: "Proceed?" } }],
      notes: ["asked the operator"],
      trackedCalls: 2,
      startedAt: "2026-09-08T10:00:00.000Z",
    };
    const { fetchFn, calls } = makeFetch([
      {
        json: {
          run: { id: "run-1", attempt: 2, deadlineAt: "2026-09-08T12:00:00.000Z" },
          workflow: { id: "wf-1", key: "SUPPLIER_CHECK", version: "1.2.0", sha256: "a".repeat(64) },
          definition: { schemaVersion: 1, key: "SUPPLIER_CHECK", name: "x", settings: { timeoutMs: 1000, maxTransitionsPerRun: 5 }, startAt: "research", states: {} },
          input: {},
          connections: [],
          resume: {
            frames: [{ id: "root", kind: WorkflowRunnerFrameKind.ROOT, depth: 0, path: "root", status: WorkflowRunnerFrameStatus.WAITING, currentStateId: "research", transitions: 1, states: {}, agentCursor: cursor, wait: { stateId: "research", kind: WorkflowWaitKind.HUMAN_TASK, timeoutAt: "2026-09-07T00:00:00.000Z" }, resumePayload: { approved: true } }],
            nextSequence: 4,
          },
        },
      },
    ]);
    const client = new DcdrWorkflowRunnerClient({ baseUrl: "https://backend.test", token: "t", fetchFn });
    const input = await client.input("run-1");
    expect(calls).toHaveLength(1);
    const root = input.resume?.frames.find((frame) => !frame.parentFrameId);
    expect(root?.agentCursor).toEqual(cursor);
    expect(root?.agentCursor?.history[1].output).toBeUndefined();
  });

  it("uses the run status snapshot enum shared with the workflow contract", () => {
    expect(WorkflowStateRunStatus.COMPLETED).toBe("COMPLETED");
  });
});

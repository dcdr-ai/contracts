import {
  DCDR_MANAGED_SERVICE_TOKEN_AID,
  DCDR_WORKFLOW_SESSION_AID_PREFIX,
  WorkflowRunGrantStatusResponse,
  isDcdrWorkflowRunSessionAid,
} from "../index";

describe("session.contract tenant workflow run sessions (v3.24.0)", () => {
  it("pins the wire-level markers both sides compare against", () => {
    expect(DCDR_WORKFLOW_SESSION_AID_PREFIX).toBe("workflow_");
    expect(DCDR_MANAGED_SERVICE_TOKEN_AID).toBe("service");
  });

  it("recognises workflow_<key> as a run session aid", () => {
    expect(isDcdrWorkflowRunSessionAid("workflow_ONBOARDING")).toBe(true);
    expect(isDcdrWorkflowRunSessionAid("workflow_a")).toBe(true);
  });

  it("never treats the managed token marker, a bare prefix or other aids as a run session", () => {
    expect(isDcdrWorkflowRunSessionAid(DCDR_MANAGED_SERVICE_TOKEN_AID)).toBe(false);
    expect(isDcdrWorkflowRunSessionAid("workflow_")).toBe(false);
    expect(isDcdrWorkflowRunSessionAid("Workflow_X")).toBe(false);
    expect(isDcdrWorkflowRunSessionAid(" workflow_X")).toBe(false);
    expect(isDcdrWorkflowRunSessionAid("serviceworkflow_X")).toBe(false);
    expect(isDcdrWorkflowRunSessionAid("")).toBe(false);
    expect(isDcdrWorkflowRunSessionAid(null)).toBe(false);
    expect(isDcdrWorkflowRunSessionAid(undefined)).toBe(false);
  });

  it("keeps customerId optional on the run grant answer and survives a JSON round-trip", () => {
    const legacy: WorkflowRunGrantStatusResponse = { runId: "r", active: true, internal: true, intentAllowed: true, deadlineAt: null };
    const tenant: WorkflowRunGrantStatusResponse = { ...legacy, internal: false, customerId: "tenant-a" };
    const platform: WorkflowRunGrantStatusResponse = { ...legacy, customerId: null };

    expect(JSON.parse(JSON.stringify(legacy))).toEqual(legacy);
    expect(JSON.parse(JSON.stringify(tenant)).customerId).toBe("tenant-a");
    expect(JSON.parse(JSON.stringify(platform)).customerId).toBeNull();
  });
});

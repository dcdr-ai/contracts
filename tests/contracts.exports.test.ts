import * as contracts from "../src/index";

import {
  createExecutionError,
  ExecutionErrorCode,
  isExecutionErrorCode,
} from "../src/errors.contract";
import { ExecutionPolicyType } from "../src/policies.contract";
import { PromptVariable, PromptVariableType } from "../src/prompts.contract";
import { IntentProvider } from "../src/provider.contract";
import { CapabilityKey } from "../src/capabilities.contract";
import {
  CONDITION_OPERATOR_META,
  ConditionLogicOp,
  ConditionOperator,
  evaluateConditionTreeOnScope,
  validateConditionTree,
} from "../src/index";
import { ConditionOp } from "../src/implementations.contract";
import { DcdrWorkflowRunnerClient, WORKFLOW_RUNNER_BASE_PATH, WorkflowRunOutputStatus } from "../src/index";
import {
  parseWorkflowValueShorthand,
  validateWorkflowDefinition,
  WorkflowSchemaVersion,
  WorkflowStateType,
  WorkflowValueKind,
} from "../src/index";
import {
  AssetType,
  ASSET_TYPE_VALUES,
  ASSET_TYPE_LABELS,
  AssetStorageCredentialsKind,
  DcdrAssetScope,
  ExecutionAssetDatasourceResolutionMode,
  ExecutionAssetDatasourceType,
  DEFAULT_TRACKED_CALL_RATING_MATRIX_V1,
  TrackedCallRatingAssetFamily,
} from "../src/index";

describe("@dcdr/contracts exports", () => {
  it("exports runtime enums/classes/functions", () => {
    expect(typeof contracts).toBe("object");

    // Enums exist at runtime
    expect(ExecutionPolicyType.WEIGHTED).toBe("WEIGHTED");
    expect(IntentProvider.OPEN_AI).toBe("OPEN_AI");
    expect(CapabilityKey.AI_PROMPTS_CANARY).toBe("AI_PROMPTS_CANARY");
    expect(ExecutionErrorCode.BAD_REQUEST).toBe("BAD_REQUEST");
    // 3.25.0: errors an external app reported on a telemetry span (wire value pinned).
    expect(ExecutionErrorCode.TELEMETRY_REPORTED_ERROR).toBe("TELEMETRY_REPORTED_ERROR");
    expect(isExecutionErrorCode("TELEMETRY_REPORTED_ERROR")).toBe(true);

    // Classes exist at runtime
    const v = new PromptVariable(PromptVariableType.STRING, true, "name");
    expect(v.type).toBe(PromptVariableType.STRING);
    expect(v.required).toBe(true);

    // Factory functions exist at runtime
    const err = createExecutionError(ExecutionErrorCode.BAD_REQUEST, "missing");
    expect(err.code).toBe(ExecutionErrorCode.BAD_REQUEST);
    expect(err.message).toBe("missing");

    // Guards exist at runtime
    expect(isExecutionErrorCode(ExecutionErrorCode.BAD_REQUEST)).toBe(true);
    const unknown = `UNKNOWN_${ExecutionErrorCode.BAD_REQUEST}`;
    expect(isExecutionErrorCode(unknown)).toBe(false);
  });

  it("exports both clients' error types from the root barrel (3.15.0)", () => {
    // An application catching a failure of either half reaches its type through the barrel alone.
    expect(contracts.DcdrRuntimeErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");
    expect(contracts.DcdrWorkflowErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");

    const runtimeError = new contracts.DcdrRuntimeError({ code: contracts.DcdrRuntimeErrorCode.TIMEOUT, message: "too slow" });
    expect(runtimeError).toBeInstanceOf(Error);
    expect(contracts.isDcdrRuntimeError(runtimeError)).toBe(true);
    expect(contracts.isDcdrRuntimeErrorCode("TIMEOUT")).toBe(true);
    expect(contracts.isDcdrRuntimeErrorCode("NOT_A_CODE")).toBe(false);

    const workflowError = new contracts.DcdrWorkflowError({ code: contracts.DcdrWorkflowErrorCode.TIMEOUT, message: "too slow", method: "POST", path: "/x" });
    expect(contracts.isDcdrWorkflowError(workflowError)).toBe(true);
    expect(contracts.isDcdrRuntimeError(workflowError)).toBe(false);
    expect(contracts.isDcdrWorkflowError(runtimeError)).toBe(false);
  });

  it("exports the default client origins from the root barrel (telemetry host since 3.25.1)", () => {
    // Wire-level defaults: a client built without URLs reaches these hosts.
    expect(contracts.DCDR_DEFAULT_RUNTIME_URL).toBe("https://runtime.dcdr.ai");
    expect(contracts.DCDR_DEFAULT_CONTROL_URL).toBe("https://dcdr.ai");
    expect(contracts.DCDR_DEFAULT_TELEMETRY_URL).toBe("https://telemetry.dcdr.ai");
  });

  it("exports the telemetry end-user id mode and pseudonym helper from the root barrel (3.26.0)", () => {
    // Wire values the control plane stores per service.
    expect(contracts.TelemetryEndUserIdMode.PSEUDONYMISED).toBe("PSEUDONYMISED");
    expect(contracts.TelemetryEndUserIdMode.AS_SENT).toBe("AS_SENT");
    expect(typeof contracts.telemetryEndUserPseudonym).toBe("function");
    expect(typeof contracts.decodeTelemetryHashKey).toBe("function");
    expect(contracts.DCDR_TELEMETRY_HASH_KEY_MIN_BYTES).toBe(16);
    expect(contracts.DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS.length).toBeGreaterThan(0);
  });

  it("exports the captured content contract and the gateway capture capability from the root barrel (3.27.0)", () => {
    // Wire values the control plane stores and compares.
    expect(contracts.CapturedChatRole.USER).toBe("user");
    expect(contracts.CapturedChatRole.OTHER).toBe("other");
    expect(contracts.CapturedContentWithheldReason.PROCESSORS_UNAVAILABLE).toBe("PROCESSORS_UNAVAILABLE");
    expect(contracts.DCDR_CAPTURED_CONTENT_MAX_CHARS).toBe(65_536);
    expect(contracts.DCDR_TELEMETRY_CONTENT_MAX_CHARS).toBe(contracts.DCDR_CAPTURED_CONTENT_MAX_CHARS);
    expect(contracts.CapabilityKey.AI_GATEWAY_CONTENT_CAPTURE).toBe("AI_GATEWAY_CONTENT_CAPTURE");
  });

  it("exports the shared condition contract from the root barrel", () => {
    expect(ConditionLogicOp.AND).toBe("AND");
    expect(ConditionOperator.EQUALS).toBe("EQUALS");
    expect(CONDITION_OPERATOR_META[ConditionOperator.EQUALS].arity).toBe(1);
    expect(typeof evaluateConditionTreeOnScope).toBe("function");
    expect(typeof validateConditionTree).toBe("function");
    // Deprecated 2.x name resolves to the same enum object.
    expect(ConditionOp).toBe(ConditionOperator);
    expect(contracts.ConditionOp).toBe(ConditionOperator);
    expect(contracts.ConditionLogicOp).toBe(ConditionLogicOp);
  });

  it("exports the workflow contract from the root barrel", () => {
    expect(WorkflowStateType.INTENT).toBe("INTENT");
    expect(WorkflowSchemaVersion.V1).toBe(1);
    expect(parseWorkflowValueShorthand({ $ref: "input.a" })).toEqual({ kind: WorkflowValueKind.REF, ref: "input.a" });
    expect(typeof validateWorkflowDefinition).toBe("function");
    expect(typeof contracts.computeWorkflowDefinitionSha256).toBe("function");
    expect(contracts.WORKFLOW_MAX_TAGS).toBe(10);
  });

  it("exports the workflow runner protocol from the root barrel", () => {
    expect(WORKFLOW_RUNNER_BASE_PATH).toBe("/api/workflows");
    expect(WorkflowRunOutputStatus.WAITING).toBe("WAITING");
    expect(typeof DcdrWorkflowRunnerClient).toBe("function");
  });

  it("keeps IntentProvider stable and non-empty", () => {
    const values = Object.values(IntentProvider);
    expect(values.length).toBeGreaterThan(0);
    expect(values).toContain("RULES");
    expect(values).toContain("OPEN_AI");
    expect(new Set(values).size).toBe(values.length);
  });

  it("exports asset contract symbols from the root barrel", () => {
    // Enums
    expect(AssetType.DOCUMENT).toBe("document");
    expect(AssetType.IMAGE).toBe("image");
    expect(AssetType.TEXT).toBe("text");
    expect(AssetType.AUDIO).toBe("audio");
    expect(AssetType.VIDEO).toBe("video");

    expect(DcdrAssetScope.READ).toBe("assets:read");
    expect(DcdrAssetScope.WRITE).toBe("assets:write");
    expect(DcdrAssetScope.DELETE).toBe("assets:delete");

    expect(ExecutionAssetDatasourceResolutionMode.BACKEND).toBe("BACKEND");
    expect(ExecutionAssetDatasourceResolutionMode.EXPLICIT).toBe("EXPLICIT");

    expect(ExecutionAssetDatasourceType.S3).toBe("S3");
    expect(AssetStorageCredentialsKind.GOOGLE_CLOUD_SERVICE_ACCOUNT).toBe(
      "GOOGLE_CLOUD_SERVICE_ACCOUNT",
    );

    // Constants
    expect(Array.isArray(ASSET_TYPE_VALUES)).toBe(true);
    expect(ASSET_TYPE_VALUES).toContain("document");
    expect(ASSET_TYPE_VALUES).toContain("image");

    expect(typeof ASSET_TYPE_LABELS).toBe("object");
    expect(ASSET_TYPE_LABELS[AssetType.DOCUMENT]).toBe("document");

    expect(TrackedCallRatingAssetFamily.DOCUMENT).toBe("document");
    expect(DEFAULT_TRACKED_CALL_RATING_MATRIX_V1.version).toBe("1.0");
    expect(DEFAULT_TRACKED_CALL_RATING_MATRIX_V1.buckets.length).toBeGreaterThan(
      0,
    );
  });
});

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
  AssetType,
  ASSET_TYPE_VALUES,
  ASSET_TYPE_LABELS,
  AssetStorageCredentialsKind,
  DcdrAssetScope,
  ExecutionAssetDatasourceResolutionMode,
  ExecutionAssetDatasourceType,
} from "../src/index";

describe("@dcdr/contracts exports", () => {
  it("exports runtime enums/classes/functions", () => {
    expect(typeof contracts).toBe("object");

    // Enums exist at runtime
    expect(ExecutionPolicyType.WEIGHTED).toBe("WEIGHTED");
    expect(IntentProvider.OPEN_AI).toBe("OPEN_AI");
    expect(CapabilityKey.AI_PROMPTS_CANARY).toBe("AI_PROMPTS_CANARY");
    expect(ExecutionErrorCode.BAD_REQUEST).toBe("BAD_REQUEST");

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
  });
});

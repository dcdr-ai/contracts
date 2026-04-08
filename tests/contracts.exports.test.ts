import * as contracts from "../src/index";

import { createExecutionError } from "../src/errors.contract";
import { ExecutionPolicyType } from "../src/policies.contract";
import { PromptVariable, PromptVariableType } from "../src/prompts.contract";
import { IntentProvider } from "../src/provider.contract";
import { CapabilityKey } from "../src/capabilities.contract";

describe("@dcdr/contracts exports", () => {
  it("exports runtime enums/classes/functions", () => {
    expect(typeof contracts).toBe("object");

    // Enums exist at runtime
    expect(ExecutionPolicyType.WEIGHTED).toBe("WEIGHTED");
    expect(IntentProvider.OPEN_AI).toBe("OPEN_AI");
    expect(CapabilityKey.AI_PROMPTS_CANARY).toBe("AI_PROMPTS_CANARY");

    // Classes exist at runtime
    const v = new PromptVariable(PromptVariableType.STRING, true, "name");
    expect(v.type).toBe(PromptVariableType.STRING);
    expect(v.required).toBe(true);

    // Factory functions exist at runtime
    const err = createExecutionError("BAD_REQUEST", "missing");
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("missing");
  });

  it("keeps IntentProvider stable and non-empty", () => {
    const values = Object.values(IntentProvider);
    expect(values.length).toBeGreaterThan(0);
    expect(values).toContain("RULES");
    expect(values).toContain("OPEN_AI");
    expect(new Set(values).size).toBe(values.length);
  });
});

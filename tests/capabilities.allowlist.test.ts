import { assertCapabilitiesAllowed, CapabilityKey } from "../src/capabilities.contract";

describe("capabilities allowlist", () => {
  it("does nothing when all required capabilities are allowed", () => {
    expect(() => assertCapabilitiesAllowed(
      [CapabilityKey.AI_PROMPTS_CANARY],
      [CapabilityKey.AI_PROMPTS_CANARY]
    )).not.toThrow();
  });

  it("throws a helpful error when required capabilities are missing", () => {
    expect(() => assertCapabilitiesAllowed(
      [CapabilityKey.AI_PROMPTS_CANARY, CapabilityKey.AI_RUNTIME_CACHE_TTL_CONFIGURABLE],
      [CapabilityKey.AI_PROMPTS_CANARY],
      "runtime mode"
    )).toThrow(/Unsupported capabilities/);

    expect(() => assertCapabilitiesAllowed(
      [CapabilityKey.AI_PROMPTS_CANARY, CapabilityKey.AI_RUNTIME_CACHE_TTL_CONFIGURABLE],
      [CapabilityKey.AI_PROMPTS_CANARY],
      "runtime mode"
    )).toThrow(/AI_RUNTIME_CACHE_TTL_CONFIGURABLE/);
  });
});

import {
  formatDcdrVirtualModelId,
  IntentProvider,
  parseDcdrVirtualModelId,
  ProviderModelRegistry,
} from "../src/provider.contract";

describe("DCDR virtual provider model IDs", () => {
  it("formats provider/model ids for supported providers", () => {
    expect(
      formatDcdrVirtualModelId(IntentProvider.OPEN_AI, "gpt-4o-mini"),
    ).toBe("openai/gpt-4o-mini");
    expect(
      formatDcdrVirtualModelId(IntentProvider.ANTHROPIC, "claude-haiku-4-5"),
    ).toBe("anthropic/claude-haiku-4-5");
    expect(
      formatDcdrVirtualModelId(IntentProvider.GEMINI, "gemini-3.5-flash"),
    ).toBe("gemini/gemini-3.5-flash");
    expect(formatDcdrVirtualModelId(IntentProvider.OFFICE, "Qwen3-4B")).toBe(
      "office/Qwen3-4B",
    );
  });

  it("parses provider/model ids and resolves to real providers", () => {
    expect(parseDcdrVirtualModelId("openai/gpt-4o-mini")).toEqual({
      provider: IntentProvider.OPEN_AI,
      modelId: "gpt-4o-mini",
      prefixedModelId: "openai/gpt-4o-mini",
    });

    expect(
      parseDcdrVirtualModelId("anthropic/claude-haiku-4-5")?.provider,
    ).toBe(IntentProvider.ANTHROPIC);
    expect(parseDcdrVirtualModelId("gemini/gemini-3.5-flash")?.provider).toBe(
      IntentProvider.GEMINI,
    );
    expect(parseDcdrVirtualModelId("office/Qwen3-4B")?.provider).toBe(
      IntentProvider.OFFICE,
    );
  });

  it("returns null for invalid ids", () => {
    expect(parseDcdrVirtualModelId("")).toBeNull();
    expect(parseDcdrVirtualModelId("gpt-4o-mini")).toBeNull();
    expect(parseDcdrVirtualModelId("unknown/gpt-4o-mini")).toBeNull();
    expect(parseDcdrVirtualModelId("openai/")).toBeNull();
  });

  it("DCDR provider catalog uses only namespaced ids", () => {
    const ids = ProviderModelRegistry.listProviderModelIds(IntentProvider.DCDR);
    expect(ids.length).toBeGreaterThan(0);

    for (const id of ids) {
      expect(id).toMatch(/^(openai|anthropic|gemini|office)\/.+/);
      expect(parseDcdrVirtualModelId(id)).not.toBeNull();
    }
  });
});

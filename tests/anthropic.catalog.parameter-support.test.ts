import { IntentProvider } from "../src/provider.contract";
import {
  PromptParameterKey,
  ProviderModelParameterSupportStatus,
  ProviderModelRegistry,
  ProviderModelThinkingControl,
} from "../src/provider.catalog.contract";

describe("Anthropic catalog parameter support", () => {
  it("marks new Claude 5 models as rejecting explicit temperature and top_p", () => {
    for (const modelId of [
      "claude-sonnet-5",
      "claude-fable-5",
      "claude-opus-5-5",
      "claude-sonnet-5-5",
      "claude-haiku-5-5",
    ]) {
      const definition = ProviderModelRegistry.getModelDefinition(
        IntentProvider.ANTHROPIC,
        modelId,
      );

      expect(
        definition?.parameterSupport?.parameters?.[
          PromptParameterKey.TEMPERATURE
        ],
      ).toBe(ProviderModelParameterSupportStatus.NOT_SUPPORTED);
      expect(
        definition?.parameterSupport?.parameters?.[PromptParameterKey.TOP_P],
      ).toBe(ProviderModelParameterSupportStatus.NOT_SUPPORTED);
    }
  });

  it("keeps the thinking-control wire values stable", () => {
    expect(ProviderModelThinkingControl.TOKEN_BUDGET).toBe("TOKEN_BUDGET");
    expect(ProviderModelThinkingControl.EFFORT).toBe("EFFORT");
  });

  it("marks the models that refuse a thinking budget as effort-controlled (measured 2026-10-27)", () => {
    for (const modelId of [
      "claude-fable-5-1",
      "claude-fable-5",
      "claude-opus-5-5",
      "claude-opus-5",
      "claude-opus-4-8",
      "claude-opus-4-7",
      "claude-sonnet-5-5",
      "claude-sonnet-5",
      "claude-haiku-5-5",
    ]) {
      expect(
        ProviderModelRegistry.getModelDefinition(IntentProvider.ANTHROPIC, modelId)
          ?.parameterSupport?.thinkingControl,
      ).toBe(ProviderModelThinkingControl.EFFORT);
    }
  });

  it("marks the closed legacy set that still takes a thinking budget as TOKEN_BUDGET", () => {
    // The Anthropic adapter defaults to EFFORT, so these are the only entries that opt back in.
    const legacy = [
      "claude-opus-4-6",
      "claude-opus-4-5-20251101",
      "claude-sonnet-4-6",
      "claude-sonnet-4-5-20250929",
      "claude-haiku-4-5-20251001",
      "claude-haiku-4-5",
      "claude-opus-4-1-20250805",
    ];
    const budgetModels = ProviderModelRegistry.listProviderModels(IntentProvider.ANTHROPIC)
      .filter(
        (m) => m.parameterSupport?.thinkingControl === ProviderModelThinkingControl.TOKEN_BUDGET,
      )
      .map((m) => m.id)
      .sort();
    expect(budgetModels).toEqual([...legacy].sort());
  });
});

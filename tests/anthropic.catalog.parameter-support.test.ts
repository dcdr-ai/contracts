import {
  IntentProvider,
  PromptParameterKey,
  ProviderModelParameterSupportStatus,
  ProviderModelRegistry,
} from "../src/provider.contract";

describe("Anthropic catalog parameter support", () => {
  it("marks new Claude 5 models as rejecting explicit temperature and top_p", () => {
    for (const modelId of ["claude-sonnet-5", "claude-fable-5"]) {
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
});

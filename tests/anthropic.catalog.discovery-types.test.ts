import { IntentType } from "../src/intent.contract";
import {
  IntentProvider,
  PROVIDER_MODEL_E2E_OVERRIDES,
  ProviderModelE2EStatus,
  ProviderModelRegistry,
} from "../src/provider.contract";

describe("Anthropic discovered catalog entries", () => {
  it("classifies newly discovered anthropic chat models as CHAT", () => {
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.ANTHROPIC,
        "claude-sonnet-5",
        IntentType.CHAT,
      ),
    ).toBe(true);
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.ANTHROPIC,
        "claude-fable-5",
        IntentType.CHAT,
      ),
    ).toBe(true);
  });

  it("marks the removed local haiku alias as LEGACY for provider e2e", () => {
    expect(
      PROVIDER_MODEL_E2E_OVERRIDES[IntentProvider.ANTHROPIC]["claude-haiku-4-5"]
        ?.status,
    ).toBe(ProviderModelE2EStatus.LEGACY);
  });
});

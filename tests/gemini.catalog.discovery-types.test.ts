import { IntentType } from "../src/intent.contract";
import {
  IntentProvider,
  PROVIDER_MODEL_E2E_OVERRIDES,
  ProviderModelE2EStatus,
  ProviderModelRegistry,
} from "../src/provider.contract";

describe("Gemini discovered catalog entries", () => {
  it("classifies newly discovered Gemini models with the intended non-chat families", () => {
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.GEMINI,
        "gemini-3.1-flash-lite-image",
        IntentType.IMAGE_GENERATION,
      ),
    ).toBe(true);
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.GEMINI,
        "gemini-3.5-live-translate-preview",
        IntentType.CHAT,
      ),
    ).toBe(true);
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.GEMINI,
        "gemini-omni-flash-preview",
        IntentType.VIDEO_GENERATION,
      ),
    ).toBe(true);
  });

  it("marks current Gemini endpoint-mismatch preview IDs as LEGACY for provider e2e", () => {
    expect(
      PROVIDER_MODEL_E2E_OVERRIDES[IntentProvider.GEMINI][
        "gemini-3.5-live-translate-preview"
      ]?.status,
    ).toBe(ProviderModelE2EStatus.LEGACY);
    expect(
      PROVIDER_MODEL_E2E_OVERRIDES[IntentProvider.GEMINI][
        "gemini-omni-flash-preview"
      ]?.status,
    ).toBe(ProviderModelE2EStatus.LEGACY);
  });
});

import { IntentType } from "../src/intent.contract";
import { IntentProvider } from "../src/provider.contract";
import {
  PROVIDER_MODEL_E2E_OVERRIDES,
  ProviderModelE2EStatus,
  ProviderModelRegistry,
} from "../src/provider.catalog.contract";

describe("Mistral discovered catalog entries", () => {
  it("classifies newly discovered mistral families with existing intent types", () => {
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.MISTRAL,
        "mistral-embed",
        IntentType.EMBEDDING,
      ),
    ).toBe(true);
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.MISTRAL,
        "codestral-embed",
        IntentType.EMBEDDING,
      ),
    ).toBe(true);
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.MISTRAL,
        "mistral-large-2512",
        IntentType.CHAT,
      ),
    ).toBe(true);
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.MISTRAL,
        "mistral-vibe-cli-with-tools",
        IntentType.CHAT,
      ),
    ).toBe(true);
  });

  it("keeps OCR and moderation families out of the Mistral provider catalog for now", () => {
    expect(
      ProviderModelRegistry.getModelDefinition(
        IntentProvider.MISTRAL,
        "mistral-ocr-latest",
      ),
    ).toBeNull();
    expect(
      ProviderModelRegistry.getModelDefinition(
        IntentProvider.MISTRAL,
        "mistral-moderation-2603",
      ),
    ).toBeNull();
  });

  it("marks current documented legacy mistral aliases as LEGACY for provider e2e", () => {
    expect(
      PROVIDER_MODEL_E2E_OVERRIDES[IntentProvider.MISTRAL]["mistral-medium-2505"]
        ?.status,
    ).toBe(ProviderModelE2EStatus.LEGACY);
    expect(
      PROVIDER_MODEL_E2E_OVERRIDES[IntentProvider.MISTRAL]["mistral-medium-2508"]
        ?.status,
    ).toBe(ProviderModelE2EStatus.LEGACY);
    expect(
      PROVIDER_MODEL_E2E_OVERRIDES[IntentProvider.MISTRAL]["mistral-small-2506"]
        ?.status,
    ).toBe(ProviderModelE2EStatus.LEGACY);
  });
});

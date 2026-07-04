import { IntentType } from "../src/intent.contract";
import { IntentProvider, ProviderModelRegistry } from "../src/provider.contract";

describe("Grok non-chat catalog entries", () => {
  it("classifies newly discovered xAI imagine models as image/video generation instead of chat", () => {
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.GROK,
        "grok-imagine-image",
        IntentType.IMAGE_GENERATION,
      ),
    ).toBe(true);
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.GROK,
        "grok-imagine-image-quality",
        IntentType.IMAGE_GENERATION,
      ),
    ).toBe(true);
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.GROK,
        "grok-imagine-video",
        IntentType.VIDEO_GENERATION,
      ),
    ).toBe(true);
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.GROK,
        "grok-imagine-video-1.5",
        IntentType.VIDEO_GENERATION,
      ),
    ).toBe(true);

    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.GROK,
        "grok-imagine-image",
        IntentType.CHAT,
      ),
    ).toBe(false);
    expect(
      ProviderModelRegistry.modelSupportsType(
        IntentProvider.GROK,
        "grok-imagine-video",
        IntentType.CHAT,
      ),
    ).toBe(false);
  });
});

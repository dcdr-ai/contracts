import { IntentType } from "../src/intent.contract";
import { IntentProvider } from "../src/provider.contract";
import {
  PROVIDER_MODEL_E2E_OVERRIDES,
  ProviderModelE2EStatus,
  ProviderModelRegistry,
  ProviderModelRuntimeSupportStatus,
} from "../src/provider.catalog.contract";

/**
 * Regression coverage for the 2026-09-05 Gemini catalog + pricing snapshot.
 *
 * Source of truth: https://ai.google.dev/gemini-api/docs/pricing (standard rates).
 */
interface GeminiPricingExpectation {
  modelId: string;
  input: number;
  output: number;
}

const GEMINI_PRICING_EXPECTATIONS: GeminiPricingExpectation[] = [
  // Promotional standard rate published through 2026-12-31.
  { modelId: "gemini-3.8-flash", input: 0.75, output: 3.75 },
  { modelId: "gemini-3.7-flash", input: 0.75, output: 3.75 },
  { modelId: "gemini-3.6-flash", input: 0.75, output: 3.75 },
  { modelId: "gemini-3.5-flash-lite", input: 0.3, output: 2.5 },
  { modelId: "gemini-omni-1.1-flash", input: 1.5, output: 9.0 },
  { modelId: "gemini-robotics-er-2-preview", input: 2.0, output: 10.0 },
  { modelId: "gemini-robotics-er-2-streaming-preview", input: 2.0, output: 10.0 },
  // Image-generation families: text-side rates only.
  { modelId: "gemini-3.1-flash-image", input: 0.5, output: 3.0 },
  { modelId: "gemini-3.1-flash-lite-image", input: 0.25, output: 1.5 },
  { modelId: "gemini-3-pro-image", input: 2.0, output: 12.0 },
];

/** Model IDs discovered on the 2026-09-05 sync. */
const GEMINI_NEW_MODEL_IDS_20260905 = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-omni-1.1-flash",
  "gemini-3.5-transcribe",
  "gemini-3.5-transcribe-live",
  "gemini-robotics-er-2-preview",
  "gemini-robotics-er-2-streaming-preview",
];

/** Newly discovered models that provider E2E proved reachable through the CHAT adapter. */
const GEMINI_NEWLY_SUPPORTED = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-robotics-er-2-preview",
];

/** Newly discovered models that require an API surface the runtime does not implement. */
const GEMINI_NEWLY_NOT_SUPPORTED = [
  "gemini-omni-1.1-flash",
  "gemini-3.5-transcribe",
  "gemini-3.5-transcribe-live",
  "gemini-robotics-er-2-streaming-preview",
];

describe("Gemini catalog pricing snapshot (2026-09-05)", () => {
  it("covers every model ID discovered on the 2026-09-05 sync", () => {
    const catalogIds = ProviderModelRegistry.listProviderModelIds(
      IntentProvider.GEMINI,
    );

    for (const id of GEMINI_NEW_MODEL_IDS_20260905) {
      expect(catalogIds).toContain(id);
    }
  });

  it("stores the published standard per-MTok prices", () => {
    for (const expected of GEMINI_PRICING_EXPECTATIONS) {
      const tokens = ProviderModelRegistry.getTokenPricing(
        IntentProvider.GEMINI,
        expected.modelId,
      );

      expect(tokens).not.toBeNull();
      expect(tokens?.unit).toBe("per_million_tokens");
      expect(tokens?.input).toBe(expected.input);
      expect(tokens?.outputUsd).toBe(expected.output);
    }
  });

  it("keeps gemini-3.1-flash-lite-image off the gemini-2.5-flash-image batch rates", () => {
    const tokens = ProviderModelRegistry.getTokenPricing(
      IntentProvider.GEMINI,
      "gemini-3.1-flash-lite-image",
    );

    // Regression guard: the catalog previously carried 0.15 / 0.0195, which are the
    // gemini-2.5-flash-image *batch* rates, not this model's published standard rates.
    expect(tokens?.input).not.toBe(0.15);
    expect(tokens?.outputUsd).not.toBe(0.0195);
  });

  it("records the 2026-09-05 provider E2E outcome for the newly discovered models", () => {
    for (const modelId of GEMINI_NEWLY_SUPPORTED) {
      const def = ProviderModelRegistry.getModelDefinition(
        IntentProvider.GEMINI,
        modelId,
      );

      expect(def?.types).toEqual([IntentType.CHAT]);
      expect(def?.runtimeSupport?.status).toBe(
        ProviderModelRuntimeSupportStatus.SUPPORTED,
      );
      expect(def?.tokenUsageCovered).toBe(true);
      expect(def?.publicForCustomers).toBe(false);
    }

    for (const modelId of GEMINI_NEWLY_NOT_SUPPORTED) {
      const def = ProviderModelRegistry.getModelDefinition(
        IntentProvider.GEMINI,
        modelId,
      );

      // These need an API surface the runtime CHAT adapter does not implement
      // (Interactions API, or WebSocket bidiGenerateContent).
      expect(def?.runtimeSupport?.status).toBe(
        ProviderModelRuntimeSupportStatus.NOT_SUPPORTED,
      );
      expect(def?.tokenUsageCovered).toBeUndefined();
    }
  });

  it("skips de-listed model IDs through LEGACY overrides without demoting them", () => {
    const overrides = PROVIDER_MODEL_E2E_OVERRIDES[IntentProvider.GEMINI] ?? {};

    for (const modelId of [
      "gemini-robotics-er-1.6-preview",
      "gemini-robotics-er-1.5-preview",
      "gemini-3-pro-preview",
      "gemini-2.0-flash",
    ]) {
      expect(overrides[modelId]?.status).toBe(ProviderModelE2EStatus.LEGACY);
      expect(
        ProviderModelRegistry.getModelDefinition(IntentProvider.GEMINI, modelId),
      ).not.toBeNull();
    }
  });
});

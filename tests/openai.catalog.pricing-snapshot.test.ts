import { IntentType } from "../src/intent.contract";
import { IntentProvider } from "../src/provider.contract";
import {
  PROVIDER_MODEL_E2E_OVERRIDES,
  ProviderModelE2EStatus,
  ProviderModelRegistry,
  ProviderModelRuntimeSupportStatus,
} from "../src/provider.catalog.contract";

/**
 * Regression coverage for the 2026-09-05 OpenAI catalog + pricing snapshot.
 *
 * Source of truth: https://developers.openai.com/api/docs/pricing?latest-pricing=standard
 * (standard tier: Input / Cached input / Output).
 */
interface OpenAIPricingExpectation {
  modelId: string;
  input: number;
  cachedInput?: number;
  output: number;
}

/** Newly discovered flagship models, priced verbatim from the official table. */
const OPENAI_NEW_PRICING_EXPECTATIONS: OpenAIPricingExpectation[] = [
  { modelId: "gpt-6-astra", input: 10.0, cachedInput: 1.0, output: 50.0 },
  { modelId: "gpt-5.6-sol", input: 4.0, cachedInput: 0.4, output: 20.0 },
  { modelId: "gpt-5.6-terra", input: 2.0, cachedInput: 0.2, output: 12.0 },
  { modelId: "gpt-5.6-luna", input: 0.2, cachedInput: 0.02, output: 1.2 },
];

/** A spot-check slice of the pre-existing catalog, re-verified on 2026-09-05. */
const OPENAI_REVERIFIED_EXPECTATIONS: OpenAIPricingExpectation[] = [
  { modelId: "gpt-5.5", input: 5.0, cachedInput: 0.5, output: 30.0 },
  { modelId: "gpt-5.1", input: 1.25, cachedInput: 0.125, output: 10.0 },
  { modelId: "gpt-5-nano", input: 0.05, cachedInput: 0.005, output: 0.4 },
  { modelId: "gpt-4o", input: 2.5, cachedInput: 1.25, output: 10.0 },
  { modelId: "o3", input: 2.0, cachedInput: 0.5, output: 8.0 },
];

/** Model IDs discovered on the 2026-09-05 sync. */
const OPENAI_NEW_MODEL_IDS_20260905 = [
  "gpt-6-astra",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-realtime-2.1",
  "gpt-realtime-2.1-mini",
  "gpt-live-transcribe",
  "gpt-transcribe",
  "chatgpt-image-latest",
  "omni-moderation-latest",
  "omni-moderation-2024-09-26",
  "gpt-3.5-turbo-instruct",
  "gpt-3.5-turbo-instruct-0914",
  "tts-1-1106",
  "tts-1-hd-1106",
];

const OPENAI_NEWLY_CURATED_CHAT = [
  "gpt-6-astra",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
];

describe("OpenAI catalog pricing snapshot (2026-09-05)", () => {
  it("covers every model ID discovered on the 2026-09-05 sync", () => {
    const catalogIds = ProviderModelRegistry.listProviderModelIds(
      IntentProvider.OPEN_AI,
    );

    for (const id of OPENAI_NEW_MODEL_IDS_20260905) {
      expect(catalogIds).toContain(id);
    }
  });

  it("stores the published standard prices for the newly added flagship models", () => {
    for (const expected of OPENAI_NEW_PRICING_EXPECTATIONS) {
      const tokens = ProviderModelRegistry.getTokenPricing(
        IntentProvider.OPEN_AI,
        expected.modelId,
      );

      expect(tokens).not.toBeNull();
      expect(tokens?.unit).toBe("per_million_tokens");
      expect(tokens?.input).toBe(expected.input);
      expect(tokens?.cachedInput).toBe(expected.cachedInput);
      expect(tokens?.outputUsd).toBe(expected.output);
    }
  });

  it("keeps the re-verified pre-existing prices unchanged", () => {
    for (const expected of OPENAI_REVERIFIED_EXPECTATIONS) {
      const tokens = ProviderModelRegistry.getTokenPricing(
        IntentProvider.OPEN_AI,
        expected.modelId,
      );

      expect(tokens?.input).toBe(expected.input);
      expect(tokens?.cachedInput).toBe(expected.cachedInput);
      expect(tokens?.outputUsd).toBe(expected.output);
    }
  });

  it("records the 2026-09-05 provider E2E outcome for the new flagship models", () => {
    for (const modelId of OPENAI_NEWLY_CURATED_CHAT) {
      const def = ProviderModelRegistry.getModelDefinition(
        IntentProvider.OPEN_AI,
        modelId,
      );

      expect(def?.types).toEqual([IntentType.CHAT]);
      expect(def?.runtimeSupport?.status).toBe(
        ProviderModelRuntimeSupportStatus.SUPPORTED,
      );
      expect(def?.tokenUsageCovered).toBe(true);
    }

    // gpt-5.6-sol / -terra / -luna became the managed public OpenAI set once they
    // carried a comprehension-grade multimodal rectangle; gpt-6-astra stays internal.
    for (const modelId of ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]) {
      expect(
        ProviderModelRegistry.getModelDefinition(IntentProvider.OPEN_AI, modelId)
          ?.publicForCustomers,
      ).toBe(true);
    }
    expect(
      ProviderModelRegistry.getModelDefinition(
        IntentProvider.OPEN_AI,
        "gpt-6-astra",
      )?.publicForCustomers,
    ).toBe(false);
  });

  it("never publishes an AUDIO or VIDEO rectangle without comprehension evidence", () => {
    // RM-050: the previous transport-only curator accepted sawProvidedInput=true as
    // proof of support. Every model re-measured with the comprehension-grade curator
    // failed AUDIO and VIDEO, so no OpenAI entry may claim them as SUPPORTED.
    const offenders = ProviderModelRegistry.listProviderModels(
      IntentProvider.OPEN_AI,
    )
      .filter((m) => {
        const inputParts = m.runtimeSupport?.inputParts;
        if (!inputParts) return false;
        if (
          inputParts.status !== ProviderModelRuntimeSupportStatus.SUPPORTED
        ) {
          return false;
        }
        const types = (inputParts.supportedAssetTypes ?? []).map(String);
        return types.includes("audio") || types.includes("video");
      })
      .map((m) => m.id);

    expect(offenders).toEqual([]);
  });

  it("keeps every SUPPORTED OpenAI chat model covered for token usage", () => {
    // Billing invariant: a SUPPORTED model without verified usage reporting must never
    // become customer-public, so the whole supported set has to stay covered.
    const uncovered = ProviderModelRegistry.listProviderModels(
      IntentProvider.OPEN_AI,
    )
      .filter(
        (m) =>
          m.runtimeSupport?.status ===
            ProviderModelRuntimeSupportStatus.SUPPORTED &&
          m.types.includes(IntentType.CHAT) &&
          m.tokenUsageCovered !== true,
      )
      .map((m) => m.id);

    expect(uncovered).toEqual([]);
  });

  it("skips de-listed model IDs through LEGACY overrides without demoting them", () => {
    const overrides = PROVIDER_MODEL_E2E_OVERRIDES[IntentProvider.OPEN_AI] ?? {};

    for (const modelId of [
      "dall-e-3",
      "dall-e-2",
      "gpt-realtime-mini-2025-10-06",
      "o1-mini",
    ]) {
      expect(overrides[modelId]?.status).toBe(ProviderModelE2EStatus.LEGACY);
      expect(
        ProviderModelRegistry.getModelDefinition(IntentProvider.OPEN_AI, modelId),
      ).not.toBeNull();
    }
  });
});

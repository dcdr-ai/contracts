import { AssetType } from "../src/asset.contract";
import { ExecutionPartSourceKind } from "../src/execution.contract";
import { IntentType } from "../src/intent.contract";
import { IntentProvider } from "../src/provider.contract";
import {
  ProviderModelRegistry,
  ProviderModelRuntimeSupportStatus,
} from "../src/provider.catalog.contract";

/**
 * Regression coverage for the 2026-09-05 xAI catalog + pricing snapshot.
 *
 * Source of truth: https://docs.x.ai/developers/pricing (Text API models table,
 * `< 200k` column as the base tokens component and `>= 200k` as the `long_context` tier).
 */
const XAI_LONG_CONTEXT_TIER_NAME = "long_context";

interface GrokTextPricingExpectation {
  modelId: string;
  input: number;
  cachedInput: number;
  output: number;
  longContextInput: number;
  longContextCachedInput: number;
  longContextOutput: number;
}

const GROK_TEXT_PRICING_EXPECTATIONS: GrokTextPricingExpectation[] = [
  {
    modelId: "grok-4.6",
    input: 2.0,
    cachedInput: 0.5,
    output: 6.0,
    longContextInput: 4.0,
    longContextCachedInput: 1.0,
    longContextOutput: 12.0,
  },
  {
    modelId: "grok-4.5",
    input: 2.0,
    cachedInput: 0.3,
    output: 6.0,
    longContextInput: 4.0,
    longContextCachedInput: 0.6,
    longContextOutput: 12.0,
  },
  {
    modelId: "grok-4.3",
    input: 1.25,
    cachedInput: 0.2,
    output: 2.5,
    longContextInput: 2.5,
    longContextCachedInput: 0.4,
    longContextOutput: 5.0,
  },
  {
    modelId: "grok-4.20-0309-non-reasoning",
    input: 1.25,
    cachedInput: 0.2,
    output: 2.5,
    longContextInput: 2.5,
    longContextCachedInput: 0.4,
    longContextOutput: 5.0,
  },
  {
    modelId: "grok-4.20-0309-reasoning",
    input: 1.25,
    cachedInput: 0.2,
    output: 2.5,
    longContextInput: 2.5,
    longContextCachedInput: 0.4,
    longContextOutput: 5.0,
  },
  {
    modelId: "grok-4.20-multi-agent-0309",
    input: 1.25,
    cachedInput: 0.2,
    output: 2.5,
    longContextInput: 2.5,
    longContextCachedInput: 0.4,
    longContextOutput: 5.0,
  },
  {
    modelId: "grok-build-0.1",
    input: 1.0,
    cachedInput: 0.2,
    output: 2.0,
    longContextInput: 2.0,
    longContextCachedInput: 0.4,
    longContextOutput: 4.0,
  },
];

/** Model IDs returned by `GET https://api.x.ai/v1/models` on the 2026-09-05 sync. */
const XAI_VISIBLE_MODEL_IDS_20260905 = [
  "grok-4.20-0309-non-reasoning",
  "grok-4.20-0309-reasoning",
  "grok-4.20-multi-agent-0309",
  "grok-4.3",
  "grok-4.5",
  "grok-4.6",
  "grok-build-0.1",
  "grok-imagine-image",
  "grok-imagine-image-2.0",
  "grok-imagine-image-quality",
  "grok-imagine-video",
  "grok-imagine-video-1.5",
];

/** Generation models xAI prices per image/second, a unit the pricing components cannot express yet. */
const GROK_UNPRICED_GENERATION_MODEL_IDS = [
  "grok-imagine-image",
  "grok-imagine-image-2.0",
  "grok-imagine-image-quality",
  "grok-imagine-video",
  "grok-imagine-video-1.5",
];

describe("Grok catalog pricing snapshot (2026-09-05)", () => {
  it("covers every model ID visible on the xAI models endpoint", () => {
    const catalogIds = ProviderModelRegistry.listProviderModelIds(
      IntentProvider.GROK,
    );

    for (const id of XAI_VISIBLE_MODEL_IDS_20260905) {
      expect(catalogIds).toContain(id);
    }
  });

  it("stores the published base and long-context token prices for each text model", () => {
    for (const expected of GROK_TEXT_PRICING_EXPECTATIONS) {
      const tokens = ProviderModelRegistry.getTokenPricing(
        IntentProvider.GROK,
        expected.modelId,
      );

      expect(tokens).not.toBeNull();
      expect(tokens?.unit).toBe("per_million_tokens");
      expect(tokens?.input).toBe(expected.input);
      expect(tokens?.cachedInput).toBe(expected.cachedInput);
      expect(tokens?.outputUsd).toBe(expected.output);

      const longContext = (tokens?.tiers ?? []).find(
        (tier) => tier.name === XAI_LONG_CONTEXT_TIER_NAME,
      );

      expect(longContext).toBeDefined();
      expect(longContext?.input).toBe(expected.longContextInput);
      expect(longContext?.cachedInput).toBe(expected.longContextCachedInput);
      expect(longContext?.output).toBe(expected.longContextOutput);
    }
  });

  it("marks every priced Grok text model with the official xAI pricing source", () => {
    for (const expected of GROK_TEXT_PRICING_EXPECTATIONS) {
      const pricing = ProviderModelRegistry.getModelPricing(
        IntentProvider.GROK,
        expected.modelId,
      );

      expect(pricing?.currency).toBe("USD");
      expect(pricing?.confidence).toBe("official");
      expect(pricing?.sourceUrl).toBe("https://docs.x.ai/developers/pricing");
    }
  });

  it("records the 2026-09-05 provider E2E outcome for the newly curated chat models", () => {
    for (const modelId of ["grok-4.6", "grok-4.5"]) {
      const def = ProviderModelRegistry.getModelDefinition(
        IntentProvider.GROK,
        modelId,
      );

      expect(def).not.toBeNull();
      expect(def?.types).toEqual([IntentType.CHAT]);
      expect(def?.runtimeSupport?.status).toBe(
        ProviderModelRuntimeSupportStatus.SUPPORTED,
      );
      expect(def?.tokenUsageCovered).toBe(true);
      // Curated but not promoted to the managed public set: that is a separate product decision.
      expect(def?.publicForCustomers).toBe(false);
    }
  });

  it("publishes only the multimodal rectangle that actually passed comprehension curation", () => {
    for (const modelId of ["grok-4.6", "grok-4.5"]) {
      const inputParts = ProviderModelRegistry.getModelDefinition(
        IntentProvider.GROK,
        modelId,
      )?.runtimeSupport?.inputParts;

      expect(inputParts?.status).toBe(
        ProviderModelRuntimeSupportStatus.SUPPORTED,
      );
      expect(inputParts?.supportedAssetTypes).toEqual([
        AssetType.IMAGE,
        AssetType.DOCUMENT,
      ]);
      expect(inputParts?.supportedSourceKinds).toEqual([
        ExecutionPartSourceKind.INLINE,
        ExecutionPartSourceKind.URL,
        ExecutionPartSourceKind.ASSET,
      ]);

      // AUDIO/VIDEO failed the canonical cues and TEXT failed at least one source kind,
      // so neither may appear in the published rectangle.
      expect(inputParts?.supportedAssetTypes).not.toContain(AssetType.TEXT);
      expect(inputParts?.supportedAssetTypes).not.toContain(AssetType.AUDIO);
      expect(inputParts?.supportedAssetTypes).not.toContain(AssetType.VIDEO);
    }
  });

  it("does not declare a preferredApi that Grok routing would ignore (RM-047)", () => {
    for (const modelId of ["grok-4.6", "grok-4.5"]) {
      expect(
        ProviderModelRegistry.getModelDefinition(IntentProvider.GROK, modelId)
          ?.runtimeSupport?.preferredApi,
      ).toBeUndefined();
    }
  });

  it("classifies grok-imagine-image-2.0 as image generation and leaves it uncurated", () => {
    const def = ProviderModelRegistry.getModelDefinition(
      IntentProvider.GROK,
      "grok-imagine-image-2.0",
    );

    expect(def?.types).toEqual([IntentType.IMAGE_GENERATION]);
    expect(def?.runtimeSupport?.status).toBe(
      ProviderModelRuntimeSupportStatus.IN_PROGRESS,
    );
    expect(def?.publicForCustomers).toBe(false);
  });

  it("does not invent token pricing for per-image/per-second generation models", () => {
    for (const modelId of GROK_UNPRICED_GENERATION_MODEL_IDS) {
      expect(
        ProviderModelRegistry.getModelPricing(IntentProvider.GROK, modelId),
      ).toBeNull();
    }
  });
});

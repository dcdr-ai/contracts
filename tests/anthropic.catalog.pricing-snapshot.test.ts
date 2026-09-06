import { AssetType } from "../src/asset.contract";
import { ExecutionPartSourceKind } from "../src/execution.contract";
import { IntentType } from "../src/intent.contract";
import { IntentProvider } from "../src/provider.contract";
import {
  PROVIDER_MODEL_E2E_OVERRIDES,
  ProviderModelE2EStatus,
  ProviderModelRegistry,
  ProviderModelRuntimeSupportStatus,
} from "../src/provider.catalog.contract";

/**
 * Regression coverage for the 2026-09-05 Anthropic catalog + pricing snapshot.
 *
 * Source of truth: https://platform.claude.com/docs/en/about-claude/pricing
 * ("Base input tokens" -> `input`, "Cache hits and refreshes" -> `cachedInput`,
 * "Output tokens" -> `outputUsd`). Cache *write* rates are deliberately not stored:
 * the pricing components have no field for them.
 */
interface AnthropicPricingExpectation {
  modelId: string;
  input: number;
  cachedInput: number;
  output: number;
}

const ANTHROPIC_PRICING_EXPECTATIONS: AnthropicPricingExpectation[] = [
  { modelId: "claude-fable-5-1", input: 10.0, cachedInput: 0.25, output: 50.0 },
  { modelId: "claude-fable-5", input: 10.0, cachedInput: 1.0, output: 50.0 },
  { modelId: "claude-opus-5", input: 5.0, cachedInput: 0.5, output: 25.0 },
  { modelId: "claude-opus-4-8", input: 5.0, cachedInput: 0.5, output: 25.0 },
  { modelId: "claude-opus-4-7", input: 5.0, cachedInput: 0.5, output: 25.0 },
  { modelId: "claude-opus-4-6", input: 5.0, cachedInput: 0.5, output: 25.0 },
  {
    modelId: "claude-opus-4-5-20251101",
    input: 5.0,
    cachedInput: 0.5,
    output: 25.0,
  },
  {
    modelId: "claude-opus-4-1-20250805",
    input: 15.0,
    cachedInput: 1.5,
    output: 75.0,
  },
  { modelId: "claude-sonnet-5", input: 2.0, cachedInput: 0.2, output: 10.0 },
  { modelId: "claude-sonnet-4-6", input: 3.0, cachedInput: 0.3, output: 15.0 },
  {
    modelId: "claude-sonnet-4-5-20250929",
    input: 3.0,
    cachedInput: 0.3,
    output: 15.0,
  },
  { modelId: "claude-haiku-4-5", input: 1.0, cachedInput: 0.1, output: 5.0 },
  {
    modelId: "claude-haiku-4-5-20251001",
    input: 1.0,
    cachedInput: 0.1,
    output: 5.0,
  },
];

/** Model IDs returned by `GET https://api.anthropic.com/v1/models` on the 2026-09-05 sync. */
const ANTHROPIC_VISIBLE_MODEL_IDS_20260905 = [
  "claude-fable-5",
  "claude-fable-5-1",
  "claude-haiku-4-5-20251001",
  "claude-opus-4-5-20251101",
  "claude-opus-4-6",
  "claude-opus-4-7",
  "claude-opus-4-8",
  "claude-opus-5",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-6",
  "claude-sonnet-5",
];

describe("Anthropic catalog pricing snapshot (2026-09-05)", () => {
  it("covers every model ID visible on the Anthropic models endpoint", () => {
    const catalogIds = ProviderModelRegistry.listProviderModelIds(
      IntentProvider.ANTHROPIC,
    );

    for (const id of ANTHROPIC_VISIBLE_MODEL_IDS_20260905) {
      expect(catalogIds).toContain(id);
    }
  });

  it("stores the published base, cache-read, and output prices for every model", () => {
    for (const expected of ANTHROPIC_PRICING_EXPECTATIONS) {
      const tokens = ProviderModelRegistry.getTokenPricing(
        IntentProvider.ANTHROPIC,
        expected.modelId,
      );

      expect(tokens).not.toBeNull();
      expect(tokens?.unit).toBe("per_million_tokens");
      expect(tokens?.input).toBe(expected.input);
      expect(tokens?.cachedInput).toBe(expected.cachedInput);
      expect(tokens?.outputUsd).toBe(expected.output);
    }
  });

  it("does not carry the cancelled Sonnet 5 price increase as a pricing tier", () => {
    const tokens = ProviderModelRegistry.getTokenPricing(
      IntentProvider.ANTHROPIC,
      "claude-sonnet-5",
    );

    // Anthropic cancelled the 2026-09-01 increase to 3.00/15.00; 2.00/10.00 is standard.
    expect(tokens?.tiers ?? []).toEqual([]);
  });

  it("keeps token usage coverage complete across the curated Anthropic set", () => {
    for (const def of ProviderModelRegistry.listProviderModels(
      IntentProvider.ANTHROPIC,
    )) {
      expect(def.tokenUsageCovered).toBe(true);
    }
  });

  it("records the 2026-09-05 provider E2E outcome for the newly curated chat models", () => {
    for (const modelId of ["claude-opus-5", "claude-fable-5-1"]) {
      const def = ProviderModelRegistry.getModelDefinition(
        IntentProvider.ANTHROPIC,
        modelId,
      );

      expect(def).not.toBeNull();
      expect(def?.types).toEqual([IntentType.CHAT]);
      expect(def?.runtimeSupport?.status).toBe(
        ProviderModelRuntimeSupportStatus.SUPPORTED,
      );
      expect(def?.tokenUsageCovered).toBe(true);
    }

    // claude-opus-4-8 holds the Anthropic BEST slot: it is the newest Opus whose
    // multimodal rectangle still reproduces (see the claude-opus-5 case below).
    expect(
      ProviderModelRegistry.getModelDefinition(
        IntentProvider.ANTHROPIC,
        "claude-opus-4-8",
      )?.publicForCustomers,
    ).toBe(true);

    for (const modelId of ["claude-opus-5", "claude-fable-5-1"]) {
      expect(
        ProviderModelRegistry.getModelDefinition(IntentProvider.ANTHROPIC, modelId)
          ?.publicForCustomers,
      ).toBe(false);
    }
  });

  it("keeps the claude-opus-5 multimodal rectangle marked untrusted", () => {
    // Regression guard. The rectangle passed 3/3 on 2026-09-04 and then stopped
    // reproducing on 2026-09-05: every multimodal structured call returned
    // PROVIDER_EMPTY_RESPONSE across INLINE/URL/ASSET at both 1024 and 4096 tokens,
    // reproduced with the pre-refactor curator restored from git. Until the cause is
    // understood the claim must not be presented as established, and the model must
    // not be customer-public while advertising it.
    const def = ProviderModelRegistry.getModelDefinition(
      IntentProvider.ANTHROPIC,
      "claude-opus-5",
    );

    expect(def?.runtimeSupport?.inputParts?.status).toBe(
      ProviderModelRuntimeSupportStatus.IN_PROGRESS,
    );
    expect(def?.publicForCustomers).toBe(false);
    // Plain CHAT and usage reporting still work, so the model itself stays SUPPORTED.
    expect(def?.runtimeSupport?.status).toBe(
      ProviderModelRuntimeSupportStatus.SUPPORTED,
    );
    expect(def?.tokenUsageCovered).toBe(true);
  });

  it("publishes only the multimodal rectangles that passed comprehension curation", () => {
    const opus48 = ProviderModelRegistry.getModelDefinition(
      IntentProvider.ANTHROPIC,
      "claude-opus-4-8",
    )?.runtimeSupport?.inputParts;

    expect(opus48?.supportedAssetTypes).toEqual([
      AssetType.TEXT,
      AssetType.IMAGE,
      AssetType.DOCUMENT,
    ]);

    const fable51 = ProviderModelRegistry.getModelDefinition(
      IntentProvider.ANTHROPIC,
      "claude-fable-5-1",
    )?.runtimeSupport?.inputParts;

    // TEXT failed comprehension on all three source kinds for Fable 5.1.
    expect(fable51?.supportedAssetTypes).toEqual([
      AssetType.IMAGE,
      AssetType.DOCUMENT,
    ]);

    for (const inputParts of [opus48, fable51]) {
      expect(inputParts?.status).toBe(
        ProviderModelRuntimeSupportStatus.SUPPORTED,
      );
      expect(inputParts?.supportedSourceKinds).toEqual([
        ExecutionPartSourceKind.INLINE,
        ExecutionPartSourceKind.URL,
        ExecutionPartSourceKind.ASSET,
      ]);
      // AUDIO/VIDEO are rejected by the Anthropic Messages path before comprehension.
      expect(inputParts?.supportedAssetTypes).not.toContain(AssetType.AUDIO);
      expect(inputParts?.supportedAssetTypes).not.toContain(AssetType.VIDEO);
    }
  });

  it("keeps de-listed model IDs curated and skips them through the LEGACY E2E override", () => {
    // Disappearing from the vendor /v1/models listing is E2E scope, not runtime-support
    // scope: the last observed curation stands and the model is skipped via an override.
    // Same treatment as the local-only `claude-haiku-4-5` alias.
    for (const modelId of ["claude-opus-4-1-20250805", "claude-haiku-4-5"]) {
      const def = ProviderModelRegistry.getModelDefinition(
        IntentProvider.ANTHROPIC,
        modelId,
      );

      expect(def?.runtimeSupport?.status).toBe(
        ProviderModelRuntimeSupportStatus.SUPPORTED,
      );

      expect(
        PROVIDER_MODEL_E2E_OVERRIDES[IntentProvider.ANTHROPIC]?.[modelId]
          ?.status,
      ).toBe(ProviderModelE2EStatus.LEGACY);
    }
  });
});

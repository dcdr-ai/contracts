import { IntentProvider } from "../src/provider.contract";
import {
  PROVIDER_MODEL_E2E_OVERRIDES,
  ProviderModelE2EStatus,
  ProviderModelRegistry,
} from "../src/provider.catalog.contract";

/**
 * Regression coverage for the 2026-09-05 Mistral catalog + pricing snapshot.
 *
 * Source of truth: https://mistral.ai/pricing/api
 *
 * Mistral publishes marketing names ("Mistral Small 4"), not API model IDs, so pricing is
 * attached only where a name maps unambiguously to a single `*-latest` catalog entry.
 * Dated aliases are deliberately left unpriced rather than inferred from a base model.
 */
interface MistralPricingExpectation {
  modelId: string;
  input: number;
  output: number;
}

const MISTRAL_PRICING_EXPECTATIONS: MistralPricingExpectation[] = [
  { modelId: "mistral-large-latest", input: 0.5, output: 1.5 },
  { modelId: "mistral-medium-latest", input: 1.5, output: 7.5 },
  // Mistral Small 4: corrected from the superseded 0.10/0.30 rate.
  { modelId: "mistral-small-latest", input: 0.15, output: 0.6 },
  { modelId: "ministral-14b-latest", input: 0.2, output: 0.2 },
  { modelId: "ministral-8b-latest", input: 0.15, output: 0.15 },
  { modelId: "ministral-3b-latest", input: 0.1, output: 0.1 },
  { modelId: "codestral-latest", input: 0.3, output: 0.9 },
];

/** Catalog IDs Mistral no longer returns from `/v1/models` (2026-09-05 sync). */
const MISTRAL_DELISTED_MODEL_IDS = [
  "mistral-large-latest",
  "mistral-large-2512",
  "mistral-tiny-latest",
  "mistral-tiny-2407",
  "mistral-code-agent-latest",
];

/**
 * Dated aliases whose price the pricing page does not state against the exact ID.
 * Since RM-049 these inherit from their `*-latest` base through a pricing fallback rule,
 * which marks the result `approx`; see `mistral.catalog.pricing-inheritance.test.ts`.
 */
const MISTRAL_INTENTIONALLY_UNPRICED_ALIASES = [
  "mistral-medium-2604",
  "mistral-medium-3",
  "mistral-medium-3-5",
  "mistral-medium-3.5",
  "mistral-small-2603",
];

describe("Mistral catalog pricing snapshot (2026-09-05)", () => {
  it("stores the published per-MTok prices for the unambiguously mapped models", () => {
    for (const expected of MISTRAL_PRICING_EXPECTATIONS) {
      const tokens = ProviderModelRegistry.getTokenPricing(
        IntentProvider.MISTRAL,
        expected.modelId,
      );

      expect(tokens).not.toBeNull();
      expect(tokens?.unit).toBe("per_million_tokens");
      expect(tokens?.input).toBe(expected.input);
      expect(tokens?.outputUsd).toBe(expected.output);
    }
  });

  it("keeps mistral-small-latest on the current Mistral Small 4 rate", () => {
    const tokens = ProviderModelRegistry.getTokenPricing(
      IntentProvider.MISTRAL,
      "mistral-small-latest",
    );

    // Regression guard: the catalog previously carried the superseded 0.10/0.30 rate,
    // understating this model's cost by 50-100%.
    expect(tokens?.input).not.toBe(0.1);
    expect(tokens?.outputUsd).not.toBe(0.3);
    expect(tokens?.input).toBe(0.15);
    expect(tokens?.outputUsd).toBe(0.6);
  });

  it("never presents a dated alias's price as page-verified", () => {
    // RM-049 changed the policy from "leave aliases unpriced" to "inherit through
    // ProviderPricingFallbackRule". The guard that matters is unchanged: a price the
    // pricing page does not state for that exact id must never be marked `official`.
    for (const modelId of MISTRAL_INTENTIONALLY_UNPRICED_ALIASES) {
      const pricing = ProviderModelRegistry.getModelPricing(
        IntentProvider.MISTRAL,
        modelId,
      );

      if (pricing === null) continue;
      expect(pricing.confidence).toBe("approx");
    }
  });

  it("skips de-listed model IDs through LEGACY overrides without demoting them", () => {
    for (const modelId of MISTRAL_DELISTED_MODEL_IDS) {
      expect(
        PROVIDER_MODEL_E2E_OVERRIDES[IntentProvider.MISTRAL]?.[modelId]?.status,
      ).toBe(ProviderModelE2EStatus.LEGACY);

      // The entry must survive: removing a model ID breaks existing registries.
      expect(
        ProviderModelRegistry.getModelDefinition(IntentProvider.MISTRAL, modelId),
      ).not.toBeNull();
    }
  });
});

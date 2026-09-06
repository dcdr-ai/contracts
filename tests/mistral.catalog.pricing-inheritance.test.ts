import { IntentProvider } from "../src/provider.contract";
import { ProviderModelRegistry } from "../src/provider.catalog.contract";

/**
 * Pricing inheritance for Mistral's dated and generation aliases (RM-049).
 *
 * Mistral publishes marketing names on its pricing page, never API model ids, so only the
 * `*-latest` entries can carry a page-verified price. Aliases inherit through
 * `ProviderPricingFallbackRule`, which marks the result `confidence: "approx"` and records
 * the source model — so a derived number is never indistinguishable from a published one.
 */
interface InheritanceExpectation {
  aliasId: string;
  baseId: string;
  input: number;
  output: number;
}

const INHERITED: InheritanceExpectation[] = [
  { aliasId: "mistral-medium-2604", baseId: "mistral-medium-latest", input: 1.5, output: 7.5 },
  { aliasId: "mistral-medium-3.5", baseId: "mistral-medium-latest", input: 1.5, output: 7.5 },
  { aliasId: "mistral-small-2603", baseId: "mistral-small-latest", input: 0.15, output: 0.6 },
  { aliasId: "mistral-large-2512", baseId: "mistral-large-latest", input: 0.5, output: 1.5 },
  { aliasId: "ministral-3b-2512", baseId: "ministral-3b-latest", input: 0.1, output: 0.1 },
  { aliasId: "ministral-8b-2512", baseId: "ministral-8b-latest", input: 0.15, output: 0.15 },
  { aliasId: "ministral-14b-2512", baseId: "ministral-14b-latest", input: 0.2, output: 0.2 },
  { aliasId: "codestral-2508", baseId: "codestral-latest", input: 0.3, output: 0.9 },
];

/** Families the vendor prices on a different basis, or does not price at all. */
const MUST_STAY_UNPRICED = [
  // Embeddings are billed on input only; the token component cannot express that
  // without inventing an output rate.
  "mistral-embed",
  "mistral-embed-2312",
  "codestral-embed",
  "codestral-embed-2505",
  // No published price row for these families.
  "mistral-code-latest",
  "mistral-code-fim-latest",
  "mistral-vibe-cli-latest",
  "mistral-tiny-latest",
];

describe("Mistral pricing inheritance (RM-049)", () => {
  it("inherits family pricing into dated and generation aliases", () => {
    for (const expected of INHERITED) {
      const tokens = ProviderModelRegistry.getTokenPricing(
        IntentProvider.MISTRAL,
        expected.aliasId,
      );

      expect(tokens).not.toBeNull();
      expect(tokens?.input).toBe(expected.input);
      expect(tokens?.outputUsd).toBe(expected.output);
    }
  });

  it("marks every inherited price as approximate and names its source", () => {
    // This is what makes inheritance compatible with the exact-id pricing rule: a derived
    // number must never look like a page-verified one.
    for (const expected of INHERITED) {
      const pricing = ProviderModelRegistry.getModelPricing(
        IntentProvider.MISTRAL,
        expected.aliasId,
      );

      expect(pricing?.confidence).toBe("approx");
      expect(String(pricing?.notes ?? "")).toContain(expected.baseId);
    }
  });

  it("keeps the page-verified base models marked official", () => {
    for (const baseId of [
      "mistral-medium-latest",
      "mistral-small-latest",
      "mistral-large-latest",
      "codestral-latest",
    ]) {
      expect(
        ProviderModelRegistry.getModelPricing(IntentProvider.MISTRAL, baseId)
          ?.confidence,
      ).toBe("official");
    }
  });

  it("never inherits across a different pricing basis", () => {
    for (const modelId of MUST_STAY_UNPRICED) {
      expect(
        ProviderModelRegistry.getModelPricing(IntentProvider.MISTRAL, modelId),
      ).toBeNull();
    }
  });
});

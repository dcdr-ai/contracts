import { IntentProvider } from "../src/provider.contract";
import { ProviderModelRegistry } from "../src/provider.catalog.contract";

/**
 * Embeddings pricing snapshot, 2026-09-14, from the official pages (exact ids only).
 *
 * Embeddings bill input tokens only; `outputUsd: 0` is the published rate for a model with no
 * billable output, not a gap, and every entry says so in its notes.
 */
const PRICED_EMBEDDINGS: Array<{ provider: IntentProvider; modelId: string; input: number }> = [
  { provider: IntentProvider.OPEN_AI, modelId: "text-embedding-3-small", input: 0.02 },
  { provider: IntentProvider.OPEN_AI, modelId: "text-embedding-3-large", input: 0.13 },
  { provider: IntentProvider.OPEN_AI, modelId: "text-embedding-ada-002", input: 0.1 },
  { provider: IntentProvider.MISTRAL, modelId: "mistral-embed", input: 0.1 },
  { provider: IntentProvider.MISTRAL, modelId: "codestral-embed", input: 0.15 },
  { provider: IntentProvider.GEMINI, modelId: "gemini-embedding-2", input: 0.2 },
];

/** Ids with no row on the vendor page: they must not be priced, by inheritance or otherwise. */
const UNPRICED_EMBEDDINGS: Array<{ provider: IntentProvider; modelId: string }> = [
  { provider: IntentProvider.GEMINI, modelId: "gemini-embedding-001" },
  { provider: IntentProvider.GEMINI, modelId: "gemini-embedding-2-preview" },
  { provider: IntentProvider.MISTRAL, modelId: "mistral-embed-2312" },
  { provider: IntentProvider.MISTRAL, modelId: "codestral-embed-2505" },
];

describe("embeddings pricing (input-only)", () => {
  it.each(PRICED_EMBEDDINGS)("$provider $modelId carries the vendor input rate and a zero output rate", ({ provider, modelId, input }) => {
    const tokens = ProviderModelRegistry.getTokenPricing(provider, modelId);
    expect(tokens).not.toBeNull();
    expect(tokens?.input).toBe(input);
    expect(tokens?.outputUsd).toBe(0);

    const pricing = ProviderModelRegistry.getModelPricing(provider, modelId);
    expect(pricing?.confidence).toBe("official");
    expect(String(pricing?.notes ?? "")).toMatch(/input-only/i);
  });

  it("prices an embeddings call on its input tokens alone", () => {
    const cost = ProviderModelRegistry.estimateTokenCost({
      provider: IntentProvider.OPEN_AI,
      modelId: "text-embedding-3-small",
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(cost?.amount).toBeCloseTo(0.02, 10);
  });

  it("carries Gemini's per-modality input rates as tiers", () => {
    const tokens = ProviderModelRegistry.getTokenPricing(IntentProvider.GEMINI, "gemini-embedding-2");
    const byName = Object.fromEntries((tokens?.tiers ?? []).map((tier) => [tier.name, tier.input]));
    expect(byName).toEqual({ text: 0.2, image: 0.45, audio: 6.5, video: 12.0 });
  });

  it.each(UNPRICED_EMBEDDINGS)("$provider $modelId stays unpriced: no row on the vendor page", ({ provider, modelId }) => {
    expect(ProviderModelRegistry.getTokenPricing(provider, modelId)).toBeNull();
  });
});

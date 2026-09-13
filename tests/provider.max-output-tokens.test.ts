import { IntentProvider } from "../src/provider.contract";
import { ProviderModelRegistry } from "../src/provider.catalog.contract";

describe("ProviderModelRegistry output ceiling (maxOutputTokens, v3.12.0)", () => {
  it("clamps a request above the declared ceiling and reports it", () => {
    // claude-opus-4-5-20251101 answers max_tokens=64000 in the Anthropic Models API (2026-09-13).
    expect(
      ProviderModelRegistry.clampMaxOutputTokens(
        IntentProvider.ANTHROPIC,
        "claude-opus-4-5-20251101",
        200_000,
      ),
    ).toEqual({ value: 64_000, clamped: true, ceiling: 64_000 });
  });

  it("never raises a request, and passes one at or below the ceiling unchanged", () => {
    expect(
      ProviderModelRegistry.clampMaxOutputTokens(IntentProvider.GEMINI, "gemini-2.5-flash", 1024),
    ).toEqual({ value: 1024, clamped: false, ceiling: 65_536 });
    expect(
      ProviderModelRegistry.clampMaxOutputTokens(IntentProvider.GEMINI, "gemini-2.5-flash", 65_536),
    ).toEqual({ value: 65_536, clamped: false, ceiling: 65_536 });
  });

  it("treats a model without a declared ceiling as unbounded, never as zero", () => {
    // An incomplete catalogue must not turn into a clamp that silently truncates.
    expect(ProviderModelRegistry.getMaxOutputTokens(IntentProvider.ANTHROPIC, "claude-haiku-4-5")).toBeNull();
    expect(
      ProviderModelRegistry.clampMaxOutputTokens(IntentProvider.ANTHROPIC, "claude-haiku-4-5", 200_000),
    ).toEqual({ value: 200_000, clamped: false });
    expect(
      ProviderModelRegistry.clampMaxOutputTokens(IntentProvider.OPEN_AI, "no-such-model", 200_000),
    ).toEqual({ value: 200_000, clamped: false });
  });

  it("does not invent a ceiling for an alias of a curated model", () => {
    // `claude-haiku-4-5` is an alias of the dated id the API reports; curation is per exact id.
    expect(ProviderModelRegistry.getMaxOutputTokens(IntentProvider.ANTHROPIC, "claude-haiku-4-5-20251001")).toBe(64_000);
    expect(ProviderModelRegistry.getMaxOutputTokens(IntentProvider.ANTHROPIC, "claude-haiku-4-5")).toBeNull();
  });

  it("finds the ceiling for the lowercased spelling execution also accepts", () => {
    expect(ProviderModelRegistry.getMaxOutputTokens(IntentProvider.ANTHROPIC, "Claude-Opus-5")).toBe(128_000);
  });

  it("leaves a non-finite request alone rather than guessing", () => {
    expect(
      ProviderModelRegistry.clampMaxOutputTokens(IntentProvider.ANTHROPIC, "claude-opus-5", Number.NaN).clamped,
    ).toBe(false);
  });

  it("only declares positive integer ceilings anywhere in the catalogue", () => {
    const declared = (Object.values(IntentProvider) as IntentProvider[])
      .flatMap((provider) => ProviderModelRegistry.listProviderModels(provider))
      .filter((model) => model.maxOutputTokens !== undefined);

    expect(declared.length).toBeGreaterThan(0);
    expect(declared.every((model) => Number.isInteger(model.maxOutputTokens) && (model.maxOutputTokens as number) > 0)).toBe(true);
  });
});

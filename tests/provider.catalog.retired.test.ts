import { IntentProvider } from "../src/provider.contract";
import {
  PROVIDER_MODEL_RETIREMENTS,
  PROVIDER_MODEL_RETIREMENT_GRACE_DAYS,
  ProviderModelDefinition,
  ProviderModelRegistry,
  ProviderModelRetirementRecord,
  ProviderModelRetirementStage,
  attachProviderModelRetirements,
  getProviderModelRetirementStage,
  isProviderModelRetired,
} from "../src/provider.catalog.contract";

/** A minimal catalog for exercising the load-time validation in isolation. */
function tinyCatalog(): Record<IntentProvider, ProviderModelDefinition[]> {
  const out = {} as Record<IntentProvider, ProviderModelDefinition[]>;
  for (const p of Object.values(IntentProvider) as IntentProvider[]) out[p] = [];
  out[IntentProvider.OPEN_AI] = [
    { id: "old-model", types: [], publicForCustomers: false },
    { id: "public-model", types: [], publicForCustomers: true },
  ];
  return out;
}

/** A valid record for `old-model`, overridable per case. */
function record(over: Partial<ProviderModelRetirementRecord> = {}): ProviderModelRetirementRecord {
  return {
    provider: IntentProvider.OPEN_AI,
    modelId: "old-model",
    detectedAt: "2026-10-01",
    reason: "gone",
    ...over,
  };
}

/** UTC midnight `days` after 2026-10-01. */
function day(days: number): Date {
  return new Date(Date.UTC(2026, 9, 1) + days * 24 * 60 * 60 * 1000);
}

describe("Provider catalog: global retired list (v3.21.0)", () => {
  describe("load-time validation", () => {
    it("attaches { detectedAt, reason } to the matching definition only", () => {
      const out = attachProviderModelRetirements(tinyCatalog(), [record()]);
      expect(out[IntentProvider.OPEN_AI][0].retired).toEqual({ detectedAt: "2026-10-01", reason: "gone" });
      expect(out[IntentProvider.OPEN_AI][1].retired).toBeUndefined();
    });

    it("fails on a record pointing to a model that is not catalogued", () => {
      expect(() => attachProviderModelRetirements(tinyCatalog(), [record({ modelId: "nope" })])).toThrow(
        /not in the provider model catalog/,
      );
    });

    it("fails on a duplicate provider/model", () => {
      expect(() => attachProviderModelRetirements(tinyCatalog(), [record(), record()])).toThrow(/duplicate/);
    });

    it("fails on a retired + publicForCustomers model", () => {
      expect(() =>
        attachProviderModelRetirements(tinyCatalog(), [record({ modelId: "public-model" })]),
      ).toThrow(/publicForCustomers/);
    });

    it("fails on a non-ISO date or an empty reason", () => {
      expect(() => attachProviderModelRetirements(tinyCatalog(), [record({ detectedAt: "27/10/2026" })])).toThrow(
        /ISO date/,
      );
      expect(() => attachProviderModelRetirements(tinyCatalog(), [record({ reason: " " })])).toThrow(/reason/);
    });
  });

  describe("stage policy (one for every provider)", () => {
    const def = { retired: { detectedAt: "2026-10-01", reason: "gone" } };

    it("has a 30-day grace window", () => {
      expect(PROVIDER_MODEL_RETIREMENT_GRACE_DAYS).toBe(30);
    });

    it.each([
      [0, ProviderModelRetirementStage.RETIRING],
      [29, ProviderModelRetirementStage.RETIRING],
      [30, ProviderModelRetirementStage.RETIRED],
      [31, ProviderModelRetirementStage.RETIRED],
    ])("day %i after detection -> %s", (days, stage) => {
      expect(getProviderModelRetirementStage(def, day(days))).toBe(stage);
    });

    it("is undefined without a marker", () => {
      expect(getProviderModelRetirementStage({}, day(100))).toBeUndefined();
      expect(getProviderModelRetirementStage(null, day(100))).toBeUndefined();
    });

    it("keeps the stage wire values stable", () => {
      expect(ProviderModelRetirementStage.RETIRING).toBe("RETIRING");
      expect(ProviderModelRetirementStage.RETIRED).toBe("RETIRED");
    });
  });

  describe("the shipped list", () => {
    it("every record is attached to its catalog entry, which keeps its evidence", () => {
      for (const r of PROVIDER_MODEL_RETIREMENTS) {
        const def = ProviderModelRegistry.getModelDefinition(r.provider, r.modelId);
        expect(def?.retired).toEqual({ detectedAt: r.detectedAt, reason: r.reason });
        expect(def?.publicForCustomers).toBe(false);
      }
    });

    it("DCDR virtual mirrors inherit the marker", () => {
      expect(ProviderModelRegistry.getModelDefinition(IntentProvider.DCDR, "openai/o1")?.retired?.detectedAt).toBe(
        "2026-10-27",
      );
    });

    it("does not mark models that are only de-listed or that still answer", () => {
      // claude-haiku-4-5 is a LEGACY E2E override but answers 200 (the showcase uses it).
      expect(isProviderModelRetired(IntentProvider.ANTHROPIC, "claude-haiku-4-5")).toBe(false);
      // Mistral answers 403/429 (entitlement), and these Gemini ids still exist: not retirements.
      expect(isProviderModelRetired(IntentProvider.MISTRAL, "mistral-large-latest")).toBe(false);
      expect(isProviderModelRetired(IntentProvider.GEMINI, "gemini-2.5-flash-preview-tts")).toBe(false);
      expect(isProviderModelRetired(IntentProvider.OPEN_AI, "omni-moderation-latest")).toBe(false);
      expect(isProviderModelRetired(IntentProvider.OPEN_AI, "no-such-model")).toBe(false);
    });

    it("excludeRetired drops RETIRED models and keeps RETIRING ones", () => {
      const ids = (now: Date) =>
        ProviderModelRegistry.listProviderModels(IntentProvider.OPEN_AI, { excludeRetired: true, now }).map(
          (m) => m.id,
        );
      const onDetection = ids(new Date(Date.UTC(2026, 9, 27)));
      expect(onDetection).toContain("o1"); // detected 2026-10-27: RETIRING
      expect(onDetection).not.toContain("gpt-5-codex"); // detected 2026-09-06: RETIRED
      expect(ids(new Date(Date.UTC(2026, 10, 26)))).not.toContain("o1"); // day 30
      expect(ProviderModelRegistry.listProviderModels(IntentProvider.OPEN_AI).map((m) => m.id)).toContain("o1");
    });

    it("listRetiredModels returns only RETIRED-stage models, across providers, without DCDR mirrors", () => {
      const at = new Date(Date.UTC(2026, 9, 28));
      const retired = ProviderModelRegistry.listRetiredModels(undefined, at);
      expect(retired.every((r) => r.provider !== IntentProvider.DCDR)).toBe(true);
      expect(retired.map((r) => r.model.id)).toContain("gpt-5-codex");
      expect(retired.map((r) => r.model.id)).not.toContain("o1");
      const later = ProviderModelRegistry.listRetiredModels(undefined, new Date(Date.UTC(2027, 0, 1)));
      expect(later.length).toBe(PROVIDER_MODEL_RETIREMENTS.length);
    });
  });
});

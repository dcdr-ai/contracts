import { IntentProvider } from "../src/provider.contract";
import {
  DcdrPublicModelCategory,
  ProviderModelRegistry,
} from "../src/provider.catalog.contract";

describe("ProviderModelRegistry.listProviderModels onlyPublicForCustomers", () => {
  it("filters models when onlyPublicForCustomers=true", () => {
    const all = ProviderModelRegistry.listProviderModels(
      IntentProvider.OPEN_AI,
    );
    const onlyPublic = ProviderModelRegistry.listProviderModels(
      IntentProvider.OPEN_AI,
      { onlyPublicForCustomers: true },
    );

    expect(all.length).toBeGreaterThan(0);
    expect(onlyPublic.length).toBeGreaterThan(0);
    expect(onlyPublic.length).toBeLessThan(all.length);

    expect(onlyPublic.every((m) => m.publicForCustomers === true)).toBe(true);
    expect(all.some((m) => m.publicForCustomers === false)).toBe(true);
  });

  it("returns full list when called without options", () => {
    const all1 = ProviderModelRegistry.listProviderModels(
      IntentProvider.GEMINI,
    );
    const all2 = ProviderModelRegistry.listProviderModels(
      IntentProvider.GEMINI,
      {
        onlyPublicForCustomers: false,
      },
    );

    expect(all1.map((m) => m.id)).toEqual(all2.map((m) => m.id));
  });

  it("returns only the curated Gemini set when onlyPublicForCustomers=true", () => {
    const onlyPublic = ProviderModelRegistry.listProviderModels(
      IntentProvider.GEMINI,
      { onlyPublicForCustomers: true },
    );

    const ids = onlyPublic.map((m) => m.id);
    expect(ids).toContain("gemini-3.5-flash");
    expect(ids).toContain("gemini-3.1-pro-preview");
    expect(ids).toContain("gemini-3-flash-preview");
    expect(ids).toContain("gemini-2.5-flash");
    expect(ids).toContain("gemini-2.5-flash-lite");
    expect(ids).not.toContain("gemini-2.5-pro");
  });

  it("listPublicCustomerModels returns models with required public metadata", () => {
    const items = ProviderModelRegistry.listPublicCustomerModels();
    expect(items.length).toBe(15);

    const globalDefaults = items.filter(
      (i) => i.model.isGlobalDefault === true,
    );
    expect(globalDefaults.length).toBe(1);

    for (const item of items) {
      expect(item.model.publicForCustomers).toBe(true);
      expect(typeof item.model.publicName).toBe("string");
      expect(item.model.publicName.length).toBeGreaterThan(0);

      // Legacy fields must not exist in the final managed metadata shape.
      const legacy = item.model as unknown as Record<string, unknown>;
      expect("publicDisplayName" in legacy).toBe(false);
      expect("isRecommendedDefault" in legacy).toBe(false);
      expect("default" in legacy).toBe(false);

      expect(item.model.primaryCategory).toBeDefined();
      expect(Array.isArray(item.model.categories)).toBe(true);
      expect(item.model.categories.length).toBeGreaterThan(0);
      expect(item.model.categories).toContain(item.model.primaryCategory);

      expect(item.model.qualityTier).toBeGreaterThanOrEqual(1);
      expect(item.model.qualityTier).toBeLessThanOrEqual(5);
      expect(item.model.speedTier).toBeGreaterThanOrEqual(1);
      expect(item.model.speedTier).toBeLessThanOrEqual(5);
      expect(item.model.costTier).toBeGreaterThanOrEqual(1);
      expect(item.model.costTier).toBeLessThanOrEqual(5);

      expect(Array.isArray(item.model.recommendedUseCases)).toBe(true);
      expect(item.model.recommendedUseCases.length).toBeGreaterThan(0);
      expect(typeof item.model.isRecommended).toBe("boolean");
      expect(typeof item.model.isGlobalDefault).toBe("boolean");
      expect(typeof item.model.isCategoryDefault).toBe("boolean");
    }
  });

  it("groups public models by primaryCategory", () => {
    const grouped =
      ProviderModelRegistry.listPublicCustomerModelsByPrimaryCategory();

    expect(grouped[DcdrPublicModelCategory.BEST].length).toBe(4);
    expect(grouped[DcdrPublicModelCategory.SMART].length).toBe(3);
    expect(grouped[DcdrPublicModelCategory.FAST].length).toBe(4);
    expect(grouped[DcdrPublicModelCategory.ECONOMY].length).toBe(3);
    expect(grouped[DcdrPublicModelCategory.PRIVATE].length).toBe(1);

    const bestIds = grouped[DcdrPublicModelCategory.BEST].map((m) => m.modelId);
    expect(bestIds).toContain("gpt-5.5");
    expect(bestIds).toContain("claude-opus-4-8");
    expect(bestIds).toContain("gemini-3.1-pro-preview");
    expect(bestIds).toContain("grok-4.3");

    // Each primaryCategory with models should have at least one category default.
    for (const c of Object.values(DcdrPublicModelCategory)) {
      const group = grouped[c];
      if (!group?.length) continue;
      expect(group.some((m) => m.model.isCategoryDefault === true)).toBe(true);
    }
  });
});

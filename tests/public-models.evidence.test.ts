import { IntentType } from "../src/intent.contract";
import { IntentProvider } from "../src/provider.contract";
import {
  DcdrPublicModelCategory,
  PROVIDER_MODEL_E2E_OVERRIDES,
  ProviderModelE2EStatus,
  ProviderModelRegistry,
  ProviderModelRuntimeSupportStatus,
} from "../src/provider.catalog.contract";

/**
 * Evidence guardrails for the managed public model set.
 *
 * The managed set is customer-facing: every claim it makes about a model is a claim
 * DCDR makes to its users. These tests encode the invariants that keep that list
 * honest, so a future curation pass cannot quietly reintroduce an unbacked claim.
 *
 * Context (RM-050): the OpenAI multimodal curator used to accept `sawProvidedInput=true`
 * — proof that bytes arrived, not that the model understood them. That produced full
 * 15/15 rectangles on models that cannot process audio or video, and one of them
 * (`gpt-5.4-nano`) was customer-public while advertising audio and video input.
 */
const CHAT_PROVIDERS = [
  IntentProvider.OPEN_AI,
  IntentProvider.ANTHROPIC,
  IntentProvider.GEMINI,
  IntentProvider.GROK,
  IntentProvider.MISTRAL,
];

interface PublicModelRow {
  provider: IntentProvider;
  modelId: string;
}

/** Lists every customer-facing model across the CHAT providers. */
function listPublicRows(): PublicModelRow[] {
  const rows: PublicModelRow[] = [];
  for (const provider of CHAT_PROVIDERS) {
    for (const model of ProviderModelRegistry.listProviderModels(provider, {
      onlyPublicForCustomers: true,
    })) {
      rows.push({ provider, modelId: model.id });
    }
  }
  return rows;
}

describe("Managed public model set — evidence guardrails", () => {
  it("exposes at least one public model per implemented CHAT provider", () => {
    for (const provider of CHAT_PROVIDERS) {
      const models = ProviderModelRegistry.listProviderModels(provider, {
        onlyPublicForCustomers: true,
      });

      expect(models.length).toBeGreaterThan(0);
    }
  });

  it("only publishes models that are SUPPORTED at runtime", () => {
    const offenders = listPublicRows().filter(({ provider, modelId }) => {
      const def = ProviderModelRegistry.getModelDefinition(provider, modelId);
      return (
        def?.runtimeSupport?.status !==
        ProviderModelRuntimeSupportStatus.SUPPORTED
      );
    });

    expect(offenders).toEqual([]);
  });

  it("only publishes models with verified token usage coverage", () => {
    // Billing invariant: a model must not be customer-public unless its usage
    // reporting has actually been observed in provider E2E.
    const offenders = listPublicRows().filter(
      ({ provider, modelId }) =>
        ProviderModelRegistry.getModelDefinition(provider, modelId)
          ?.tokenUsageCovered !== true,
    );

    expect(offenders).toEqual([]);
  });

  it("only publishes models with known pricing", () => {
    // A customer-visible model with no price cannot be reasoned about for cost.
    const offenders = listPublicRows().filter(({ provider, modelId }) => {
      const tokens = ProviderModelRegistry.getTokenPricing(provider, modelId);
      return (
        !tokens ||
        typeof tokens.input !== "number" ||
        typeof tokens.outputUsd !== "number"
      );
    });

    expect(offenders).toEqual([]);
  });

  it("never publishes a multimodal rectangle that is not itself SUPPORTED", () => {
    // An `IN_PROGRESS` rectangle means the evidence is untrusted (RM-050). Such a
    // model may stay in the catalog, but it must not be shown to customers as if
    // its input-part support were established.
    const offenders = listPublicRows().filter(({ provider, modelId }) => {
      const inputParts = ProviderModelRegistry.getModelDefinition(
        provider,
        modelId,
      )?.runtimeSupport?.inputParts;

      return (
        inputParts !== undefined &&
        inputParts.status !== ProviderModelRuntimeSupportStatus.SUPPORTED
      );
    });

    expect(offenders).toEqual([]);
  });

  it("carries dated evidence for every published multimodal rectangle", () => {
    const offenders = listPublicRows().filter(({ provider, modelId }) => {
      const inputParts = ProviderModelRegistry.getModelDefinition(
        provider,
        modelId,
      )?.runtimeSupport?.inputParts;
      if (!inputParts) return false;

      const hasAssets = (inputParts.supportedAssetTypes ?? []).length > 0;
      const hasKinds = (inputParts.supportedSourceKinds ?? []).length > 0;
      const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(
        String(inputParts.updatedAt ?? ""),
      );
      const hasNotes = String(inputParts.notes ?? "").trim().length > 0;

      return !(hasAssets && hasKinds && hasDate && hasNotes);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps exactly one global default and one default per populated category", () => {
    const items = ProviderModelRegistry.listPublicCustomerModels();

    expect(items.filter((i) => i.model.isGlobalDefault === true)).toHaveLength(
      1,
    );

    const grouped =
      ProviderModelRegistry.listPublicCustomerModelsByPrimaryCategory();

    for (const category of Object.values(DcdrPublicModelCategory)) {
      const models = grouped[category] ?? [];
      if (models.length === 0) continue;

      expect(
        models.filter((m) => m.model.isCategoryDefault === true).length,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("only publishes models that provider E2E can actually exercise", () => {
    // A `LEGACY` override makes provider E2E skip the model, so a customer-facing model
    // carrying one can never be re-verified. `claude-haiku-4-5` was in exactly that
    // state: public as DCDR Fast, but a local-only alias the vendor no longer lists.
    const offenders = listPublicRows().filter(
      ({ provider, modelId }) =>
        PROVIDER_MODEL_E2E_OVERRIDES[provider]?.[modelId]?.status ===
        ProviderModelE2EStatus.LEGACY,
    );

    expect(offenders).toEqual([]);
  });

  it("publishes every managed model as a CHAT model", () => {
    const offenders = listPublicRows().filter(({ provider, modelId }) => {
      const def = ProviderModelRegistry.getModelDefinition(provider, modelId);
      return !def?.types.includes(IntentType.CHAT);
    });

    expect(offenders).toEqual([]);
  });
});

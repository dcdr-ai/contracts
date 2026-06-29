import { AssetType } from "../asset.contract";
import { ExecutionPartSourceKind } from "../execution.contract";
import { IntentType } from "../intent.contract";
import type {
  ProviderCatalogModuleBuildArgs,
  ProviderModelDefinitionInput,
  ProviderModelE2EOverride,
  ProviderModelInputPartsSupportInfo,
  ProviderModelParameterSupportInfo,
} from "../provider.catalog.contract";

const OFFICE_REFERENCE_PRICING_URL = "https://ai.google.dev/gemini-api/docs/pricing";
const OFFICE_REFERENCE_PRICING_UPDATED_AT_20260519 = Date.UTC(2026, 4, 19);

/**
 * Returns the curated Office provider model definitions.
 */
export function buildOfficeProviderModelDefinitions(
  args: ProviderCatalogModuleBuildArgs,
): ProviderModelDefinitionInput[] {

  return [
    // Office = internal/local OpenAI-compatible runtime (vLLM etc.)
    // Keep IDs aligned with the common local model naming used in registries.
    {
      id: "Qwen3-4B-Instruct-2507",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      tokenUsageCovered: true,
      publicName: "DCDR Private",
      badge: "Local",
      primaryCategory: args.catalogEnums.publicModelCategory.PRIVATE,
      categories: [
        args.catalogEnums.publicModelCategory.PRIVATE,
        args.catalogEnums.publicModelCategory.ECONOMY,
        args.catalogEnums.publicModelCategory.FAST,
      ],
      qualityTier: 2,
      speedTier: 5,
      costTier: 5,
      recommendedUseCases: ["private_data", "on_prem", "high_volume"],
      isRecommended: false,
      isGlobalDefault: false,
      isCategoryDefault: true,
      pricing: args.pricingPerMillionTokens({
        // Synthetic estimate for local models: keep Office cheaper than hosted providers.
        // Pick round numbers for UI cost guidance.
        input: 0.05,
        output: 0.15,
        sourceUrl: OFFICE_REFERENCE_PRICING_URL,
        updatedAt: OFFICE_REFERENCE_PRICING_UPDATED_AT_20260519,
        confidence: "approx",
        notes:
          "Synthetic pricing for local OFFICE provider. For UI cost guidance only.",
      }),
    },
  ];
}

/**
 * Returns the E2E override map for Office provider models.
 */
export function buildOfficeProviderModelE2EOverrides(
  args: ProviderCatalogModuleBuildArgs,
): Record<string, ProviderModelE2EOverride> {
  return {};
}


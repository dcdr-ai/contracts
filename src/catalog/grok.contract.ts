import { AssetType } from "../asset.contract";
import { ExecutionPartSourceKind } from "../execution.contract";
import { IntentType } from "../intent.contract";
import type {
  ProviderCatalogModuleBuildArgs,
  ProviderModelDefinitionInput,
  ProviderModelE2EOverride,
  ProviderModelParameterSupportInfo,
} from "../provider.catalog.contract";

const XAI_PRICING_URL = "https://docs.x.ai/developers/pricing";
const XAI_PRICING_UPDATED_AT_20260522 = Date.UTC(2026, 4, 22);

/**
 * Returns the curated Grok provider model definitions.
 */
export function buildGrokProviderModelDefinitions(
  args: ProviderCatalogModuleBuildArgs,
): ProviderModelDefinitionInput[] {
  const GROK_CHAT_PARAMETER_SUPPORT: ProviderModelParameterSupportInfo = {
    parameters: {
      [args.catalogEnums.promptParameterKey.PRESENCE_PENALTY]:
        args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
      [args.catalogEnums.promptParameterKey.FREQUENCY_PENALTY]:
        args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
    },
    notes:
      "Grok chat models reject presence/frequency penalties on current OpenAI-compatible endpoint.",
    updatedAt: "2026-06-07",
  };

  return [
    // Source: xAI pricing page (snapshot 2026-06-07)
    // Runtime posture: curated public candidates are enabled for customer-facing BEST/FAST options.
    {
      id: "grok-4.3",
      types: [IntentType.CHAT],
      parameterSupport: GROK_CHAT_PARAMETER_SUPPORT,
      publicForCustomers: true,
      tokenUsageCovered: true,
      publicName: "DCDR Best",
      badge: "Grok",
      primaryCategory: args.catalogEnums.publicModelCategory.BEST,
      categories: [args.catalogEnums.publicModelCategory.BEST, args.catalogEnums.publicModelCategory.SMART],
      qualityTier: 5,
      speedTier: 4,
      costTier: 3,
      recommendedUseCases: ["reasoning", "analysis", "production_chat"],
      isRecommended: false,
      isGlobalDefault: false,
      isCategoryDefault: false,
      pricing: args.pricingPerMillionTokens({
        input: 1.25,
        cachedInput: 0.2,
        output: 2.5,
        sourceUrl: XAI_PRICING_URL,
        updatedAt: XAI_PRICING_UPDATED_AT_20260522,
      }),
      runtimeSupport: {
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (run + structured)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-06-28 with the 1024-token baseline via Responses API. IMAGE and DOCUMENT both pass across INLINE/URL/ASSET. TEXT passes INLINE but not URL or ASSET (comprehensionEcho missing — metadata-suppression pattern persists, excluded from rectangle). AUDIO and VIDEO fail the canonical comprehension cues across all source kinds.",
          updatedAt: "2026-06-28",
        },
        updatedAt: "2026-06-07",
      },
    },
    {
      id: "grok-4.20-0309-non-reasoning",
      types: [IntentType.CHAT],
      parameterSupport: GROK_CHAT_PARAMETER_SUPPORT,
      pricing: args.pricingPerMillionTokens({
        input: 1.25,
        cachedInput: 0.2,
        output: 2.5,
        sourceUrl: XAI_PRICING_URL,
        updatedAt: XAI_PRICING_UPDATED_AT_20260522,
      }),
      runtimeSupport: {
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (run + structured)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.TEXT, AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated with the comprehension-grade Grok curator on 2026-06-27 via Responses API. TEXT, IMAGE, and DOCUMENT all pass across INLINE/URL/ASSET. AUDIO echoes filename metadata ('sample audio') across all source kinds with no actual audio comprehension. VIDEO generates plausible-sounding but mutually inconsistent scene descriptions across source kinds (hallucination — INLINE: city sidewalk at night; URL: red-shirted person by river; ASSET: industrial plant worker), confirming no genuine video processing.",
          updatedAt: "2026-06-27",
        },
        updatedAt: "2026-06-07",
      },
    },
    {
      id: "grok-4.20-0309-reasoning",
      types: [IntentType.CHAT],
      parameterSupport: GROK_CHAT_PARAMETER_SUPPORT,
      pricing: args.pricingPerMillionTokens({
        input: 1.25,
        cachedInput: 0.2,
        output: 2.5,
        sourceUrl: XAI_PRICING_URL,
        updatedAt: XAI_PRICING_UPDATED_AT_20260522,
      }),
      runtimeSupport: {
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (run + structured)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-06-28 with the 1024-token baseline via Responses API. IMAGE and DOCUMENT both pass across INLINE/URL/ASSET. TEXT passes URL and ASSET but not INLINE (comprehensionEcho missing on INLINE — inconsistent pattern, excluded from rectangle). AUDIO and VIDEO fail the canonical comprehension cues across all source kinds.",
          updatedAt: "2026-06-28",
        },
        updatedAt: "2026-06-07",
      },
    },
    {
      id: "grok-4.20-multi-agent-0309",
      types: [IntentType.CHAT],
      parameterSupport: GROK_CHAT_PARAMETER_SUPPORT,
      pricing: args.pricingPerMillionTokens({
        input: 1.25,
        cachedInput: 0.2,
        output: 2.5,
        sourceUrl: XAI_PRICING_URL,
        updatedAt: XAI_PRICING_UPDATED_AT_20260522,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.FAILING,
        reason:
          "Provider E2E returns upstream 400 on both run and structured paths (OpenAI-compatible chat endpoint).",
        updatedAt: "2026-06-07",
      },
    },
    {
      id: "grok-build-0.1",
      types: [IntentType.CHAT],
      parameterSupport: GROK_CHAT_PARAMETER_SUPPORT,
      publicForCustomers: true,
      tokenUsageCovered: true,
      publicName: "DCDR Fast",
      badge: "Grok",
      primaryCategory: args.catalogEnums.publicModelCategory.FAST,
      categories: [
        args.catalogEnums.publicModelCategory.FAST,
        args.catalogEnums.publicModelCategory.ECONOMY,
      ],
      qualityTier: 3,
      speedTier: 5,
      costTier: 4,
      recommendedUseCases: ["interactive_chat", "classification", "support"],
      isRecommended: false,
      isGlobalDefault: false,
      isCategoryDefault: false,
      pricing: args.pricingPerMillionTokens({
        input: 1.0,
        cachedInput: 0.2,
        output: 2.0,
        sourceUrl: XAI_PRICING_URL,
        updatedAt: XAI_PRICING_UPDATED_AT_20260522,
      }),
      runtimeSupport: {
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (run + structured)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-06-28 with the 1024-token baseline via Responses API. IMAGE now passes across INLINE/URL/ASSET (previously only URL and ASSET passed). DOCUMENT passes across INLINE/URL/ASSET. TEXT fails comprehensionEcho on all three source kinds. AUDIO and VIDEO fail the canonical comprehension cues across all source kinds.",
          updatedAt: "2026-06-28",
        },
        updatedAt: "2026-06-07",
      },
    },
    {
      id: "grok-imagine-image",
      types: [IntentType.IMAGE_GENERATION],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via xAI /v1/models; image generation runtime adapter and curation are not implemented yet.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "grok-imagine-image-quality",
      types: [IntentType.IMAGE_GENERATION],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via xAI /v1/models; image generation runtime adapter and curation are not implemented yet.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "grok-imagine-video",
      types: [IntentType.VIDEO_GENERATION],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via xAI /v1/models; video generation runtime adapter and curation are not implemented yet.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "grok-imagine-video-1.5",
      types: [IntentType.VIDEO_GENERATION],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via xAI /v1/models; video generation runtime adapter and curation are not implemented yet.",
        updatedAt: "2026-07-04",
      },
    },
  ];
}

/**
 * Returns the E2E override map for Grok provider models.
 */
export function buildGrokProviderModelE2EOverrides(
  args: ProviderCatalogModuleBuildArgs,
): Record<string, ProviderModelE2EOverride> {
  return {};
}

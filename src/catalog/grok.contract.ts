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
const XAI_PRICING_UPDATED_AT_20260905 = Date.UTC(2026, 8, 5);

/**
 * xAI publishes two price columns per text model: a base column for requests under
 * 200k context tokens and a higher column at or above it. The base column is stored as
 * the `tokens` component and the second column as a `long_context` tier.
 */
const XAI_LONG_CONTEXT_TIER_NAME = "long_context";
const XAI_LONG_CONTEXT_TIER_CONDITION = "Context >= 200k tokens";

/**
 * Returns the curated Grok provider model definitions.
 *
 * Upstream surface (RM-047)
 * - Grok runs through the OpenAI-compatible adapter, which selects the surface by
 *   whether the request carries `inputParts`: text-only traffic uses chat completions,
 *   and requests with input parts use the Responses API because xAI rejects file
 *   content on `/v1/chat/completions`.
 * - `runtimeSupport.preferredApi` is therefore deliberately not set on Grok entries:
 *   `shouldUseOpenAICompatibleResponsesApi()` only consults it for `IntentProvider.OPEN_AI`,
 *   so setting it here would state a routing decision the runtime never reads.
 * - The behaviour is pinned by `tests/providers/grok.provider.responses-routing.test.ts`.
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
    // Source: xAI pricing page (snapshot 2026-09-05; base + `>= 200k` long-context columns)
    // Runtime posture: curated public candidates are enabled for customer-facing BEST/FAST options.
    {
      id: "grok-4.6",
      types: [IntentType.CHAT],
      parameterSupport: GROK_CHAT_PARAMETER_SUPPORT,
      tokenUsageCovered: true,
      pricing: args.pricingPerMillionTokens({
        input: 2.0,
        cachedInput: 0.5,
        output: 6.0,
        tiers: [
          {
            name: XAI_LONG_CONTEXT_TIER_NAME,
            condition: XAI_LONG_CONTEXT_TIER_CONDITION,
            input: 4.0,
            cachedInput: 1.0,
            output: 12.0,
          },
        ],
        sourceUrl: XAI_PRICING_URL,
        updatedAt: XAI_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E on 2026-09-05 (run + structured). preferredApi is intentionally omitted: Grok routing ignores it today (see RM-047).",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-measured on 2026-09-05 with the unified comprehension-grade curator (RM-050/RM-051): one shared cue definition, one prompt per asset family and a 1024-token budget across every provider, so this rectangle means the same thing as every other provider's. TEXT passes only on URL, so it is excluded rather than published as a partial rectangle. AUDIO and VIDEO fail on filename echoing rather than perception.",
          updatedAt: "2026-09-05",
        },
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "grok-4.5",
      types: [IntentType.CHAT],
      parameterSupport: GROK_CHAT_PARAMETER_SUPPORT,
      tokenUsageCovered: true,
      pricing: args.pricingPerMillionTokens({
        input: 2.0,
        cachedInput: 0.3,
        output: 6.0,
        tiers: [
          {
            name: XAI_LONG_CONTEXT_TIER_NAME,
            condition: XAI_LONG_CONTEXT_TIER_CONDITION,
            input: 4.0,
            cachedInput: 0.6,
            output: 12.0,
          },
        ],
        sourceUrl: XAI_PRICING_URL,
        updatedAt: XAI_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E on 2026-09-05 (run + structured). preferredApi is intentionally omitted: Grok routing ignores it today (see RM-047).",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-09-05 with the comprehension-grade Grok curator (1024-token baseline). IMAGE and DOCUMENT both pass across INLINE/URL/ASSET. TEXT passes INLINE and URL but fails ASSET (comprehensionEcho missing); it is excluded from the published rectangle because runtimeSupport.inputParts cannot express a per-asset source-kind subset without overstating support. AUDIO and VIDEO fail the canonical comprehension cues across all source kinds.",
          updatedAt: "2026-09-05",
        },
        updatedAt: "2026-09-05",
      },
    },
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
        tiers: [
          {
            name: XAI_LONG_CONTEXT_TIER_NAME,
            condition: XAI_LONG_CONTEXT_TIER_CONDITION,
            input: 2.5,
            cachedInput: 0.4,
            output: 5.0,
          },
        ],
        sourceUrl: XAI_PRICING_URL,
        updatedAt: XAI_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
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
            "Re-measured on 2026-09-05 with the unified comprehension-grade curator (RM-050/RM-051): one shared cue definition, one prompt per asset family and a 1024-token budget across every provider, so this rectangle means the same thing as every other provider's. TEXT does not report seeing the input on any source kind. AUDIO and VIDEO fail because the model echoes the filename (\"MPEG audio file sample.mp3\", \"sample.mp4 video file\") instead of describing the content.",
          updatedAt: "2026-09-05",
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
        tiers: [
          {
            name: XAI_LONG_CONTEXT_TIER_NAME,
            condition: XAI_LONG_CONTEXT_TIER_CONDITION,
            input: 2.5,
            cachedInput: 0.4,
            output: 5.0,
          },
        ],
        sourceUrl: XAI_PRICING_URL,
        updatedAt: XAI_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
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
        tiers: [
          {
            name: XAI_LONG_CONTEXT_TIER_NAME,
            condition: XAI_LONG_CONTEXT_TIER_CONDITION,
            input: 2.5,
            cachedInput: 0.4,
            output: 5.0,
          },
        ],
        sourceUrl: XAI_PRICING_URL,
        updatedAt: XAI_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
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
        tiers: [
          {
            name: XAI_LONG_CONTEXT_TIER_NAME,
            condition: XAI_LONG_CONTEXT_TIER_CONDITION,
            input: 2.5,
            cachedInput: 0.4,
            output: 5.0,
          },
        ],
        sourceUrl: XAI_PRICING_URL,
        updatedAt: XAI_PRICING_UPDATED_AT_20260905,
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
        tiers: [
          {
            name: XAI_LONG_CONTEXT_TIER_NAME,
            condition: XAI_LONG_CONTEXT_TIER_CONDITION,
            input: 2.0,
            cachedInput: 0.4,
            output: 4.0,
          },
        ],
        sourceUrl: XAI_PRICING_URL,
        updatedAt: XAI_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
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
            "Re-measured on 2026-09-05 with the unified comprehension-grade curator (RM-050/RM-051): one shared cue definition, one prompt per asset family and a 1024-token budget across every provider, so this rectangle means the same thing as every other provider's. TEXT does not report seeing the input on any source kind. AUDIO and VIDEO fail on filename echoing rather than perception.",
          updatedAt: "2026-09-05",
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
      id: "grok-imagine-image-2.0",
      types: [IntentType.IMAGE_GENERATION],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via xAI /v1/models on 2026-09-05; image generation runtime adapter and curation are not implemented yet. xAI prices this model per image (0.04 USD), which the catalog pricing components do not model yet.",
        updatedAt: "2026-09-05",
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

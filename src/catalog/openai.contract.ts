import { AssetType } from "../asset.contract";
import { ExecutionPartSourceKind } from "../execution.contract";
import { IntentType } from "../intent.contract";
import type {
  ProviderCatalogModuleBuildArgs,
  ProviderModelDefinitionInput,
  ProviderModelE2EOverride,
  ProviderModelParameterSupportInfo,
  ProviderPricingFallbackRule,
} from "../provider.catalog.contract";

const OPENAI_PRICING_URL = "https://developers.openai.com/api/docs/pricing";
const OPENAI_PRICING_UPDATED_AT_20260327 = Date.UTC(2026, 2, 27);
const OPENAI_PRICING_UPDATED_AT_20260430 = Date.UTC(2026, 3, 30);
const OPENAI_PRICING_UPDATED_AT_20260522 = Date.UTC(2026, 4, 22);

export const OPENAI_PROVIDER_PRICING_FALLBACK_RULES: ProviderPricingFallbackRule[] =
  [
    // Not officially published separately; assume same token pricing as base GPT-5.
    { match: /^gpt-5-search-api/, baseModelId: "gpt-5" },
  ];

/**
 * Returns the curated OpenAI provider model definitions.
 */
export function buildOpenAIProviderModelDefinitions(
  args: ProviderCatalogModuleBuildArgs,
): ProviderModelDefinitionInput[] {
  const OPENAI_GPT5_PARAMETER_SUPPORT: ProviderModelParameterSupportInfo = {
    parameters: {
      [args.catalogEnums.promptParameterKey.TEMPERATURE]:
        args.catalogEnums.parameterSupportStatus.DEFAULT_ONLY,
      [args.catalogEnums.promptParameterKey.TOP_P]:
        args.catalogEnums.parameterSupportStatus.DEFAULT_ONLY,
      [args.catalogEnums.promptParameterKey.TOP_K]:
        args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
    },
    recommended: {
      // E2E and probes showed that very low budgets (e.g. 16) can yield reasoning-only outputs.
      minMaxTokens: 64,
    },
    notes:
      "GPT-5 family: avoid custom sampling params; ensure sufficient max_tokens budget.",
    updatedAt: "2026-04-28",
  };

  return [
    // Pricing snapshot: OpenAI pricing page, updatedAt=2026-03-27
    // Model IDs below are kept in roughly "newest first" order.
    // Discovered aliases are sourced from OpenAI `GET /v1/models` (snapshot 2026-04-27).

    // --- gpt-5.5 (discovered; priced) ---
    {
      id: "gpt-5.5",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      tokenUsageCovered: true,
      publicName: "DCDR Best",
      badge: "OpenAI",
      primaryCategory: args.catalogEnums.publicModelCategory.BEST,
      categories: [args.catalogEnums.publicModelCategory.BEST],
      qualityTier: 5,
      speedTier: 3,
      costTier: 1,
      recommendedUseCases: ["reasoning", "agentic_coding"],
      isRecommended: false,
      isGlobalDefault: false,
      isCategoryDefault: true,
      pricing: args.pricingPerMillionTokens({
        input: 5.0,
        cachedInput: 0.5,
        output: 30.0,
        tiers: [
          {
            name: "long_context",
            condition: "Long context",
            input: 10.0,
            cachedInput: 1.0,
            output: 45.0,
          },
        ],
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "OpenAI provider validated text/image/audio/video/document inputParts for INLINE, URL, and ASSET sources on gpt-5.5 via the corrected one-model multimodal curator with a clean 15/15 matrix.",
          updatedAt: "2026-06-16",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-16",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.5-2026-04-23",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "OpenAI provider validated text/image/audio/video/document inputParts for INLINE, URL, and ASSET sources on the dated gpt-5.5 family alias via the same corrected multimodal curator baseline used for gpt-5.5.",
          updatedAt: "2026-06-16",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-16",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.5-pro",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 30.0,
        output: 180.0,
        tiers: [
          {
            name: "long_context",
            condition: "Long context",
            input: 60.0,
            output: 270.0,
          },
        ],
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "OpenAI provider validated text/image/audio/video/document inputParts for INLINE, URL, and ASSET sources on gpt-5.5-pro via the corrected one-model multimodal curator with a clean 15/15 matrix.",
          updatedAt: "2026-06-16",
        },
        reason:
          "OpenAI responses-only model (not supported on /v1/chat/completions)",
        updatedAt: "2026-06-16",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.5-pro-2026-04-23",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "OpenAI provider validated text/image/audio/video/document inputParts for INLINE, URL, and ASSET sources on gpt-5.5-pro-2026-04-23 via the corrected one-model multimodal curator with a clean 15/15 matrix.",
          updatedAt: "2026-06-16",
        },
        reason:
          "OpenAI responses-only model (not supported on /v1/chat/completions)",
        updatedAt: "2026-06-16",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },

    // --- gpt-5.4 (discovered; priced) ---
    {
      id: "gpt-5.4",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      tokenUsageCovered: true,
      publicName: "DCDR Smart",
      badge: "Recommended",
      primaryCategory: args.catalogEnums.publicModelCategory.SMART,
      categories: [
        args.catalogEnums.publicModelCategory.SMART,
        args.catalogEnums.publicModelCategory.BEST,
      ],
      qualityTier: 4,
      speedTier: 4,
      costTier: 3,
      recommendedUseCases: ["production_chat", "coding", "reasoning"],
      isRecommended: true,
      isGlobalDefault: false,
      isCategoryDefault: false,
      pricing: args.pricingPerMillionTokens({
        input: 2.5,
        cachedInput: 0.25,
        output: 15.0,
        tiers: [
          {
            name: "long_context",
            condition: "Long context",
            input: 5.0,
            cachedInput: 0.5,
            output: 22.5,
          },
        ],
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "OpenAI provider validated text/image/audio/video/document inputParts for INLINE, URL, and ASSET sources on gpt-5.4 via the corrected one-model multimodal curator with a clean 15/15 matrix.",
          updatedAt: "2026-06-16",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-16",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.4-2026-03-05",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "OpenAI provider validated text/image/audio/video/document inputParts for INLINE, URL, and ASSET sources on gpt-5.4-2026-03-05 via the corrected one-model multimodal curator with a clean 15/15 matrix.",
          updatedAt: "2026-06-16",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-16",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.4-mini",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      tokenUsageCovered: true,
      publicName: "DCDR Fast",
      badge: "OpenAI",
      primaryCategory: args.catalogEnums.publicModelCategory.FAST,
      categories: [
        args.catalogEnums.publicModelCategory.FAST,
        args.catalogEnums.publicModelCategory.ECONOMY,
      ],
      qualityTier: 3,
      speedTier: 5,
      costTier: 4,
      recommendedUseCases: ["interactive_chat", "support", "rewriting"],
      isRecommended: false,
      isGlobalDefault: false,
      isCategoryDefault: true,
      pricing: args.pricingPerMillionTokens({
        input: 0.75,
        cachedInput: 0.075,
        output: 4.5,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.4-mini-2026-03-17",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.4-nano",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      tokenUsageCovered: true,
      publicName: "DCDR Economy",
      badge: "OpenAI",
      primaryCategory: args.catalogEnums.publicModelCategory.ECONOMY,
      categories: [args.catalogEnums.publicModelCategory.ECONOMY],
      qualityTier: 2,
      speedTier: 5,
      costTier: 5,
      recommendedUseCases: [
        "high_volume_extraction",
        "classification",
        "rewriting",
      ],
      isRecommended: false,
      isGlobalDefault: false,
      isCategoryDefault: false,
      pricing: args.pricingPerMillionTokens({
        input: 0.2,
        cachedInput: 0.02,
        output: 1.25,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.4-nano-2026-03-17",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.4-pro",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 30.0,
        output: 180.0,
        tiers: [
          {
            name: "long_context",
            condition: "Long context",
            input: 60.0,
            output: 270.0,
          },
        ],
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "OpenAI provider validated text/image/audio/video/document inputParts for INLINE, URL, and ASSET sources on gpt-5.4-pro via the corrected one-model multimodal curator with a clean 15/15 matrix.",
          updatedAt: "2026-06-16",
        },
        reason:
          "OpenAI responses-only model (not supported on /v1/chat/completions)",
        updatedAt: "2026-06-16",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.4-pro-2026-03-05",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason:
          "OpenAI responses-only model (not supported on /v1/chat/completions)",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },

    // --- gpt-5.3 (discovered; priced) ---
    {
      id: "gpt-5.3-chat-latest",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.75,
        cachedInput: 0.175,
        output: 14.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.3-codex",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.75,
        cachedInput: 0.175,
        output: 14.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },

    // --- gpt-5.2 (base IDs are priced; aliases discovered) ---
    {
      id: "gpt-5.2",
      types: [
        IntentType.CHAT,
        IntentType.MULTIMODAL,
        IntentType.IMAGE_ANALYSIS,
      ],
      pricing: args.pricingPerMillionTokens({
        input: 1.75,
        cachedInput: 0.175,
        output: 14.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.2-2025-12-11",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.2-chat-latest",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.75,
        cachedInput: 0.175,
        output: 14.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.2-codex",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.75,
        cachedInput: 0.175,
        output: 14.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.2-pro",
      types: [
        IntentType.CHAT,
        IntentType.MULTIMODAL,
        IntentType.IMAGE_ANALYSIS,
      ],
      pricing: args.pricingPerMillionTokens({
        input: 21.0,
        output: 168.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason:
          "OpenAI responses-only model (not supported on /v1/chat/completions)",
        updatedAt: "2026-06-16",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.2-pro-2025-12-11",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason:
          "OpenAI responses-only model (not supported on /v1/chat/completions)",
        updatedAt: "2026-06-16",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },

    // --- gpt-5.1 (base ID is priced; aliases discovered) ---
    {
      id: "gpt-5.1",
      types: [
        IntentType.CHAT,
        IntentType.MULTIMODAL,
        IntentType.IMAGE_ANALYSIS,
      ],
      pricing: args.pricingPerMillionTokens({
        input: 1.25,
        cachedInput: 0.125,
        output: 10.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.1-2025-11-13",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.1-chat-latest",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.25,
        cachedInput: 0.125,
        output: 10.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline: image, audio, video, and document pass across INLINE, URL, and ASSET; text passes URL only (INLINE and ASSET return sawProvidedInput=false), so the promoted rectangle excludes text.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.1-codex",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.25,
        cachedInput: 0.125,
        output: 10.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline: image and document pass across INLINE, URL, and ASSET, audio passes for INLINE and ASSET but fails for URL, text only passes for ASSET, and video fails across all three sources, so the promoted rectangle remains image/audio/document over the shared three-source surface.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.1-codex-max",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.25,
        cachedInput: 0.125,
        output: 10.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline: image, audio, video, and document pass across INLINE, URL, and ASSET, while text only passes for INLINE and ASSET because URL still returns an empty Responses output, so the promoted rectangle excludes text.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5.1-codex-mini",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.25,
        cachedInput: 0.125,
        output: 10.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },

    // --- gpt-5.0 (base IDs are priced; aliases discovered) ---
    {
      id: "gpt-5",
      types: [
        IntentType.CHAT,
        IntentType.MULTIMODAL,
        IntentType.IMAGE_ANALYSIS,
      ],
      pricing: args.pricingPerMillionTokens({
        input: 1.25,
        cachedInput: 0.125,
        output: 10.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.AUDIO, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "One-model multimodal recuration on gpt-5 on 2026-06-28 still shows a mixed Responses-path matrix after tightening the gpt-5-family curator prompt and budget, so the published rectangle stays conservative but now expands to AUDIO and DOCUMENT across INLINE/URL/ASSET. Current evidence: AUDIO and DOCUMENT pass across all three source kinds; TEXT passes on URL and ASSET but still fails on INLINE; IMAGE passes on INLINE and ASSET but fails on URL; VIDEO still fails across INLINE/URL/ASSET with PROVIDER_EMPTY_RESPONSE.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5-2025-08-07",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "One-model multimodal recuration on gpt-5-2025-08-07 on 2026-06-28 with the 1024-token baseline shows a near-complete matrix. IMAGE, AUDIO, VIDEO, and DOCUMENT all pass across INLINE/URL/ASSET. TEXT passes on INLINE but still fails on URL and ASSET with PROVIDER_EMPTY_RESPONSE, so the published rectangle stays conservative at the fully validated four-asset subset.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5-chat-latest",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.25,
        cachedInput: 0.125,
        output: 10.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5-codex",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.25,
        cachedInput: 0.125,
        output: 10.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "One-model multimodal recuration on gpt-5-codex on 2026-06-28 still shows a mixed matrix, so the published rectangle stays conservative at IMAGE/AUDIO/DOCUMENT across INLINE/URL/ASSET. Current evidence: IMAGE, AUDIO, and DOCUMENT pass across all three source kinds; TEXT passes on URL and ASSET but not INLINE; VIDEO passes on INLINE but not URL or ASSET.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5-mini",
      types: [
        IntentType.CHAT,
        IntentType.MULTIMODAL,
        IntentType.IMAGE_ANALYSIS,
      ],
      pricing: args.pricingPerMillionTokens({
        input: 0.25,
        cachedInput: 0.025,
        output: 2.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5-mini-2025-08-07",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5-nano",
      types: [
        IntentType.CHAT,
        IntentType.MULTIMODAL,
        IntentType.IMAGE_ANALYSIS,
      ],
      pricing: args.pricingPerMillionTokens({
        input: 0.05,
        cachedInput: 0.005,
        output: 0.4,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "OpenAI provider validated text/image/audio/video/document inputParts for INLINE, URL, and ASSET sources on gpt-5-nano via the corrected one-model multimodal curator with the 1024-token baseline and a clean 15/15 matrix.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5-nano-2025-08-07",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "OpenAI provider validated text/image/audio/video/document inputParts for INLINE, URL, and ASSET sources on gpt-5-nano-2025-08-07 via the corrected one-model multimodal curator with the 1024-token baseline and a clean 15/15 matrix.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5-pro",
      types: [
        IntentType.CHAT,
        IntentType.MULTIMODAL,
        IntentType.IMAGE_ANALYSIS,
      ],
      pricing: args.pricingPerMillionTokens({
        input: 15.0,
        output: 120.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "One-model multimodal recuration on gpt-5-pro on 2026-06-28 still shows a mixed matrix, so the published rectangle stays conservative at IMAGE/AUDIO/VIDEO/DOCUMENT across INLINE/URL/ASSET. TEXT still fails across all three source kinds with PROVIDER_EMPTY_RESPONSE.",
          updatedAt: "2026-06-28",
        },
        reason:
          "OpenAI responses-only model (not supported on /v1/chat/completions)",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5-pro-2025-10-06",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "One-model multimodal recuration on gpt-5-pro-2025-10-06 on 2026-06-28 still shows a mixed matrix, so the published rectangle stays conservative at IMAGE/AUDIO/VIDEO/DOCUMENT across INLINE/URL/ASSET. TEXT still fails across all three source kinds with PROVIDER_EMPTY_RESPONSE.",
          updatedAt: "2026-06-28",
        },
        reason:
          "OpenAI responses-only model (not supported on /v1/chat/completions)",
        updatedAt: "2026-06-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5-search-api",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        reason:
          "Not supported by runtime: upstream 5xx on basic calls; structured json_schema not supported",
        updatedAt: "2026-04-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },
    {
      id: "gpt-5-search-api-2025-10-14",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        reason:
          "Not supported by runtime: upstream 5xx on basic calls; structured json_schema not supported",
        updatedAt: "2026-04-28",
      },
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
    },

    {
      id: "gpt-4.1",
      types: [
        IntentType.CHAT,
        IntentType.MULTIMODAL,
        IntentType.IMAGE_ANALYSIS,
      ],
      pricing: args.pricingPerMillionTokens({
        input: 2.0,
        cachedInput: 0.5,
        output: 8.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 via Chat Completions path: text, image, and document pass across INLINE, URL, and ASSET; audio and video fail with upstream 400 (Chat Completions does not support those modalities on this model).",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "gpt-4.1-2025-04-14",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 via Chat Completions path: text, image, and document pass across INLINE, URL, and ASSET; audio and video fail with upstream 400 (Chat Completions does not support those modalities on this model).",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "gpt-4.1-mini",
      types: [
        IntentType.CHAT,
        IntentType.MULTIMODAL,
        IntentType.IMAGE_ANALYSIS,
      ],
      pricing: args.pricingPerMillionTokens({
        input: 0.4,
        cachedInput: 0.1,
        output: 1.6,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 via Chat Completions path: text, image, and document pass across INLINE, URL, and ASSET; audio and video fail with upstream 400 (Chat Completions does not support those modalities on this model).",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "gpt-4.1-mini-2025-04-14",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 via Chat Completions path: text, image, and document pass across INLINE, URL, and ASSET; audio and video fail with upstream 400 (Chat Completions does not support those modalities on this model).",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "gpt-4.1-nano",
      types: [
        IntentType.CHAT,
        IntentType.MULTIMODAL,
        IntentType.IMAGE_ANALYSIS,
      ],
      pricing: args.pricingPerMillionTokens({
        input: 0.1,
        cachedInput: 0.025,
        output: 0.4,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 via Chat Completions path: text, image, and document pass across INLINE, URL, and ASSET; audio and video fail with upstream 400 (Chat Completions does not support those modalities on this model).",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "gpt-4.1-nano-2025-04-14",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 via Chat Completions path: text, image, and document pass across INLINE, URL, and ASSET; audio and video fail with upstream 400 (Chat Completions does not support those modalities on this model).",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-28",
      },
    },

    {
      id: "gpt-4o",
      types: [
        IntentType.CHAT,
        IntentType.MULTIMODAL,
        IntentType.IMAGE_ANALYSIS,
      ],
      pricing: args.pricingPerMillionTokens({
        input: 2.5,
        cachedInput: 1.25,
        output: 10.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 via Chat Completions path: text, image, and document pass across INLINE, URL, and ASSET; audio and video fail with upstream 400 (Chat Completions does not support those modalities on this model).",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "gpt-4o-2024-08-06",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 via Chat Completions path: text, image, and document pass across INLINE, URL, and ASSET; audio and video fail with upstream 400 (Chat Completions does not support those modalities on this model).",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "gpt-4o-2024-11-20",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 via Chat Completions path: text, image, and document pass across INLINE, URL, and ASSET; audio and video fail with upstream 400 (Chat Completions does not support those modalities on this model).",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "gpt-4o-search-preview",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        reason: "Search-preview family is not supported by runtime v1",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-4o-search-preview-2025-03-11",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        reason: "Search-preview family is not supported by runtime v1",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-4o-mini",
      types: [
        IntentType.CHAT,
        IntentType.MULTIMODAL,
        IntentType.IMAGE_ANALYSIS,
      ],
      pricing: args.pricingPerMillionTokens({
        input: 0.15,
        cachedInput: 0.075,
        output: 0.6,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 via Chat Completions path: text, image, and document pass across INLINE, URL, and ASSET; audio and video fail with upstream 400 (Chat Completions does not support those modalities on this model).",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "gpt-4o-mini-2024-07-18",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 via Chat Completions path: text, image, and document pass across INLINE, URL, and ASSET; audio and video fail with upstream 400 (Chat Completions does not support those modalities on this model).",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "gpt-4o-mini-search-preview",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        reason: "Search-preview family is not supported by runtime v1",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-4o-mini-search-preview-2025-03-11",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        reason: "Search-preview family is not supported by runtime v1",
        updatedAt: "2026-05-22",
      },
    },

    {
      id: "gpt-4o-2024-05-13",
      types: [
        IntentType.CHAT,
        IntentType.MULTIMODAL,
        IntentType.IMAGE_ANALYSIS,
      ],
      pricing: args.pricingPerMillionTokens({
        input: 5.0,
        output: 15.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.FAILING,
          notes:
            "One-model multimodal recuration on gpt-4o-2024-05-13 still shows a fully failing matrix and is intentionally not promoted as supported on this exact entry: all text, image, audio, video, and document combinations failed with PARSE_FAIL across INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-16",
        },
        reason: "Validated via provider E2E (structured uses prompt-only JSON)",
        updatedAt: "2026-06-16",
      },
      parameterSupport: {
        parameters: {
          [args.catalogEnums.promptParameterKey.RESPONSE_FORMAT]:
            args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
        },
        notes:
          "This model version rejects response_format=json_schema; use prompt-only JSON + local parse.",
        updatedAt: "2026-04-28",
      },
    },
    {
      id: "gpt-4-turbo",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 10.0,
        output: 30.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.FAILING,
          notes:
            "One-model multimodal recuration on gpt-4-turbo still shows a fully failing matrix and is intentionally not promoted as supported on this exact entry: all text, image, audio, video, and document combinations failed with PARSE_FAIL across INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-16",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-16",
      },
    },
    {
      id: "gpt-4-turbo-2024-04-09",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 10.0,
        output: 30.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.FAILING,
          notes:
            "One-model multimodal recuration on gpt-4-turbo-2024-04-09 still shows a fully failing matrix and is intentionally not promoted as supported on this exact entry: all text, image, audio, video, and document combinations failed with PARSE_FAIL across INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-16",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-16",
      },
    },
    {
      id: "gpt-4",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 30.0,
        output: 60.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.FAILING,
          notes:
            "One-model multimodal recuration on gpt-4 still shows a fully failing matrix and is intentionally not promoted as supported on this exact entry: all image/audio/video/document combinations plus text INLINE/URL failed with PARSE_FAIL, and text ASSET failed with a provider-side missing-object error for the managed fixture path.",
          updatedAt: "2026-06-16",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-16",
      },
    },
    {
      id: "gpt-4-0613",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 30.0,
        output: 60.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.FAILING,
          notes:
            "One-model multimodal recuration on gpt-4-0613 still shows a fully failing matrix and is intentionally not promoted as supported on this exact entry: all text/image/audio/document combinations plus video INLINE/URL failed with PARSE_FAIL, and video ASSET failed with a provider-side missing-object error for the managed fixture path.",
          updatedAt: "2026-06-16",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-16",
      },
    },

    {
      id: "gpt-3.5-turbo",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 0.5,
        output: 1.5,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.FAILING,
          notes:
            "One-model multimodal recuration on gpt-3.5-turbo still shows a fully failing matrix and is intentionally not promoted as supported on this exact entry: all text, image, audio, video, and document combinations failed with PARSE_FAIL across INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-16",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-16",
      },
    },
    {
      id: "gpt-3.5-turbo-0125",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 0.5,
        output: 1.5,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.FAILING,
          notes:
            "One-model multimodal recuration on gpt-3.5-turbo-0125 still shows a fully failing matrix and is intentionally not promoted as supported on this exact entry: all text, image, audio, video, and document combinations failed with PARSE_FAIL across INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-16",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-16",
      },
    },
    {
      id: "gpt-3.5-turbo-1106",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.0,
        output: 2.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.FAILING,
          notes:
            "One-model multimodal recuration on gpt-3.5-turbo-1106 still shows a fully failing matrix and is intentionally not promoted as supported on this exact entry: all text/image/audio combinations plus video INLINE/URL/ASSET and document INLINE/URL failed with PARSE_FAIL, and document ASSET failed with a provider-side missing-object error for the managed fixture path.",
          updatedAt: "2026-06-16",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-16",
      },
    },
    {
      id: "gpt-3.5-turbo-16k",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 3.0,
        output: 4.0,
        sourceUrl: OPENAI_PRICING_URL,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.CHAT_COMPLETIONS,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.FAILING,
          notes:
            "One-model multimodal recuration on gpt-3.5-turbo-16k still shows a fully failing matrix and is intentionally not promoted as supported on this exact entry: all text, image, audio, video, and document combinations failed with PARSE_FAIL across INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-16",
        },
        reason: "Validated via provider E2E",
        updatedAt: "2026-06-16",
      },
    },

    // --- o-series (reasoning; exposed in /v1/models as o*) ---
    {
      id: "o4-mini",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.1,
        cachedInput: 0.275,
        output: 4.4,
        sourceUrl: OPENAI_PRICING_URL,
        notes: "Reasoning-family model",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "o4-mini-2025-04-16",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "o4-mini-deep-research",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        reason:
          "Deep-research family requires specialized tool wiring (not supported in runtime v1)",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "o4-mini-deep-research-2025-06-26",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        reason:
          "Deep-research family requires specialized tool wiring (not supported in runtime v1)",
        updatedAt: "2026-05-22",
      },
    },

    {
      id: "o3-pro",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 20.0,
        output: 80.0,
        sourceUrl: OPENAI_PRICING_URL,
        notes: "Reasoning-family model",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "o3-pro-2025-06-10",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "o3",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 2.0,
        cachedInput: 0.5,
        output: 8.0,
        sourceUrl: OPENAI_PRICING_URL,
        notes: "Reasoning-family model",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "o3-2025-04-16",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "o3-deep-research",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        reason:
          "Deep-research family requires specialized tool wiring (not supported in runtime v1)",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "o3-deep-research-2025-06-26",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        reason:
          "Deep-research family requires specialized tool wiring (not supported in runtime v1)",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "o3-mini",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.1,
        cachedInput: 0.55,
        output: 4.4,
        sourceUrl: OPENAI_PRICING_URL,
        notes: "Reasoning-family model",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 via Responses path: text, audio, video, and document pass across INLINE, URL, and ASSET; image fails with upstream 400 on all three sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "o3-mini-2025-01-31",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 via Responses path: text, audio, video, and document pass across INLINE, URL, and ASSET; image fails with upstream 400 on all three sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
    },

    {
      id: "o1-pro",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 150.0,
        output: 600.0,
        sourceUrl: OPENAI_PRICING_URL,
        notes: "Reasoning-family model",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "o1-pro-2025-03-19",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "o1",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 15.0,
        cachedInput: 7.5,
        output: 60.0,
        sourceUrl: OPENAI_PRICING_URL,
        notes: "Reasoning-family model",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
    },
    {
      id: "o1-mini",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.1,
        cachedInput: 0.55,
        output: 4.4,
        sourceUrl: OPENAI_PRICING_URL,
        notes: "Reasoning-family model",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.FAILING,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        reason:
          "Provider E2E: OpenAI returned model_not_found (account/region gated or retired for this key)",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "o1-2024-12-17",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.AUDIO,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token multimodal baseline and confirmed a clean 15/15 matrix across text/image/audio/video/document inputs for INLINE, URL, and ASSET sources.",
          updatedAt: "2026-06-28",
        },
        reason: "Validated via provider E2E; routed via OpenAI Responses API",
        updatedAt: "2026-06-28",
      },
    },

    // Other OpenAI models (pricing varies by endpoint/unit; fill as needed)
    { id: "text-embedding-3-small", types: [IntentType.EMBEDDING] },
    { id: "text-embedding-3-large", types: [IntentType.EMBEDDING] },
    { id: "text-embedding-ada-002", types: [IntentType.EMBEDDING] },

    {
      id: "gpt-image-1",
      types: [IntentType.IMAGE_GENERATION],
      pricing: args.pricingPerMillionTokens({
        // OpenAI pricing table (standard) exposes per-modality rows; this entry captures the Image modality.
        input: 10,
        cachedInput: 2.5,
        output: 40,
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260522,
        notes:
          "Image modality pricing from OpenAI table; text-row output is '-'",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; runtime v1 does not yet implement image generation adapters",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-image-1.5",
      types: [IntentType.IMAGE_GENERATION],
      pricing: args.pricingPerMillionTokens({
        input: 8,
        cachedInput: 2,
        output: 32,
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260522,
        notes: "Image modality pricing from OpenAI table",
      }),
    },
    {
      id: "gpt-image-1-mini",
      types: [IntentType.IMAGE_GENERATION],
      pricing: args.pricingPerMillionTokens({
        input: 2.5,
        cachedInput: 0.25,
        output: 8,
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260522,
        notes:
          "Image modality pricing from OpenAI table; text-row output is '-'",
      }),
    },
    {
      id: "gpt-image-2",
      types: [IntentType.IMAGE_GENERATION],
      pricing: args.pricingPerMillionTokens({
        input: 8,
        cachedInput: 2,
        output: 30,
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260522,
        notes:
          "Image modality pricing from OpenAI table; text-row output is '-'",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; runtime v1 does not yet implement image generation adapters",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-image-2-2026-04-21",
      types: [IntentType.IMAGE_GENERATION],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; runtime v1 does not yet implement image generation adapters",
        updatedAt: "2026-05-22",
      },
    },
    { id: "dall-e-3", types: [IntentType.IMAGE_GENERATION] },
    { id: "dall-e-2", types: [IntentType.IMAGE_GENERATION] },

    { id: "gpt-4o-transcribe", types: [IntentType.SPEECH_TO_TEXT] },
    { id: "gpt-4o-mini-transcribe", types: [IntentType.SPEECH_TO_TEXT] },
    {
      id: "gpt-4o-mini-transcribe-2025-03-20",
      types: [IntentType.SPEECH_TO_TEXT],
    },
    {
      id: "gpt-4o-mini-transcribe-2025-12-15",
      types: [IntentType.SPEECH_TO_TEXT],
    },
    { id: "gpt-4o-transcribe-diarize", types: [IntentType.SPEECH_TO_TEXT] },
    { id: "whisper-1", types: [IntentType.SPEECH_TO_TEXT] },

    { id: "gpt-4o-mini-tts", types: [IntentType.TEXT_TO_SPEECH] },
    { id: "gpt-4o-mini-tts-2025-03-20", types: [IntentType.TEXT_TO_SPEECH] },
    { id: "gpt-4o-mini-tts-2025-12-15", types: [IntentType.TEXT_TO_SPEECH] },
    { id: "tts-1", types: [IntentType.TEXT_TO_SPEECH] },
    { id: "tts-1-hd", types: [IntentType.TEXT_TO_SPEECH] },

    {
      id: "gpt-audio",
      types: [IntentType.MULTIMODAL],
      pricing: args.pricingPerMillionTokens({
        // Base = Text modality; audio modality captured as a tier.
        input: 2.5,
        output: 10,
        tiers: [
          { name: "audio", condition: "Audio modality", input: 32, output: 64 },
        ],
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260522,
        notes:
          "OpenAI pricing table provides separate Text/Audio modality rows; cached input is '-'",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; runtime v1 does not yet implement audio/multimodal adapters",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-audio-1.5",
      types: [IntentType.MULTIMODAL],
      pricing: args.pricingPerMillionTokens({
        input: 2.5,
        output: 10,
        tiers: [
          { name: "audio", condition: "Audio modality", input: 32, output: 64 },
        ],
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260522,
        notes:
          "OpenAI pricing table provides separate Text/Audio modality rows; cached input is '-'",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; runtime v1 does not yet implement audio/multimodal adapters",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-audio-2025-08-28",
      types: [IntentType.MULTIMODAL],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; runtime v1 does not yet implement audio/multimodal adapters",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-audio-mini",
      types: [IntentType.MULTIMODAL],
      pricing: args.pricingPerMillionTokens({
        input: 0.6,
        output: 2.4,
        tiers: [
          { name: "audio", condition: "Audio modality", input: 10, output: 20 },
        ],
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260522,
        notes:
          "OpenAI pricing table provides separate Text/Audio modality rows; cached input is '-'",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; runtime v1 does not yet implement audio/multimodal adapters",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-audio-mini-2025-10-06",
      types: [IntentType.MULTIMODAL],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; runtime v1 does not yet implement audio/multimodal adapters",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-audio-mini-2025-12-15",
      types: [IntentType.MULTIMODAL],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; runtime v1 does not yet implement audio/multimodal adapters",
        updatedAt: "2026-05-22",
      },
    },

    {
      id: "gpt-realtime",
      types: [IntentType.MULTIMODAL],
      pricing: args.pricingPerMillionTokens({
        // Base = Text modality; audio modality captured as a tier.
        input: 4,
        cachedInput: 0.4,
        output: 16,
        tiers: [
          {
            name: "audio",
            condition: "Audio modality",
            input: 32,
            cachedInput: 0.4,
            output: 64,
          },
        ],
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260522,
        notes:
          "OpenAI pricing table provides separate Text/Audio modality rows",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; realtime adapters not implemented in runtime v1",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-realtime-2",
      types: [IntentType.MULTIMODAL],
      pricing: args.pricingPerMillionTokens({
        input: 4,
        cachedInput: 0.4,
        output: 24,
        tiers: [
          {
            name: "audio",
            condition: "Audio modality",
            input: 32,
            cachedInput: 0.4,
            output: 64,
          },
        ],
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260522,
        notes:
          "OpenAI pricing table provides separate Text/Audio modality rows",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; realtime adapters not implemented in runtime v1",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-realtime-2025-08-28",
      types: [IntentType.MULTIMODAL],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; realtime adapters not implemented in runtime v1",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-realtime-1.5",
      types: [IntentType.MULTIMODAL],
      pricing: args.pricingPerMillionTokens({
        input: 4,
        cachedInput: 0.4,
        output: 16,
        tiers: [
          {
            name: "audio",
            condition: "Audio modality",
            input: 32,
            cachedInput: 0.4,
            output: 64,
          },
        ],
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260522,
        notes:
          "OpenAI pricing table provides separate Text/Audio modality rows",
      }),
    },
    {
      id: "gpt-realtime-mini",
      types: [IntentType.MULTIMODAL],
      pricing: args.pricingPerMillionTokens({
        input: 0.6,
        cachedInput: 0.3,
        output: 2.4,
        tiers: [
          { name: "audio", condition: "Audio modality", input: 10, output: 20 },
        ],
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260522,
        notes:
          "OpenAI pricing table provides separate Text/Audio modality rows; audio row has no cached input",
      }),
    },
    {
      id: "gpt-realtime-mini-2025-10-06",
      types: [IntentType.MULTIMODAL],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; realtime adapters not implemented in runtime v1",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-realtime-mini-2025-12-15",
      types: [IntentType.MULTIMODAL],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; realtime adapters not implemented in runtime v1",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-realtime-translate",
      types: [IntentType.MULTIMODAL],
      pricing: args.pricingAudioMinutesPerMinute({
        input: 0.034,
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260522,
        notes: "OpenAI pricing table: $0.034 / minute",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; realtime adapters not implemented in runtime v1",
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gpt-realtime-whisper",
      types: [IntentType.MULTIMODAL],
      pricing: args.pricingAudioMinutesPerMinute({
        input: 0.017,
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260522,
        notes: "OpenAI pricing table: $0.017 / minute",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via /v1/models; realtime adapters not implemented in runtime v1",
        updatedAt: "2026-05-22",
      },
    },
  ];
}

/**
 * Returns the E2E override map for OpenAI provider models.
 */
export function buildOpenAIProviderModelE2EOverrides(
  args: ProviderCatalogModuleBuildArgs,
): Record<string, ProviderModelE2EOverride> {
  return {
    // Not chat-completions models (will 404 on /v1/chat/completions)
    "babbage-002": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Not a chat-completions model",
    },
    "davinci-002": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Not a chat-completions model",
    },
    "gpt-3.5-turbo-instruct": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Not a chat-completions model",
    },
    "gpt-3.5-turbo-instruct-0914": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Not a chat-completions model",
    },

    // Listed in some OpenAI pricing/docs snapshots but not visible/callable for many accounts (model_not_found).
    "o1-mini": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Listed but not callable for many accounts (model_not_found)",
    },

    // OpenAI lists moderation-only models under /v1/models; runtime does not expose a moderation intent type.
    "omni-moderation-latest": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Moderation-only model (no IntentType mapping in runtime)",
    },
    "omni-moderation-2024-09-26": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Moderation-only model (no IntentType mapping in runtime)",
    },
  };
}




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
const OPENAI_PRICING_UPDATED_AT_20260905 = Date.UTC(2026, 8, 5);

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

    // --- Discovered on the 2026-09-05 /v1/models sync ---
    {
      id: "gpt-6-astra",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
      pricing: args.pricingPerMillionTokens({
        input: 10.0,
        cachedInput: 1.0,
        output: 50.0,
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E on 2026-09-05 (text + structured).",
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
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
            "Re-measured on 2026-09-05 with the unified comprehension-grade curator (RM-050/RM-051): one shared cue definition, one prompt per asset family and a 1024-token budget across every provider, so this rectangle means the same thing as every other provider's. AUDIO and VIDEO fail on every source kind (\"audible content unavailable for inspection\").",
          updatedAt: "2026-09-05",
        },
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "gpt-5.6-sol",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      publicName: "DCDR Best",
      badge: "OpenAI",
      primaryCategory: args.catalogEnums.publicModelCategory.BEST,
      categories: [args.catalogEnums.publicModelCategory.BEST],
      qualityTier: 5,
      speedTier: 3,
      costTier: 2,
      recommendedUseCases: ["reasoning", "agentic_coding"],
      isRecommended: false,
      isGlobalDefault: false,
      isCategoryDefault: true,
      tokenUsageCovered: true,
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
      pricing: args.pricingPerMillionTokens({
        input: 4.0,
        cachedInput: 0.4,
        output: 20.0,
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E on 2026-09-05 (text + structured).",
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
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
            "Re-measured on 2026-09-05 with the unified comprehension-grade curator (RM-050/RM-051): one shared cue definition, one prompt per asset family and a 1024-token budget across every provider, so this rectangle means the same thing as every other provider's. AUDIO and VIDEO fail on every source kind, and the model says so itself (\"Audible content could not be determined\"), so the failure is an honest refusal rather than a hallucination.",
          updatedAt: "2026-09-05",
        },
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "gpt-5.6-terra",
      types: [IntentType.CHAT],
      publicForCustomers: true,
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
      recommendedUseCases: ["production_chat", "reasoning"],
      isRecommended: true,
      isGlobalDefault: false,
      isCategoryDefault: false,
      tokenUsageCovered: true,
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
      pricing: args.pricingPerMillionTokens({
        input: 2.0,
        cachedInput: 0.2,
        output: 12.0,
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E on 2026-09-05 (text + structured).",
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
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
            "Re-measured on 2026-09-05 with the unified comprehension-grade curator (RM-050/RM-051): one shared cue definition, one prompt per asset family and a 1024-token budget across every provider, so this rectangle means the same thing as every other provider's. AUDIO and VIDEO fail on every source kind; the model only acknowledges the file (\"An MP3 audio file is present.\") without perceiving its content.",
          updatedAt: "2026-09-05",
        },
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "gpt-5.6-luna",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      publicName: "DCDR Fast",
      badge: "OpenAI",
      primaryCategory: args.catalogEnums.publicModelCategory.FAST,
      categories: [
        args.catalogEnums.publicModelCategory.FAST,
        args.catalogEnums.publicModelCategory.ECONOMY,
      ],
      qualityTier: 3,
      speedTier: 5,
      costTier: 5,
      recommendedUseCases: ["interactive_chat", "classification", "support"],
      isRecommended: false,
      isGlobalDefault: false,
      isCategoryDefault: true,
      tokenUsageCovered: true,
      parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT,
      pricing: args.pricingPerMillionTokens({
        input: 0.2,
        cachedInput: 0.02,
        output: 1.2,
        sourceUrl: OPENAI_PRICING_URL,
        updatedAt: OPENAI_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E on 2026-09-05 (text + structured).",
        preferredApi: args.catalogEnums.preferredApi.RESPONSES,
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
            "Re-measured on 2026-09-05 with the unified comprehension-grade curator (RM-050/RM-051): one shared cue definition, one prompt per asset family and a 1024-token budget across every provider, so this rectangle means the same thing as every other provider's. AUDIO and VIDEO fail on every source kind; the model reports the input as present but states its content is unavailable for inspection.",
          updatedAt: "2026-09-05",
        },
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "gpt-realtime-2.1",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via OpenAI /v1/models on 2026-09-05; this family is outside the current runtime CHAT surface and has no adapter yet.",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "gpt-realtime-2.1-mini",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via OpenAI /v1/models on 2026-09-05; this family is outside the current runtime CHAT surface and has no adapter yet.",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "gpt-live-transcribe",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via OpenAI /v1/models on 2026-09-05; this family is outside the current runtime CHAT surface and has no adapter yet.",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "gpt-transcribe",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via OpenAI /v1/models on 2026-09-05; this family is outside the current runtime CHAT surface and has no adapter yet.",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "chatgpt-image-latest",
      types: [IntentType.IMAGE_GENERATION],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via OpenAI /v1/models on 2026-09-05; this family is outside the current runtime CHAT surface and has no adapter yet.",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "omni-moderation-latest",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via OpenAI /v1/models on 2026-09-05; this family is outside the current runtime CHAT surface and has no adapter yet.",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "omni-moderation-2024-09-26",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via OpenAI /v1/models on 2026-09-05; this family is outside the current runtime CHAT surface and has no adapter yet.",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "gpt-3.5-turbo-instruct",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via OpenAI /v1/models on 2026-09-05; this family is outside the current runtime CHAT surface and has no adapter yet.",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "gpt-3.5-turbo-instruct-0914",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via OpenAI /v1/models on 2026-09-05; this family is outside the current runtime CHAT surface and has no adapter yet.",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "tts-1-1106",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via OpenAI /v1/models on 2026-09-05; this family is outside the current runtime CHAT surface and has no adapter yet.",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "tts-1-hd-1106",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via OpenAI /v1/models on 2026-09-05; this family is outside the current runtime CHAT surface and has no adapter yet.",
        updatedAt: "2026-09-05",
      },
    },
    // --- gpt-5.5 (discovered; priced) ---
    {
      id: "gpt-5.5",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
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
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-09-05 with the comprehension-grade OpenAI curator (RM-050). TEXT, IMAGE and DOCUMENT pass across INLINE/URL/ASSET. AUDIO and VIDEO fail the canonical comprehension cues on every source kind. The previous 15/15 claim came from the transport-only curator, which accepted sawProvidedInput=true as proof of support, so it was never backed by comprehension evidence.",
          updatedAt: "2026-09-05",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
      tokenUsageCovered: true,
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
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-09-05 with the comprehension-grade OpenAI curator (RM-050). IMAGE and DOCUMENT pass across INLINE/URL/ASSET. TEXT passes only on URL and is excluded because runtimeSupport.inputParts cannot express a per-asset source-kind subset without overstating support. AUDIO and VIDEO fail the canonical comprehension cues on every source kind. The previous claim came from the transport-only curator and was never backed by comprehension evidence.",
          updatedAt: "2026-09-05",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
      tokenUsageCovered: true,
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
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-09-05 with the comprehension-grade OpenAI curator (RM-050). TEXT, IMAGE and DOCUMENT pass across INLINE/URL/ASSET. AUDIO and VIDEO fail the canonical comprehension cues on every source kind. The previous 15/15 claim came from the transport-only curator, which accepted sawProvidedInput=true as proof of support, so it was never backed by comprehension evidence.",
          updatedAt: "2026-09-05",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-measured on 2026-09-05 with the unified comprehension-grade curator (RM-050/RM-051): one shared cue definition, one prompt per asset family and a 1024-token budget across every provider, so this rectangle means the same thing as every other provider's. TEXT passes INLINE but returns no comprehensionEcho on URL and ASSET, so it is excluded rather than published as a partial rectangle. AUDIO and VIDEO fail on every source kind: the model echoes the file metadata (\"An audio file was provided (sample.mp3, audio/mpeg).\") without perceiving content.",
          updatedAt: "2026-09-05",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
          supportedAssetTypes: [AssetType.AUDIO, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
            "Re-measured on 2026-09-06 with the unified comprehension-grade curator (RM-050/RM-051), replacing the transport-only claim that only proved the input arrived. TEXT, IMAGE and DOCUMENT pass across INLINE/URL/ASSET. AUDIO and VIDEO fail the canonical comprehension cues on every source kind.",
          updatedAt: "2026-09-06",
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
            "Re-measured on 2026-09-06 with the unified comprehension-grade curator (RM-050/RM-051), replacing the transport-only claim that only proved the input arrived. TEXT, IMAGE and DOCUMENT pass across INLINE/URL/ASSET. AUDIO and VIDEO fail the canonical comprehension cues on every source kind.",
          updatedAt: "2026-09-06",
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
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-measured on 2026-09-06 with the unified comprehension-grade curator (RM-050/RM-051), replacing the transport-only claim that only proved the input arrived. IMAGE and DOCUMENT pass across INLINE/URL/ASSET. TEXT does not pass on all three source kinds and is excluded rather than published as a partial rectangle. AUDIO and VIDEO fail the canonical comprehension cues on every source kind.",
          updatedAt: "2026-09-06",
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
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-measured on 2026-09-06 during the openai 6.42 -> 7.10 bump (RM-046). IMAGE and DOCUMENT pass across INLINE/URL/ASSET. TEXT is withdrawn: the RM-050 claim was measured on a run where the ASSET cell happened to trail the canonical marker into its echo, and it does not reproduce. Under openai 7.10.0 TEXT fails on all three source kinds; the bump was rolled back to 6.42.0 and TEXT failed there too (INLINE and URL fail, ASSET passes), so this is model behaviour, not an SDK regression. The failure mode is that the gpt-4.1-mini family echoes the instruction text instead of the text part, which makes the cell non-deterministic; it never reaches all three source kinds on either SDK version. The gpt-4.1-mini alias is published as IMAGE/DOCUMENT for the same reason. AUDIO and VIDEO fail the canonical comprehension cues on every source kind.",
          updatedAt: "2026-09-06",
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
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-measured on 2026-09-06 with the unified comprehension-grade curator (RM-050/RM-051), replacing the transport-only claim that only proved the input arrived. IMAGE and DOCUMENT pass across INLINE/URL/ASSET. TEXT does not pass on all three source kinds and is excluded rather than published as a partial rectangle. AUDIO and VIDEO fail the canonical comprehension cues on every source kind.",
          updatedAt: "2026-09-06",
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
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-measured on 2026-09-06 with the unified comprehension-grade curator (RM-050/RM-051), replacing the transport-only claim that only proved the input arrived. IMAGE and DOCUMENT pass across INLINE/URL/ASSET. TEXT does not pass on all three source kinds and is excluded rather than published as a partial rectangle. AUDIO and VIDEO fail the canonical comprehension cues on every source kind.",
          updatedAt: "2026-09-06",
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
            "Re-measured on 2026-09-06 with the unified comprehension-grade curator (RM-050/RM-051), replacing the transport-only claim that only proved the input arrived. TEXT, IMAGE and DOCUMENT pass across INLINE/URL/ASSET. AUDIO and VIDEO fail the canonical comprehension cues on every source kind.",
          updatedAt: "2026-09-06",
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
            "Re-measured on 2026-09-06 with the unified comprehension-grade curator (RM-050/RM-051), replacing the transport-only claim that only proved the input arrived. TEXT, IMAGE and DOCUMENT pass across INLINE/URL/ASSET. AUDIO and VIDEO fail the canonical comprehension cues on every source kind.",
          updatedAt: "2026-09-06",
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
            "Re-measured on 2026-09-06 with the unified comprehension-grade curator (RM-050/RM-051), replacing the transport-only claim that only proved the input arrived. TEXT, IMAGE and DOCUMENT pass across INLINE/URL/ASSET. AUDIO and VIDEO fail the canonical comprehension cues on every source kind.",
          updatedAt: "2026-09-06",
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
            "Re-measured on 2026-09-06 with the unified comprehension-grade curator (RM-050/RM-051), replacing the transport-only claim that only proved the input arrived. TEXT, IMAGE and DOCUMENT pass across INLINE/URL/ASSET. AUDIO and VIDEO fail the canonical comprehension cues on every source kind.",
          updatedAt: "2026-09-06",
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
            "Re-measured on 2026-09-06 with the unified comprehension-grade curator (RM-050/RM-051), replacing the transport-only claim that only proved the input arrived. TEXT, IMAGE and DOCUMENT pass across INLINE/URL/ASSET. AUDIO and VIDEO fail the canonical comprehension cues on every source kind.",
          updatedAt: "2026-09-06",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted pending re-curation (RM-050): this rectangle was produced by the transport-only OpenAI curator, which accepted sawProvidedInput=true as proof of support. Every model re-measured on 2026-09-05 with the comprehension-grade curator (nano through flagship) failed AUDIO and VIDEO on all three source kinds, so the AUDIO/VIDEO claim here is contradicted by evidence. The listed asset types are retained only as the prior claim; treat them as unverified until this model is re-curated.",
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
    // Deprecated by OpenAI as of the 2026-09-06 sweep. These ids are still returned by
    // /v1/models, so the listing is not a reliable availability signal on its own: every
    // call 404s, and /v1/chat/completions says so explicitly ("has been deprecated"),
    // while /v1/responses reports the generic "does not exist or you do not have access
    // to it". Availability is E2E scope, so each entry keeps its last observed
    // runtimeSupport evidence and is skipped here rather than demoted or deleted.
    "gpt-5.3-chat-latest": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason:
        "Deprecated by OpenAI (2026-09-06 sweep): every call returns 404 model_not_found, and /v1/chat/completions reports it as deprecated. Still listed by /v1/models.",
    },
    "gpt-5.2-chat-latest": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason:
        "Deprecated by OpenAI (2026-09-06 sweep): every call returns 404 model_not_found, and /v1/chat/completions reports it as deprecated. Still listed by /v1/models.",
    },
    "gpt-5.2-codex": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason:
        "Deprecated by OpenAI (2026-09-06 sweep): every call returns 404 model_not_found, and /v1/chat/completions reports it as deprecated. Still listed by /v1/models.",
    },
    "gpt-5.1-chat-latest": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason:
        "Deprecated by OpenAI (2026-09-06 sweep): every call returns 404 model_not_found, and /v1/chat/completions reports it as deprecated. Still listed by /v1/models.",
    },
    "gpt-5.1-codex": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason:
        "Deprecated by OpenAI (2026-09-06 sweep): every call returns 404 model_not_found, and /v1/chat/completions reports it as deprecated. Still listed by /v1/models.",
    },
    "gpt-5.1-codex-max": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason:
        "Deprecated by OpenAI (2026-09-06 sweep): every call returns 404 model_not_found, and /v1/chat/completions reports it as deprecated. Still listed by /v1/models.",
    },
    "gpt-5.1-codex-mini": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason:
        "Deprecated by OpenAI (2026-09-06 sweep): every call returns 404 model_not_found, and /v1/chat/completions reports it as deprecated. Still listed by /v1/models.",
    },
    "gpt-5-chat-latest": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason:
        "Deprecated by OpenAI (2026-09-06 sweep): every call returns 404 model_not_found, and /v1/chat/completions reports it as deprecated. Still listed by /v1/models.",
    },
    "gpt-5-codex": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason:
        "Deprecated by OpenAI (2026-09-06 sweep): every call returns 404 model_not_found, and /v1/chat/completions reports it as deprecated. Still listed by /v1/models.",
    },

    // No longer returned by OpenAI /v1/models (2026-09-05 sync). Availability is E2E
    // scope, so each catalog entry and its last observed runtimeSupport are preserved.
    "dall-e-3": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "No longer listed by OpenAI /v1/models (2026-09-05 sync)",
    },
    "dall-e-2": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "No longer listed by OpenAI /v1/models (2026-09-05 sync)",
    },
    "gpt-realtime-mini-2025-10-06": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "No longer listed by OpenAI /v1/models (2026-09-05 sync)",
    },

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




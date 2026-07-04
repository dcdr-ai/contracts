import { AssetType } from "../asset.contract";
import { ExecutionPartSourceKind } from "../execution.contract";
import { IntentType } from "../intent.contract";
import type {
  ProviderCatalogModuleBuildArgs,
  ProviderModelDefinitionInput,
  ProviderModelE2EOverride,
  ProviderModelInputPartsSupportInfo,
  ProviderModelParameterSupportInfo,
  ProviderModelPricing,
} from "../provider.catalog.contract";

const GEMINI_PRICING_URL = "https://ai.google.dev/gemini-api/docs/pricing";
const GEMINI_PRICING_UPDATED_AT_20260519 = Date.UTC(2026, 4, 19);

function pricingGeminiPerMillionTokens(args: {
  pricingPerMillionTokens: ProviderCatalogModuleBuildArgs["pricingPerMillionTokens"];
  input: number;
  output: number;
  tiers?: Array<{
    name: string;
    condition?: string;
    input: number;
    output: number;
  }>;
  notes?: string;
}): ProviderModelPricing {
  return args.pricingPerMillionTokens({
    input: args.input,
    output: args.output,
    tiers: args.tiers,
    sourceUrl: GEMINI_PRICING_URL,
    updatedAt: GEMINI_PRICING_UPDATED_AT_20260519,
    confidence: "official",
    notes: args.notes,
  });
}

/**
 * Returns the curated Gemini provider model definitions.
 */
export function buildGeminiProviderModelDefinitions(
  args: ProviderCatalogModuleBuildArgs,
): ProviderModelDefinitionInput[] {
  const pricingGemini = (pricingArgs: {
    input: number;
    output: number;
    tiers?: Array<{
      name: string;
      condition?: string;
      input: number;
      output: number;
    }>;
    notes?: string;
  }): ProviderModelPricing => {
    return pricingGeminiPerMillionTokens({
      pricingPerMillionTokens: args.pricingPerMillionTokens,
      input: pricingArgs.input,
      output: pricingArgs.output,
      tiers: pricingArgs.tiers,
      notes: pricingArgs.notes,
    });
  };

  return [
    // Source: Gemini Models API (`npm run gemini-models:sync`), updated 2026-05-04
    // Notes:
    // - DCDR runtime v1 implements Gemini for CHAT only (via generateContent / generateContentStream).
    // - Embedding models are cataloged as EMBEDDING, but the runtime does not yet implement a Gemini embedding adapter.

    // --- Validated starter model ---
    {
      id: "gemini-2.5-flash",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      tokenUsageCovered: true,
      publicName: "DCDR Economy",
      badge: "Fast",
      primaryCategory: args.catalogEnums.publicModelCategory.ECONOMY,
      categories: [
        args.catalogEnums.publicModelCategory.ECONOMY,
        args.catalogEnums.publicModelCategory.FAST,
      ],
      qualityTier: 3,
      speedTier: 4,
      costTier: 5,
      recommendedUseCases: ["high_volume_chat", "extraction", "classification"],
      isRecommended: false,
      isGlobalDefault: false,
      isCategoryDefault: true,
      pricing: pricingGemini({
        input: 0.3,
        output: 2.5,
        tiers: [{ name: "audio", condition: "audio", input: 1.0, output: 2.5 }],
        notes:
          "Prices may differ by modality; output includes thinking tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (run + structured + streaming SSE)",
        updatedAt: "2026-05-04",
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
            "Validated with comprehension-grade Gemini curator using the canonical shared fixtures across TEXT/IMAGE/AUDIO/VIDEO/DOCUMENT and INLINE/URL/ASSET.",
          updatedAt: "2026-06-17",
        },
      },
      parameterSupport: {
        recommended: {
          disableThinkingByDefault: true,
          useNativeStructuredOutput: true,
        },
        updatedAt: "2026-05-04",
      },
    },

    // --- Newer preview families (pending E2E curation) ---
    // Discovered via Gemini Models API (2026-05-22).
    {
      id: "gemini-3.5-flash",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      tokenUsageCovered: true,
      publicName: "DCDR Smart",
      badge: "Fast",
      primaryCategory: args.catalogEnums.publicModelCategory.SMART,
      categories: [
        args.catalogEnums.publicModelCategory.SMART,
        args.catalogEnums.publicModelCategory.FAST,
      ],
      qualityTier: 4,
      speedTier: 5,
      costTier: 4,
      recommendedUseCases: ["production_chat", "interactive_chat", "support"],
      isRecommended: true,
      isGlobalDefault: true,
      isCategoryDefault: true,
      pricing: pricingGemini({
        input: 1.5,
        output: 9.0,
        notes: "Output price includes thinking tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured); requires default thinking disable under small token budgets",
        updatedAt: "2026-05-22",
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
            "Validated with comprehension-grade Gemini curator using the canonical shared fixtures across TEXT/IMAGE/AUDIO/VIDEO/DOCUMENT and INLINE/URL/ASSET.",
          updatedAt: "2026-06-17",
        },
      },
      parameterSupport: {
        recommended: {
          disableThinkingByDefault: true,
        },
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gemini-3.1-pro-preview-customtools",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 2.0,
        output: 12.0,
        tiers: [
          {
            name: "prompts <= 200k",
            condition: "prompts <= 200k tokens",
            input: 2.0,
            output: 12.0,
          },
          {
            name: "prompts > 200k",
            condition: "prompts > 200k tokens",
            input: 4.0,
            output: 18.0,
          },
        ],
        notes: "Output price includes thinking tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured + streaming SSE) with larger token budgets; model uses thinking",
        updatedAt: "2026-05-04",
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
            "Validated with the comprehension-grade Gemini curator after restoring thinking for pro-family structured probes: TEXT/AUDIO/VIDEO/DOCUMENT pass across INLINE/URL/ASSET. IMAGE remains outside the published support rectangle after failing the canonical image comprehension cue, and one IMAGE URL run also surfaced a transient upstream fetch error.",
          updatedAt: "2026-06-18",
        },
      },
    },
    {
      id: "gemini-3.1-pro-preview",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      tokenUsageCovered: true,
      publicName: "DCDR Best",
      badge: "Gemini",
      primaryCategory: args.catalogEnums.publicModelCategory.BEST,
      categories: [args.catalogEnums.publicModelCategory.BEST],
      qualityTier: 5,
      speedTier: 3,
      costTier: 3,
      recommendedUseCases: ["reasoning", "agentic_coding", "long_context"],
      isRecommended: false,
      isGlobalDefault: false,
      isCategoryDefault: false,
      pricing: pricingGemini({
        input: 2.0,
        output: 12.0,
        tiers: [
          {
            name: "prompts <= 200k",
            condition: "prompts <= 200k tokens",
            input: 2.0,
            output: 12.0,
          },
          {
            name: "prompts > 200k",
            condition: "prompts > 200k tokens",
            input: 4.0,
            output: 18.0,
          },
        ],
        notes: "Output price includes thinking tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured + streaming SSE) with larger token budgets; model uses thinking",
        updatedAt: "2026-05-04",
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
            "Re-curated on 2026-06-28 with the 1024-token baseline: AUDIO/VIDEO/DOCUMENT pass across INLINE/URL/ASSET. TEXT passed INLINE and URL but showed PARSE_FAIL on ASSET (inconsistent with June 18 confirmation; treated as transient). IMAGE fails the canonical visual cue across all source kinds.",
          updatedAt: "2026-06-28",
        },
      },
    },
    {
      id: "gemini-3.1-flash-tts-preview",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 1.0,
        output: 20.0,
        notes:
          "TTS preview: output billed as audio tokens (docs: ~25 tokens/sec).",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        reason:
          "Rejects developer/system instruction in runtime prompt shape (400 INVALID_ARGUMENT)",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-3.1-flash-live-preview",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 0.75,
        output: 4.5,
        tiers: [
          { name: "audio", condition: "audio", input: 3.0, output: 12.0 },
          {
            name: "image/video",
            condition: "image/video",
            input: 1.0,
            output: 4.5,
          },
        ],
        notes:
          "Live preview pricing varies by modality; docs also list per-minute rates for audio/video.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.FAILING,
        reason:
          "Model/endpoint not found (404) in provider E2E for this account",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-3.1-flash-lite-preview",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 0.25,
        output: 1.5,
        tiers: [{ name: "audio", condition: "audio", input: 0.5, output: 1.5 }],
        notes:
          "Prices may differ by modality; output includes thinking tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured + streaming SSE)",
        updatedAt: "2026-05-04",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-06-28 with the 1024-token baseline: TEXT/VIDEO/DOCUMENT pass INLINE and ASSET; IMAGE and AUDIO fail the canonical comprehension cues. URL fixtures were unavailable this run (SKIPPED_NO_FIXTURE); URL was confirmed passing in the June 17 prior curation.",
          updatedAt: "2026-06-28",
        },
      },
    },
    // Discovered via Gemini Models API (2026-05-22).
    {
      id: "gemini-3.1-flash-lite",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 0.25,
        output: 1.5,
        tiers: [{ name: "audio", condition: "audio", input: 0.5, output: 1.5 }],
        notes:
          "Prices may differ by modality; output includes thinking tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (text + structured)",
        updatedAt: "2026-05-22",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.AUDIO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-06-28 with the 1024-token baseline: TEXT/AUDIO/DOCUMENT pass INLINE and ASSET; IMAGE and VIDEO fail the canonical comprehension cues. URL fixtures were unavailable this run (SKIPPED_NO_FIXTURE); URL was confirmed passing in the June 17 prior curation.",
          updatedAt: "2026-06-28",
        },
      },
      parameterSupport: {
        recommended: {
          useNativeStructuredOutput: true,
        },
        updatedAt: "2026-05-22",
      },
    },
    {
      id: "gemini-3.1-flash-image-preview",
      types: [IntentType.IMAGE_GENERATION],
      pricing: pricingGemini({
        input: 0.5,
        output: 3.0,
        notes:
          "Image-preview model; docs list separate image output pricing (not modeled here).",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured + streaming SSE)",
        updatedAt: "2026-05-04",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Validated with the comprehension-grade Gemini curator for TEXT/IMAGE/VIDEO/DOCUMENT across INLINE/URL/ASSET. AUDIO remains outside the published support rectangle after failing the current canonical comprehension thresholds.",
          updatedAt: "2026-06-17",
        },
      },
    },
    {
      id: "gemini-3.1-flash-image",
      types: [IntentType.IMAGE_GENERATION],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered in provider drift check; pending provider E2E curation for runtime image behavior.",
        updatedAt: "2026-06-07",
      },
    },
    {
      id: "gemini-3.1-flash-lite-image",
      types: [IntentType.IMAGE_GENERATION],
      pricing: pricingGemini({
        input: 0.15,
        output: 0.0195,
        notes:
          "Image generation model; docs list image output pricing separately and text/structured runtime support is still partial.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.FAILING,
        reason:
          "Provider E2E passes simple text but structured output returns INVALID_ARGUMENT (400).",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "gemini-3.5-live-translate-preview",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 3.5,
        output: 21.0,
        notes:
          "Live speech-to-speech translation model; docs also publish per-minute audio rates.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.FAILING,
        reason:
          "Provider E2E returns MODEL_NOT_FOUND (upstream 404) for this account/endpoint.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "gemini-omni-flash-preview",
      types: [IntentType.VIDEO_GENERATION],
      pricing: pricingGemini({
        input: 1.5,
        output: 9.0,
        tiers: [
          {
            name: "video output",
            condition: "video",
            input: 1.5,
            output: 17.5,
          },
        ],
        notes:
          "Omni/video generation preview; docs list a higher output price for generated video than for text output.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        reason:
          "Provider E2E returns upstream 400: model only supports the Gemini Interactions API, not the current runtime path.",
        updatedAt: "2026-07-04",
      },
    },

    {
      id: "gemini-3-pro-preview",
      types: [IntentType.CHAT],
      pricing: {
        ...pricingGemini({
          input: 2.0,
          output: 12.0,
          tiers: [
            {
              name: "prompts <= 200k",
              condition: "prompts <= 200k tokens",
              input: 2.0,
              output: 12.0,
            },
            {
              name: "prompts > 200k",
              condition: "prompts > 200k tokens",
              input: 4.0,
              output: 18.0,
            },
          ],
          notes: "Output price includes thinking tokens.",
        }),
        confidence: "approx",
        notes:
          "Not explicitly listed on pricing page; approximated from Gemini 3.1 Pro Preview.",
      },
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.FAILING,
        reason:
          "Provider E2E still returns MODEL_NOT_FOUND (upstream 404) for this account/endpoint.",
        updatedAt: "2026-06-18",
      },
    },
    {
      id: "gemini-3-pro-image",
      types: [IntentType.IMAGE_GENERATION],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered in provider drift check; pending provider E2E curation for runtime image behavior.",
        updatedAt: "2026-06-07",
      },
    },
    {
      id: "gemini-3-pro-image-preview",
      types: [IntentType.IMAGE_GENERATION],
      pricing: pricingGemini({
        input: 2.0,
        output: 12.0,
        tiers: [
          {
            name: "prompts <= 200k",
            condition: "prompts <= 200k tokens",
            input: 2.0,
            output: 12.0,
          },
          {
            name: "prompts > 200k",
            condition: "prompts > 200k tokens",
            input: 4.0,
            output: 18.0,
          },
        ],
        notes:
          "Image generation model; text pricing is the same as Gemini 3.1 Pro (image output priced separately).",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.FAILING,
        reason:
          "Structured mode returned empty text in provider E2E (streaming SSE OK)",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-3-flash-preview",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      tokenUsageCovered: true,
      publicName: "DCDR Fast",
      badge: "Gemini",
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
      isCategoryDefault: false,
      pricing: pricingGemini({
        input: 0.5,
        output: 3.0,
        tiers: [{ name: "audio", condition: "audio", input: 1.0, output: 3.0 }],
        notes:
          "Prices may differ by modality; output includes thinking tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured + streaming SSE)",
        updatedAt: "2026-05-04",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.AUDIO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-06-28 with the 1024-token baseline: TEXT/AUDIO/DOCUMENT pass INLINE and ASSET (DOCUMENT ASSET got transient 5XX — not structural); IMAGE passes ASSET but fails INLINE (inconsistent — excluded); VIDEO passes INLINE but fails ASSET (inconsistent — excluded). URL fixtures were unavailable this run (SKIPPED_NO_FIXTURE); URL was confirmed passing in the June 18 prior curation.",
          updatedAt: "2026-06-28",
        },
      },
      parameterSupport: {
        recommended: {
          disableThinkingByDefault: true,
          useNativeStructuredOutput: true,
        },
        updatedAt: "2026-05-04",
      },
    },

    // --- 2.5 family variants (pending E2E curation) ---
    {
      id: "gemini-2.5-pro",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 1.25,
        output: 10.0,
        tiers: [
          {
            name: "prompts <= 200k",
            condition: "prompts <= 200k tokens",
            input: 1.25,
            output: 10.0,
          },
          {
            name: "prompts > 200k",
            condition: "prompts > 200k tokens",
            input: 2.5,
            output: 15.0,
          },
        ],
        notes: "Output price includes thinking tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured + streaming SSE) with the comprehension-grade multimodal curator after the dedicated text user-prompt hardening for pro-family structured probes.",
        updatedAt: "2026-06-18",
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
            "Re-curated on 2026-06-28 with the 1024-token baseline: all five asset types pass INLINE and ASSET. URL fixtures were unavailable this run (SKIPPED_NO_FIXTURE) but URL was confirmed passing for TEXT/AUDIO/VIDEO/DOCUMENT in the prior curation; IMAGE URL was not re-tested. IMAGE now joins the rectangle after clearing the canonical image cue on INLINE and ASSET.",
          updatedAt: "2026-06-28",
        },
      },
    },
    {
      id: "gemini-2.5-pro-preview-tts",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 1.0,
        output: 20.0,
        notes: "TTS preview: output billed as audio tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        reason:
          "Audio-only response modality (TEXT unsupported) in provider E2E; runtime v1 is text-only",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-2.5-flash-lite",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      tokenUsageCovered: true,
      publicName: "DCDR Economy",
      badge: "Lowest cost",
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
      pricing: pricingGemini({
        input: 0.1,
        output: 0.4,
        tiers: [{ name: "audio", condition: "audio", input: 0.3, output: 0.4 }],
        notes:
          "Prices may differ by modality; output includes thinking tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured + streaming SSE)",
        updatedAt: "2026-05-04",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.IMAGE,
            AssetType.VIDEO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-06-28 with the 1024-token baseline: TEXT/IMAGE/VIDEO/DOCUMENT pass INLINE and ASSET; AUDIO fails the canonical audio cue. URL fixtures were unavailable this run (SKIPPED_NO_FIXTURE); URL was confirmed passing in the June 17 prior curation.",
          updatedAt: "2026-06-28",
        },
      },
      parameterSupport: {
        recommended: {
          disableThinkingByDefault: true,
          useNativeStructuredOutput: true,
        },
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-2.5-flash-image",
      types: [IntentType.IMAGE_GENERATION],
      pricing: pricingGemini({
        input: 0.3,
        output: 2.5,
        notes:
          "Image generation model; docs list separate per-image output pricing (not modeled here).",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured + streaming SSE)",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-2.5-flash-native-audio-latest",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 0.5,
        output: 2.0,
        tiers: [
          {
            name: "audio/video",
            condition: "audio/video",
            input: 3.0,
            output: 12.0,
          },
        ],
        notes:
          "Native audio (Live API): docs also list per-minute rates for audio; output includes thinking tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        reason:
          "Native-audio model (text-only runtime v1); also 404 in provider E2E for this account",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-2.5-flash-native-audio-preview-09-2025",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 0.5,
        output: 2.0,
        tiers: [
          {
            name: "audio/video",
            condition: "audio/video",
            input: 3.0,
            output: 12.0,
          },
        ],
        notes:
          "Native audio (Live API): docs also list per-minute rates for audio; output includes thinking tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        reason:
          "Native-audio model (text-only runtime v1); also 404 in provider E2E for this account",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-2.5-flash-native-audio-preview-12-2025",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 0.5,
        output: 2.0,
        tiers: [
          {
            name: "audio/video",
            condition: "audio/video",
            input: 3.0,
            output: 12.0,
          },
        ],
        notes:
          "Native audio (Live API): docs also list per-minute rates for audio; output includes thinking tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        reason:
          "Native-audio model (text-only runtime v1); also 404 in provider E2E for this account",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-2.5-flash-preview-tts",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 0.5,
        output: 10.0,
        notes: "TTS preview: output billed as audio tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        reason:
          "Audio-only response modality (TEXT unsupported) in provider E2E; runtime v1 is text-only",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-2.5-computer-use-preview-10-2025",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 1.25,
        output: 10.0,
        tiers: [
          {
            name: "prompts <= 200k",
            condition: "prompts <= 200k tokens",
            input: 1.25,
            output: 10.0,
          },
          {
            name: "prompts > 200k",
            condition: "prompts > 200k tokens",
            input: 2.5,
            output: 15.0,
          },
        ],
        notes:
          "Computer Use model token pricing (tools may have separate charges).",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        reason:
          "Requires Computer Use tool wiring (not supported in runtime v1)",
        updatedAt: "2026-05-04",
      },
    },

    // --- Older 2.0 family IDs (may appear but can be unavailable to new users) ---
    {
      id: "gemini-2.0-flash",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 0.1,
        output: 0.4,
        tiers: [{ name: "audio", condition: "audio", input: 0.7, output: 0.4 }],
        notes: "Deprecated model family (shutdown noted in docs).",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.FAILING,
        reason:
          "Visible via Models API but may be unavailable to new users (404)",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-2.0-flash-001",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 0.1,
        output: 0.4,
        tiers: [{ name: "audio", condition: "audio", input: 0.7, output: 0.4 }],
        notes: "Deprecated model family (shutdown noted in docs).",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.FAILING,
        reason:
          "Visible via Models API but may be unavailable to new users (404)",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-2.0-flash-lite",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 0.075,
        output: 0.3,
        notes: "Deprecated model family (shutdown noted in docs).",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.FAILING,
        reason:
          "Visible via Models API but may be unavailable to new users (404)",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-2.0-flash-lite-001",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 0.075,
        output: 0.3,
        notes: "Deprecated model family (shutdown noted in docs).",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.FAILING,
        reason:
          "Visible via Models API but may be unavailable to new users (404)",
        updatedAt: "2026-05-04",
      },
    },

    // --- Rolling aliases ---
    {
      id: "gemini-flash-latest",
      types: [IntentType.CHAT],
      pricing: {
        ...pricingGemini({
          input: 0.3,
          output: 2.5,
          tiers: [
            { name: "audio", condition: "audio", input: 1.0, output: 2.5 },
          ],
          notes:
            "Prices may differ by modality; output includes thinking tokens.",
        }),
        confidence: "approx",
        notes: "Rolling alias; priced as Gemini 2.5 Flash (approx).",
      },
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured + streaming SSE) (alias)",
        updatedAt: "2026-05-04",
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
            "Validated with the comprehension-grade Gemini curator using the canonical shared fixtures across TEXT/IMAGE/AUDIO/VIDEO/DOCUMENT and INLINE/URL/ASSET.",
          updatedAt: "2026-06-17",
        },
      },
      parameterSupport: {
        recommended: {
          disableThinkingByDefault: true,
          useNativeStructuredOutput: true,
        },
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-flash-lite-latest",
      types: [IntentType.CHAT],
      pricing: {
        ...pricingGemini({
          input: 0.1,
          output: 0.4,
          tiers: [
            { name: "audio", condition: "audio", input: 0.3, output: 0.4 },
          ],
          notes:
            "Prices may differ by modality; output includes thinking tokens.",
        }),
        confidence: "approx",
        notes: "Rolling alias; priced as Gemini 2.5 Flash-Lite (approx).",
      },
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured + streaming SSE) (alias)",
        updatedAt: "2026-05-04",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [
            AssetType.TEXT,
            AssetType.AUDIO,
            AssetType.DOCUMENT,
          ],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-06-28 with the 1024-token baseline: TEXT/AUDIO/DOCUMENT pass INLINE and ASSET; IMAGE and VIDEO fail the canonical comprehension cues. URL fixtures were unavailable this run (SKIPPED_NO_FIXTURE); URL was confirmed passing in the June 17 prior curation.",
          updatedAt: "2026-06-28",
        },
      },
      parameterSupport: {
        recommended: {
          disableThinkingByDefault: true,
          useNativeStructuredOutput: true,
        },
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-pro-latest",
      types: [IntentType.CHAT],
      pricing: {
        ...pricingGemini({
          input: 1.25,
          output: 10.0,
          tiers: [
            {
              name: "prompts <= 200k",
              condition: "prompts <= 200k tokens",
              input: 1.25,
              output: 10.0,
            },
            {
              name: "prompts > 200k",
              condition: "prompts > 200k tokens",
              input: 2.5,
              output: 15.0,
            },
          ],
          notes: "Output price includes thinking tokens.",
        }),
        confidence: "approx",
        notes: "Rolling alias; priced as Gemini 2.5 Pro (approx).",
      },
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured + streaming SSE) (alias)",
        updatedAt: "2026-05-04",
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
            "Re-curated on 2026-06-28 with the 1024-token baseline: AUDIO/VIDEO/DOCUMENT pass across INLINE/URL/ASSET. TEXT showed PARSE_FAIL on INLINE and URL but passed via ASSET (inconsistent with June 18 confirmation; treated as transient). IMAGE fails the canonical visual cue across all source kinds.",
          updatedAt: "2026-06-28",
        },
      },
    },

    // --- Robotics models (listed by API; may require special modalities) ---
    {
      id: "gemini-robotics-er-1.6-preview",
      types: [IntentType.CHAT],
      pricing: pricingGemini({
        input: 1.0,
        output: 5.0,
        tiers: [{ name: "audio", condition: "audio", input: 2.0, output: 5.0 }],
        notes:
          "Prices may differ by modality; output includes thinking tokens.",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.FAILING,
        reason: "Provider E2E: empty output in text + structured + streaming",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-robotics-er-1.5-preview",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.FAILING,
        reason:
          "Model/endpoint not found (404) in provider E2E for this account",
        updatedAt: "2026-05-04",
      },
    },

    // --- Embeddings (cataloged, but runtime adapter not implemented yet) ---
    {
      id: "gemini-embedding-2-preview",
      types: [IntentType.EMBEDDING],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        reason: "Gemini embedding adapter not implemented in runtime v1",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-embedding-2",
      types: [IntentType.EMBEDDING],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        reason: "Gemini embedding adapter not implemented in runtime v1",
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "gemini-embedding-001",
      types: [IntentType.EMBEDDING],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.NOT_SUPPORTED,
        reason: "Gemini embedding adapter not implemented in runtime v1",
        updatedAt: "2026-05-04",
      },
    },
  ];
}

/**
 * Returns the E2E override map for Gemini provider models.
 */
export function buildGeminiProviderModelE2EOverrides(
  args: ProviderCatalogModuleBuildArgs,
): Record<string, ProviderModelE2EOverride> {
  return {
    // Listed by the Models API but not callable for many accounts (404).
    "gemini-2.0-flash": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Listed but not callable for many accounts (404)",
    },
    "gemini-2.0-flash-001": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Listed but not callable for many accounts (404)",
    },
    "gemini-2.0-flash-lite": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Listed but not callable for many accounts (404)",
    },
    "gemini-2.0-flash-lite-001": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Listed but not callable for many accounts (404)",
    },

    // Preview/live endpoint variants can be account-gated or missing.
    "gemini-3.1-flash-live-preview": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Model/endpoint not found (404) in provider E2E",
    },
    "gemini-3.5-live-translate-preview": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Model/endpoint not found (404) in provider E2E for this account",
    },
    "gemini-3-pro-preview": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Model/endpoint not found (404) in provider E2E for this account",
    },

    // Requires explicit Computer Use tooling.
    "gemini-2.5-computer-use-preview-10-2025": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Requires Computer Use tool wiring (not supported in runtime v1)",
    },
    "gemini-omni-flash-preview": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Requires the Gemini Interactions API (not supported in runtime v1)",
    },

    // Audio-only response modalities (runtime v1 is text-only).
    "gemini-2.5-pro-preview-tts": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Audio-only response modality (TEXT unsupported)",
    },
    "gemini-2.5-flash-preview-tts": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Audio-only response modality (TEXT unsupported)",
    },
    "gemini-2.5-flash-native-audio-latest": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Native-audio model (text-only runtime)",
    },
    "gemini-2.5-flash-native-audio-preview-09-2025": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Native-audio model (text-only runtime)",
    },
    "gemini-2.5-flash-native-audio-preview-12-2025": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Native-audio model (text-only runtime)",
    },

    // Some robotics preview IDs appear/disappear across accounts.
    "gemini-robotics-er-1.5-preview": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Model/endpoint not found (404) in provider E2E",
    },
  };
}

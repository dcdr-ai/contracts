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

const ANTHROPIC_PRICING_URL =
  "https://platform.claude.com/docs/en/about-claude/pricing";
const ANTHROPIC_PRICING_UPDATED_AT_20260905 = Date.UTC(2026, 8, 5);

export const ANTHROPIC_PROVIDER_PRICING_FALLBACK_RULES: ProviderPricingFallbackRule[] =
  [
    // Opus/Sonnet/Haiku family pricing is expected to be consistent across close variants.
    { match: /^claude-opus-4-/, baseModelId: "claude-opus-4-7" },
    { match: /^claude-sonnet-4-/, baseModelId: "claude-sonnet-4-6" },
    { match: /^claude-haiku-4-/, baseModelId: "claude-haiku-4-5" },
  ];

/**
 * Returns the curated Anthropic provider model definitions.
 */
export function buildAnthropicProviderModelDefinitions(
  args: ProviderCatalogModuleBuildArgs,
): ProviderModelDefinitionInput[] {
  const ANTHROPIC_NO_SAMPLING_PARAMETER_SUPPORT: ProviderModelParameterSupportInfo =
    {
      parameters: {
        [args.catalogEnums.promptParameterKey.TEMPERATURE]:
          args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
        [args.catalogEnums.promptParameterKey.TOP_P]:
          args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
      },
      notes:
        "Newer Claude generations reject explicit sampling parameters on the Anthropic Messages API; provider E2E returns 400 'top_p is deprecated for this model.'",
      updatedAt: "2026-09-05",
    };

  return [
    // Source: Anthropic Models overview (latest models comparison), updated 2026-05-04
    // Note: DCDR runtime v1 treats Anthropic as CHAT-only; multimodal/vision intent types are intentionally not listed yet.
    {
      id: "claude-opus-5",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      parameterSupport: ANTHROPIC_NO_SAMPLING_PARAMETER_SUPPORT,
      pricing: args.pricingPerMillionTokens({
        input: 5.0,
        cachedInput: 0.5,
        output: 25.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        updatedAt: ANTHROPIC_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E on 2026-09-05 (text + structured) with the 1024-token baseline. Sampling parameters are stripped via parameterSupport; the model reasons before emitting visible text, so small output budgets return PROVIDER_EMPTY_RESPONSE.",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
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
            "Untrusted: this rectangle passed 3/3 on 2026-09-04 but no longer reproduces. On 2026-09-05 every multimodal structured call returned PROVIDER_EMPTY_RESPONSE (\"Anthropic returned an empty response\") across INLINE/URL/ASSET, at both the 1024- and 4096-token budgets. The regression was reproduced with the pre-refactor curator restored from git, so it is not a harness change; plain CHAT and token usage still work. The previous asset types are retained only as the prior claim until the cause is understood.",
          updatedAt: "2026-09-05",
        },
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "claude-opus-4-8",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      publicName: "DCDR Best",
      badge: "Anthropic",
      primaryCategory: args.catalogEnums.publicModelCategory.BEST,
      categories: [args.catalogEnums.publicModelCategory.BEST],
      qualityTier: 5,
      speedTier: 3,
      costTier: 1,
      recommendedUseCases: ["reasoning", "agentic_coding"],
      isRecommended: false,
      isGlobalDefault: false,
      isCategoryDefault: false,
      tokenUsageCovered: true,
      parameterSupport: {
        parameters: {
          [args.catalogEnums.promptParameterKey.TEMPERATURE]:
            args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
          [args.catalogEnums.promptParameterKey.TOP_P]:
            args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
        },
        notes:
          "Opus 4.8 currently rejects explicit temperature and top_p in provider E2E on the Anthropic Messages API; runtime should avoid sending both.",
        updatedAt: "2026-06-16",
      },
      pricing: args.pricingPerMillionTokens({
        input: 5.0,
        cachedInput: 0.5,
        output: 25.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        updatedAt: ANTHROPIC_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured) with model-specific sampling parameter filtering.",
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
            "Re-measured on 2026-09-05 with the unified comprehension-grade curator (RM-050/RM-051): one shared cue definition, one prompt per asset family and a 1024-token budget across every provider, so this rectangle means the same thing as every other provider's. AUDIO and VIDEO are rejected deterministically by the Anthropic Messages provider path before any upstream model call.",
          updatedAt: "2026-09-05",
        },
        updatedAt: "2026-06-07",
      },
    },
    {
      id: "claude-opus-4-7",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,

      parameterSupport: {
        parameters: {
          [args.catalogEnums.promptParameterKey.TEMPERATURE]:
            args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
          [args.catalogEnums.promptParameterKey.TOP_P]:
            args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
        },
        notes:
          "Opus 4.7 rejects explicit temperature/top_p in provider E2E on current Anthropic Messages API.",
        updatedAt: "2026-06-07",
      },
      pricing: args.pricingPerMillionTokens({
        input: 5.0,
        cachedInput: 0.5,
        output: 25.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        updatedAt: ANTHROPIC_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (run + streaming SSE)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-06-28 with the 1024-token baseline: IMAGE/DOCUMENT pass across INLINE/URL/ASSET. TEXT returns 200 but does not confirm sawProvidedInput=true on any source kind (model behavior, not token truncation). AUDIO/VIDEO are rejected deterministically with MODEL_UNSUPPORTED by the Anthropic Messages provider path.",
          updatedAt: "2026-06-28",
        },
        updatedAt: "2026-05-04",
      },
    },
    // Legacy/stable IDs still visible via Models API for some accounts.
    {
      id: "claude-opus-4-6",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 5.0,
        cachedInput: 0.5,
        output: 25.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        updatedAt: ANTHROPIC_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (run + structured + streaming SSE)",
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
            "Validated with the comprehension-grade Anthropic curator on 2026-06-26: TEXT/IMAGE/DOCUMENT pass across INLINE/URL/ASSET, while AUDIO/VIDEO are rejected deterministically with MODEL_UNSUPPORTED by the current Anthropic Messages provider path before any upstream model call.",
          updatedAt: "2026-06-26",
        },
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "claude-opus-4-5-20251101",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 5.0,
        cachedInput: 0.5,
        output: 25.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        updatedAt: ANTHROPIC_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (run + structured + streaming SSE)",
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
            "Validated with the comprehension-grade Anthropic curator on 2026-06-26: TEXT/IMAGE/DOCUMENT pass across INLINE/URL/ASSET, while AUDIO/VIDEO are rejected deterministically with MODEL_UNSUPPORTED by the current Anthropic Messages provider path before any upstream model call.",
          updatedAt: "2026-06-26",
        },
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "claude-opus-4-1-20250805",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 15.0,
        cachedInput: 1.5,
        output: 75.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        updatedAt: ANTHROPIC_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (run + structured + streaming SSE)",
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
            "Validated with the comprehension-grade Anthropic curator on 2026-06-26: TEXT/IMAGE/DOCUMENT pass across INLINE/URL/ASSET, while AUDIO/VIDEO are rejected deterministically with MODEL_UNSUPPORTED by the current Anthropic Messages provider path before any upstream model call.",
          updatedAt: "2026-06-26",
        },
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "claude-sonnet-4-6",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      pricing: args.pricingPerMillionTokens({
        input: 3.0,
        cachedInput: 0.3,
        output: 15.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        updatedAt: ANTHROPIC_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (run + streaming SSE). Retired on the first-party Claude API since 2026-09-05 (Anthropic documents it as retired except on Bedrock and Google Cloud) and absent from /v1/models, so it is skipped by provider E2E via the LEGACY override rather than demoted here; it remains callable on the partner platforms and keeps its published retired-tier pricing.",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-06-28 with the 1024-token baseline: IMAGE/DOCUMENT pass across INLINE/URL/ASSET (IMAGE URL had a transient 429 rate-limit hit, not structural). TEXT returns 200 but does not confirm sawProvidedInput=true on any source kind (model behavior, not token truncation). AUDIO/VIDEO are rejected deterministically with MODEL_UNSUPPORTED by the Anthropic Messages provider path.",
          updatedAt: "2026-06-28",
        },
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "claude-sonnet-4-5-20250929",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 3.0,
        cachedInput: 0.3,
        output: 15.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        updatedAt: ANTHROPIC_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (run + structured + streaming SSE)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-06-28 with the 1024-token baseline: DOCUMENT URL/ASSET pass (INLINE got a transient 429, not structural). TEXT returns 200 but does not confirm sawProvidedInput=true on any source kind (model behavior). IMAGE fails the canonical visual cue across all source kinds. AUDIO/VIDEO are rejected deterministically with MODEL_UNSUPPORTED by the Anthropic Messages provider path.",
          updatedAt: "2026-06-28",
        },
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "claude-sonnet-5",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      publicName: "DCDR Smart",
      badge: "Anthropic",
      primaryCategory: args.catalogEnums.publicModelCategory.SMART,
      categories: [
        args.catalogEnums.publicModelCategory.SMART,
        args.catalogEnums.publicModelCategory.FAST,
      ],
      qualityTier: 4,
      speedTier: 4,
      costTier: 3,
      recommendedUseCases: ["production_chat", "coding", "reasoning"],
      isRecommended: true,
      isGlobalDefault: false,
      isCategoryDefault: false,
      tokenUsageCovered: true,
      pricing: args.pricingPerMillionTokens({
        input: 2.0,
        cachedInput: 0.2,
        output: 10.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        updatedAt: ANTHROPIC_PRICING_UPDATED_AT_20260905,
        notes:
          "Anthropic pricing page snapshot 2026-09-05. The previously scheduled 2026-09-01 increase to 3.00/15.00 was cancelled by Anthropic; 2.00/10.00 is now the standard rate, so the old 'standard' tier was removed rather than promoted.",
      }),
      parameterSupport: {
        parameters: {
          [args.catalogEnums.promptParameterKey.TEMPERATURE]:
            args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
          [args.catalogEnums.promptParameterKey.TOP_P]:
            args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
        },
        notes:
          "Sonnet 5 rejects explicit temperature/top_p on the current Anthropic Messages API path in provider E2E.",
        updatedAt: "2026-07-04",
      },
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured) with the 1024-token baseline.",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-measured on 2026-09-05 with the unified comprehension-grade curator (RM-050/RM-051). IMAGE and DOCUMENT pass across INLINE/URL/ASSET. TEXT passes URL and ASSET but does not report seeing the input on INLINE, so it stays outside the published rectangle rather than being published as a partial one. AUDIO and VIDEO are rejected deterministically by the Anthropic Messages provider path before any upstream model call.",
          updatedAt: "2026-09-05",
        },
        updatedAt: "2026-07-04",
      },
    },
    // Haiku is the cheapest/default smoke-test model.
    {
      id: "claude-haiku-4-5",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      pricing: args.pricingPerMillionTokens({
        input: 1.0,
        cachedInput: 0.1,
        output: 5.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        updatedAt: ANTHROPIC_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (run + streaming SSE)",
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
            "Validated with the comprehension-grade Anthropic curator on 2026-06-26: TEXT/IMAGE/DOCUMENT pass across INLINE/URL/ASSET, while AUDIO/VIDEO are rejected deterministically with MODEL_UNSUPPORTED by the current Anthropic Messages provider path before any upstream model call.",
          updatedAt: "2026-06-26",
        },
        updatedAt: "2026-05-04",
      },
    },
    {
      id: "claude-fable-5-1",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      parameterSupport: ANTHROPIC_NO_SAMPLING_PARAMETER_SUPPORT,
      pricing: args.pricingPerMillionTokens({
        input: 10.0,
        cachedInput: 0.25,
        output: 50.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        updatedAt: ANTHROPIC_PRICING_UPDATED_AT_20260905,
        notes:
          "Anthropic pricing page snapshot 2026-09-05. Cache hits are priced at 0.025x base input on Fable 5.1 (all other models use the standard 0.1x multiplier).",
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E on 2026-09-05 (text + structured) with the 1024-token baseline. Sampling parameters are stripped via parameterSupport; the model reasons before emitting visible text, so small output budgets return PROVIDER_EMPTY_RESPONSE.",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-09-05 with the comprehension-grade Anthropic curator and the 1024-token baseline. IMAGE and DOCUMENT pass across INLINE/URL/ASSET. TEXT fails on all three source kinds (the model does not confirm sawProvidedInput), so it is intentionally left out of the published rectangle. AUDIO and VIDEO are rejected by the current Anthropic Messages provider path before any comprehension result is produced.",
          updatedAt: "2026-09-05",
        },
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "claude-fable-5",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      pricing: args.pricingPerMillionTokens({
        input: 10.0,
        cachedInput: 1.0,
        output: 50.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        updatedAt: ANTHROPIC_PRICING_UPDATED_AT_20260905,
        notes:
          "Anthropic pricing page snapshot 2026-09-05. Cache hits use the standard 0.1x input multiplier on Fable 5 (Fable 5.1 uses 0.025x instead).",
      }),
      parameterSupport: {
        parameters: {
          [args.catalogEnums.promptParameterKey.TEMPERATURE]:
            args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
          [args.catalogEnums.promptParameterKey.TOP_P]:
            args.catalogEnums.parameterSupportStatus.NOT_SUPPORTED,
        },
        notes:
          "Fable 5 rejects explicit temperature/top_p on the current Anthropic Messages API path in provider E2E.",
        updatedAt: "2026-07-04",
      },
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured) with the 1024-token baseline. Lower output budgets can spend tokens on thinking before any visible text is emitted.",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.TEXT, AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-curated on 2026-07-04 with the canonical 15-cell Anthropic harness and the 1024-token baseline. TEXT, IMAGE, and DOCUMENT pass across INLINE/URL/ASSET. AUDIO and VIDEO are rejected deterministically with MODEL_UNSUPPORTED by the current Anthropic Messages provider path. With very small text budgets (for example 16 tokens), this model can spend the full budget on thinking before emitting visible text.",
          updatedAt: "2026-07-04",
        },
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "claude-haiku-4-5-20251001",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      tokenUsageCovered: true,
      publicName: "DCDR Fast",
      badge: "Anthropic",
      primaryCategory: args.catalogEnums.publicModelCategory.FAST,
      categories: [
        args.catalogEnums.publicModelCategory.FAST,
        args.catalogEnums.publicModelCategory.ECONOMY,
      ],
      qualityTier: 3,
      speedTier: 5,
      costTier: 4,
      recommendedUseCases: ["interactive_chat", "support", "classification"],
      isRecommended: false,
      isGlobalDefault: false,
      isCategoryDefault: false,
      pricing: args.pricingPerMillionTokens({
        input: 1.0,
        cachedInput: 0.1,
        output: 5.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        updatedAt: ANTHROPIC_PRICING_UPDATED_AT_20260905,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (run + streaming SSE)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE, AssetType.DOCUMENT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-measured on 2026-09-06 across INLINE/URL/ASSET with the unified comprehension-grade curator. IMAGE and DOCUMENT pass on all three source kinds. TEXT is excluded: it does not report seeing the input on any source kind. The previous TEXT claim was over-stated — it was extended to all three source kinds from an INLINE-only run. AUDIO and VIDEO are rejected deterministically by the Anthropic Messages provider path before any upstream model call. Verified identical on @anthropic-ai/sdk 0.110.0 and 0.124.0, so the TEXT failure is model behaviour rather than an SDK regression.",
          updatedAt: "2026-09-06",
        },
        updatedAt: "2026-05-04",
      },
    },
  ];
}

/**
 * Returns the E2E override map for Anthropic provider models.
 */
export function buildAnthropicProviderModelE2EOverrides(
  args: ProviderCatalogModuleBuildArgs,
): Record<string, ProviderModelE2EOverride> {
  return {
    "claude-haiku-4-5": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason:
        "Compatibility alias retained locally but no longer listed by Anthropic /v1/models",
    },
    "claude-opus-4-1-20250805": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason:
        "Retired on the first-party Claude API (still served on Bedrock and Google Cloud); no longer listed by Anthropic /v1/models",
    },
  };
}

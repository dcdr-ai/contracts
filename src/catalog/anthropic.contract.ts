import { AssetType } from "../asset.contract";
import { ExecutionPartSourceKind } from "../execution.contract";
import { IntentType } from "../intent.contract";
import type {
  ProviderCatalogModuleBuildArgs,
  ProviderModelDefinitionInput,
  ProviderModelE2EOverride,
  ProviderPricingFallbackRule,
} from "../provider.catalog.contract";

const ANTHROPIC_PRICING_URL =
  "https://platform.claude.com/docs/en/about-claude/pricing";

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
  return [
    // Source: Anthropic Models overview (latest models comparison), updated 2026-05-04
    // Note: DCDR runtime v1 treats Anthropic as CHAT-only; multimodal/vision intent types are intentionally not listed yet.
    {
      id: "claude-opus-4-8",
      types: [IntentType.CHAT],
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
      publicForCustomers: true,
      tokenUsageCovered: true,
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
      pricing: args.pricingPerMillionTokens({
        input: 5.0,
        output: 25.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
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
            "Validated with the comprehension-grade Anthropic curator on 2026-06-26: TEXT/IMAGE/DOCUMENT pass across INLINE/URL/ASSET, while AUDIO/VIDEO are rejected deterministically with MODEL_UNSUPPORTED by the current Anthropic Messages provider path before any upstream model call.",
          updatedAt: "2026-06-26",
        },
        updatedAt: "2026-06-07",
      },
    },
    {
      id: "claude-opus-4-7",
      types: [IntentType.CHAT],
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
        output: 25.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
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
        output: 25.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
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
        output: 25.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
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
        output: 75.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
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
      publicForCustomers: true,
      tokenUsageCovered: true,
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
      pricing: args.pricingPerMillionTokens({
        input: 3.0,
        output: 15.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
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
        output: 15.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
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
      tokenUsageCovered: true,
      pricing: args.pricingPerMillionTokens({
        input: 2.0,
        output: 10.0,
        tiers: [
          {
            name: "standard",
            condition: "Standard pricing from 2026-09-01 (promotional pricing through 2026-08-31)",
            input: 3.0,
            output: 15.0,
          },
        ],
        sourceUrl: ANTHROPIC_PRICING_URL,
        notes:
          "Anthropic pricing page snapshot 2026-07-04. Base values reflect the promotional Sonnet 5 rate shown as active through 2026-08-31.",
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
            "Re-curated on 2026-07-04 with the canonical 15-cell Anthropic harness and the 1024-token baseline. IMAGE and DOCUMENT pass across INLINE/URL/ASSET. TEXT passes on INLINE and ASSET but still fails the canonical comprehension assertion on URL, so it is intentionally not promoted by the current catalog shape. AUDIO and VIDEO are rejected deterministically with MODEL_UNSUPPORTED by the current Anthropic Messages provider path.",
          updatedAt: "2026-07-04",
        },
        updatedAt: "2026-07-04",
      },
    },
    // Haiku is the cheapest/default smoke-test model.
    {
      id: "claude-haiku-4-5",
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
        output: 5.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
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
      id: "claude-fable-5",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 10.0,
        output: 50.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
        notes: "Anthropic pricing page snapshot 2026-07-04.",
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
      pricing: args.pricingPerMillionTokens({
        input: 1.0,
        output: 5.0,
        sourceUrl: ANTHROPIC_PRICING_URL,
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
  };
}

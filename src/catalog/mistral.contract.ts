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

const MISTRAL_PRICING_URL = "https://mistral.ai/pricing";
const MISTRAL_MODELS_URL = "https://docs.mistral.ai/getting-started/models/";
const MISTRAL_PRICING_UPDATED_AT_20260905 = Date.UTC(2026, 8, 5);

/**
 * Pricing inheritance for Mistral's dated and generation aliases (RM-049).
 *
 * Mistral's pricing page publishes marketing names ("Mistral Small 4"), never API model
 * ids, so "only price a model id that appears verbatim on the pricing page" can only be
 * satisfied by the `*-latest` entries. The generic dated-alias helper does not close the
 * gap either: it recognises `-YYYY-MM-DD` and `-YYYYMMDD` suffixes, while Mistral uses
 * four-digit (`-2604`) and generation (`-3.5`) suffixes.
 *
 * Inherited pricing is emitted with `confidence: "approx"` and a note naming the source
 * model, so it is never presented as a published rate — which is what the exact-id rule
 * exists to prevent.
 *
 * Deliberately excluded:
 * - embedding families (`mistral-embed*`, `codestral-embed*`): input-only pricing that the
 *   token component cannot express without inventing an output rate.
 * - `mistral-code-*`, `mistral-vibe-cli-*`, `mistral-tiny-*`: the vendor publishes no price
 *   row for those families, so there is nothing to inherit from.
 */
export const MISTRAL_PROVIDER_PRICING_FALLBACK_RULES: ProviderPricingFallbackRule[] =
  [
    { match: /^mistral-medium/, baseModelId: "mistral-medium-latest" },
    { match: /^mistral-small/, baseModelId: "mistral-small-latest" },
    { match: /^mistral-large/, baseModelId: "mistral-large-latest" },
    { match: /^ministral-3b/, baseModelId: "ministral-3b-latest" },
    { match: /^ministral-8b/, baseModelId: "ministral-8b-latest" },
    { match: /^ministral-14b/, baseModelId: "ministral-14b-latest" },
    // Anchored on a digit so `codestral-embed*` cannot inherit chat pricing.
    { match: /^codestral-\d/, baseModelId: "codestral-latest" },
  ];

/**
 * Mistral publishes marketing names ("Mistral Small 4"), not API model IDs, so pricing is
 * only attached where the name maps unambiguously to a single `*-latest` catalog entry.
 * Dated aliases (`mistral-medium-2604`, `mistral-small-2603`, ...) are intentionally left
 * unpriced rather than inferred from a base model, per the repo pricing procedure.
 */
const MISTRAL_PRICING_NAME_MAPPING_NOTE =
  "Mistral publishes marketing names rather than API model IDs; this entry is the unambiguous *-latest ID for that row. Snapshot 2026-09-05.";

/**
 * Returns the curated Mistral provider model definitions.
 */
export function buildMistralProviderModelDefinitions(
  args: ProviderCatalogModuleBuildArgs,
): ProviderModelDefinitionInput[] {

  return [
    // Source: Mistral API pricing page + models API snapshot (2026-07-04).
    // Keep this catalog focused on CHAT + EMBEDDING for runtime v1; moderation/ocr families are intentionally excluded.
    {
      id: "mistral-large-latest",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 0.5,
        output: 1.5,
        sourceUrl: MISTRAL_PRICING_URL,
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260905,
        notes: MISTRAL_PRICING_NAME_MAPPING_NOTE,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (text + structured + multimodal)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-29 with the 1024-token baseline. IMAGE passes comprehension verification (dice image correctly identified) across INLINE/URL/ASSET. TEXT fails comprehensionEcho on all source kinds (model-behavior metadata pattern — text part is received but the embedded marker is not echoed back). AUDIO and VIDEO are silently not processed — Mistral standard chat API has no audio/video chunk type; parts are dropped before provider submission. DOCUMENT returns no comprehensionEcho — not supported in standard chat.",
          updatedAt: "2026-06-29",
        },
        updatedAt: "2026-06-29",
      },
    },
    {
      id: "mistral-medium-latest",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 1.5,
        output: 7.5,
        sourceUrl: MISTRAL_PRICING_URL,
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260905,
        notes: MISTRAL_PRICING_NAME_MAPPING_NOTE,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (text + structured + multimodal)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-29 with the 1024-token baseline. IMAGE passes comprehension verification (dice image correctly identified) across INLINE/URL/ASSET. TEXT fails comprehensionEcho on all source kinds (model-behavior metadata pattern — text part is received but the embedded marker is not echoed back). AUDIO and VIDEO are silently not processed — Mistral standard chat API has no audio/video chunk type; parts are dropped before provider submission. DOCUMENT returns no comprehensionEcho — not supported in standard chat.",
          updatedAt: "2026-06-29",
        },
        updatedAt: "2026-06-29",
      },
    },
    {
      id: "mistral-small-latest",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 0.15,
        output: 0.6,
        sourceUrl: MISTRAL_PRICING_URL,
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260905,
        notes: MISTRAL_PRICING_NAME_MAPPING_NOTE,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (text + structured + multimodal)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-28 with the 1024-token baseline. IMAGE passes comprehension verification (dice image correctly identified) across INLINE/URL/ASSET. TEXT fails comprehensionEcho on all source kinds (model-behavior metadata pattern — text part is received but the embedded marker is not echoed back). AUDIO and VIDEO are silently not processed — Mistral standard chat API has no audio/video chunk type; parts are dropped before provider submission. DOCUMENT returns no comprehensionEcho — not supported in standard chat.",
          updatedAt: "2026-06-28",
        },
        updatedAt: "2026-06-29",
      },
    },
    {
      id: "mistral-tiny-latest",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured). Text-only model — image input rejected with upstream 400 PROVIDER_ERROR; no inputParts support.",
        updatedAt: "2026-06-29",
      },
    },
    {
      id: "ministral-14b-latest",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      pricing: args.pricingPerMillionTokens({
        input: 0.2,
        output: 0.2,
        sourceUrl: MISTRAL_PRICING_URL,
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260905,
        notes: MISTRAL_PRICING_NAME_MAPPING_NOTE,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (text + structured + multimodal)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-29 with the 1024-token baseline. IMAGE passes comprehension verification (dice image correctly identified) across INLINE/URL/ASSET. TEXT fails comprehensionEcho on all source kinds (model-behavior metadata pattern — text part is received but the embedded marker is not echoed back). AUDIO and VIDEO are silently not processed — Mistral standard chat API has no audio/video chunk type; parts are dropped before provider submission. DOCUMENT returns no comprehensionEcho — not supported in standard chat.",
          updatedAt: "2026-06-29",
        },
        updatedAt: "2026-06-29",
      },
    },
    {
      id: "ministral-8b-latest",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      publicName: "DCDR Fast",
      badge: "Mistral",
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
      isCategoryDefault: false,
      tokenUsageCovered: true,
      pricing: args.pricingPerMillionTokens({
        input: 0.15,
        output: 0.15,
        sourceUrl: MISTRAL_PRICING_URL,
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260905,
        notes: MISTRAL_PRICING_NAME_MAPPING_NOTE,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (text + structured + multimodal)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.TEXT],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-measured on 2026-09-05 with the unified comprehension-grade curator (RM-050/RM-051): one shared cue definition, one prompt per asset family and a 1024-token budget across every provider, so this rectangle means the same thing as every other provider's. Only TEXT passes across all three source kinds. IMAGE passes on URL but not INLINE/ASSET, and its description is wrong even when it passes (\"Three 3D dice with faces showing white pips\" for a four-coloured-translucent-dice fixture), so it is excluded. AUDIO and VIDEO echo file metadata or hallucinate. DOCUMENT fails schema validation.",
          updatedAt: "2026-09-05",
        },
        updatedAt: "2026-06-29",
      },
    },
    {
      id: "ministral-3b-latest",
      types: [IntentType.CHAT],
      publicForCustomers: true,
      publicName: "DCDR Economy",
      badge: "Lowest cost",
      primaryCategory: args.catalogEnums.publicModelCategory.ECONOMY,
      categories: [args.catalogEnums.publicModelCategory.ECONOMY],
      qualityTier: 2,
      speedTier: 5,
      costTier: 5,
      recommendedUseCases: ["high_volume_classification", "extraction"],
      isRecommended: false,
      isGlobalDefault: false,
      isCategoryDefault: false,
      tokenUsageCovered: true,
      pricing: args.pricingPerMillionTokens({
        input: 0.1,
        output: 0.1,
        sourceUrl: MISTRAL_PRICING_URL,
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260905,
        notes: MISTRAL_PRICING_NAME_MAPPING_NOTE,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (text + structured + multimodal)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.TEXT, AssetType.IMAGE],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Re-measured on 2026-09-05 with the unified comprehension-grade curator (RM-050/RM-051): one shared cue definition, one prompt per asset family and a 1024-token budget across every provider, so this rectangle means the same thing as every other provider's. TEXT and IMAGE pass across INLINE/URL/ASSET. AUDIO and VIDEO are hallucinated rather than perceived — the model described the animal-sound fixture as \"a recording of a person speaking about a meeting\" and the red-flower clip as \"a person standing outdoors holding a smartphone\". DOCUMENT returns no comprehensionEcho.",
          updatedAt: "2026-09-05",
        },
        updatedAt: "2026-06-29",
      },
    },
    {
      id: "codestral-latest",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      pricing: args.pricingPerMillionTokens({
        input: 0.3,
        output: 0.9,
        sourceUrl: MISTRAL_PRICING_URL,
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260905,
        notes: MISTRAL_PRICING_NAME_MAPPING_NOTE,
      }),
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured). Code-specialised model — image input rejected with upstream 400 PROVIDER_ERROR; no inputParts support.",
        updatedAt: "2026-06-29",
      },
    },
    {
      id: "mistral-code-latest",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E (text + structured). Code-specialised model — image input rejected with upstream 400 PROVIDER_ERROR; no inputParts support.",
        updatedAt: "2026-06-29",
      },
    },
    {
      id: "mistral-vibe-cli-latest",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason: "Validated via provider E2E (text + structured + multimodal)",
        inputParts: {
          status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
          supportedAssetTypes: [AssetType.IMAGE],
          supportedSourceKinds: [
            ExecutionPartSourceKind.INLINE,
            ExecutionPartSourceKind.URL,
            ExecutionPartSourceKind.ASSET,
          ],
          notes:
            "Curated on 2026-06-29 with the 1024-token baseline. IMAGE passes comprehension verification (dice image correctly identified) across INLINE/URL/ASSET. TEXT fails comprehensionEcho on all source kinds (model-behavior metadata pattern — text part is received but the embedded marker is not echoed back). AUDIO and VIDEO are silently not processed — Mistral standard chat API has no audio/video chunk type; parts are dropped before provider submission. DOCUMENT returns no comprehensionEcho — not supported in standard chat.",
          updatedAt: "2026-06-29",
        },
        updatedAt: "2026-06-29",
      },
    },
    {
      id: "codestral-2508",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E on 2026-09-05 (text + structured).",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "codestral-embed",
      types: [IntentType.EMBEDDING],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; embedding adapter and curation are not implemented yet.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "codestral-embed-2505",
      types: [IntentType.EMBEDDING],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; embedding adapter and curation are not implemented yet.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "ministral-14b-2512",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E on 2026-09-05 (text + structured).",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "ministral-3b-2512",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E on 2026-09-05 (text + structured).",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "ministral-8b-2512",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E on 2026-09-05 (text + structured).",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "mistral-code-agent-latest",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this code-agent chat family.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-code-fim-latest",
      types: [IntentType.CHAT],
      tokenUsageCovered: true,
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.SUPPORTED,
        reason:
          "Validated via provider E2E on 2026-09-05 (text + structured).",
        updatedAt: "2026-09-05",
      },
    },
    {
      id: "mistral-embed",
      types: [IntentType.EMBEDDING],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; embedding adapter and curation are not implemented yet.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-embed-2312",
      types: [IntentType.EMBEDDING],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; embedding adapter and curation are not implemented yet.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-large-2512",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this dated chat alias.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-medium",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this chat alias.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-medium-2505",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this legacy dated chat alias.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-medium-2508",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this legacy dated chat alias.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-medium-2604",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this dated chat alias.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-medium-3",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this chat family.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-medium-3-5",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this chat family alias.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-medium-3.5",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this chat family alias.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-small-2506",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this legacy dated chat alias.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-small-2603",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this dated chat alias.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-tiny-2407",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this dated chat alias.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-vibe-cli-fast",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this chat/tooling family.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "mistral-vibe-cli-with-tools",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this chat/tooling family.",
        updatedAt: "2026-07-04",
      },
    },
  ];
}

/**
 * Returns the E2E override map for Mistral provider models.
 */
export function buildMistralProviderModelE2EOverrides(
  args: ProviderCatalogModuleBuildArgs,
): Record<string, ProviderModelE2EOverride> {
  return {
    "mistral-medium-2505": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Legacy/deprecated in current Mistral models documentation",
    },
    "mistral-medium-2508": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Legacy/deprecated in current Mistral models documentation",
    },
    "mistral-small-2506": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "Legacy/deprecated in current Mistral models documentation",
    },

    // No longer returned by Mistral /v1/models (2026-09-05 sync). Availability is E2E
    // scope, so the catalog keeps each entry and its last observed runtimeSupport.
    "mistral-large-latest": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "No longer listed by Mistral /v1/models (2026-09-05 sync)",
    },
    "mistral-large-2512": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "No longer listed by Mistral /v1/models (2026-09-05 sync)",
    },
    "mistral-tiny-latest": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "No longer listed by Mistral /v1/models (2026-09-05 sync)",
    },
    "mistral-tiny-2407": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "No longer listed by Mistral /v1/models (2026-09-05 sync)",
    },
    "mistral-code-agent-latest": {
      status: args.catalogEnums.e2eStatus.LEGACY,
      reason: "No longer listed by Mistral /v1/models (2026-09-05 sync)",
    },
  };
}

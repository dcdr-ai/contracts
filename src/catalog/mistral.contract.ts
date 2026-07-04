import { AssetType } from "../asset.contract";
import { ExecutionPartSourceKind } from "../execution.contract";
import { IntentType } from "../intent.contract";
import type {
  ProviderCatalogModuleBuildArgs,
  ProviderModelDefinitionInput,
  ProviderModelE2EOverride,
  ProviderModelParameterSupportInfo,
} from "../provider.catalog.contract";

const MISTRAL_PRICING_URL = "https://mistral.ai/pricing";
const MISTRAL_MODELS_URL = "https://docs.mistral.ai/getting-started/models/";
const MISTRAL_PRICING_UPDATED_AT_20260522 = Date.UTC(2026, 4, 22);

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
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260522,
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
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260522,
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
        input: 0.1,
        output: 0.3,
        sourceUrl: MISTRAL_PRICING_URL,
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260522,
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
      pricing: args.pricingPerMillionTokens({
        input: 0.2,
        output: 0.2,
        sourceUrl: MISTRAL_PRICING_URL,
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260522,
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
      pricing: args.pricingPerMillionTokens({
        input: 0.15,
        output: 0.15,
        sourceUrl: MISTRAL_PRICING_URL,
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260522,
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
      id: "ministral-3b-latest",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 0.1,
        output: 0.1,
        sourceUrl: MISTRAL_PRICING_URL,
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260522,
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
            "Curated on 2026-06-29 with the 1024-token baseline. IMAGE passes comprehension verification (dice image correctly identified) across INLINE/URL/ASSET — vision support is not advertised for this edge model but passes comprehension cues cleanly. TEXT fails comprehensionEcho on all source kinds (model-behavior metadata pattern — text part is received but the embedded marker is not echoed back). AUDIO and VIDEO are silently not processed — Mistral standard chat API has no audio/video chunk type; parts are dropped before provider submission. DOCUMENT returns no comprehensionEcho — not supported in standard chat.",
          updatedAt: "2026-06-29",
        },
        updatedAt: "2026-06-29",
      },
    },
    {
      id: "codestral-latest",
      types: [IntentType.CHAT],
      pricing: args.pricingPerMillionTokens({
        input: 0.3,
        output: 0.9,
        sourceUrl: MISTRAL_PRICING_URL,
        updatedAt: MISTRAL_PRICING_UPDATED_AT_20260522,
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
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this code-specialised chat alias.",
        updatedAt: "2026-07-04",
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
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this dated chat alias.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "ministral-3b-2512",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this dated chat alias.",
        updatedAt: "2026-07-04",
      },
    },
    {
      id: "ministral-8b-2512",
      types: [IntentType.CHAT],
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this dated chat alias.",
        updatedAt: "2026-07-04",
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
      runtimeSupport: {
        status: args.catalogEnums.runtimeSupportStatus.IN_PROGRESS,
        reason:
          "Discovered via Mistral /v1/models; pending provider E2E curation for this code-completion chat family.",
        updatedAt: "2026-07-04",
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
  };
}

import { AssetType } from "./asset.contract";
import {
  ExecutionPartSourceKind,
  ExecutionPartType,
} from "./execution.contract";
import { IntentType } from "./intent.contract";
import { IntentProvider } from "./provider.contract";
import {
  ANTHROPIC_PROVIDER_PRICING_FALLBACK_RULES,
  buildAnthropicProviderModelDefinitions,
  buildAnthropicProviderModelE2EOverrides,
} from "./catalog/anthropic.contract";
import {
  buildClipProviderModelDefinitions,
  buildClipProviderModelE2EOverrides,
} from "./catalog/clip.contract";
import {
  buildCohereProviderModelDefinitions,
  buildCohereProviderModelE2EOverrides,
} from "./catalog/cohere.contract";
import {
  buildDcdrProviderModelDefinitions,
  buildDcdrProviderModelE2EOverrides,
} from "./catalog/dcdr.contract";
import {
  buildGeminiProviderModelDefinitions,
  buildGeminiProviderModelE2EOverrides,
} from "./catalog/gemini.contract";
import {
  buildGrokProviderModelDefinitions,
  buildGrokProviderModelE2EOverrides,
} from "./catalog/grok.contract";
import {
  buildHttpToolProviderModelDefinitions,
  buildHttpToolProviderModelE2EOverrides,
} from "./catalog/http-tool.contract";
import {
  buildMistralProviderModelDefinitions,
  buildMistralProviderModelE2EOverrides,
} from "./catalog/mistral.contract";
import {
  buildOcrProviderModelDefinitions,
  buildOcrProviderModelE2EOverrides,
} from "./catalog/ocr.contract";
import {
  buildOfficeProviderModelDefinitions,
  buildOfficeProviderModelE2EOverrides,
} from "./catalog/office.contract";
import {
  buildOllamaProviderModelDefinitions,
  buildOllamaProviderModelE2EOverrides,
} from "./catalog/ollama.contract";
import {
  buildOpenAICompatibleProviderModelDefinitions,
  buildOpenAICompatibleProviderModelE2EOverrides,
} from "./catalog/openai-compatible.contract";
import {
  OPENAI_PROVIDER_PRICING_FALLBACK_RULES,
  buildOpenAIProviderModelDefinitions,
  buildOpenAIProviderModelE2EOverrides,
} from "./catalog/openai.contract";
import {
  buildRulesProviderModelDefinitions,
  buildRulesProviderModelE2EOverrides,
} from "./catalog/rules.contract";

export interface ProviderPricingMeta {
  currency: "USD" | "EURO" | "GBP" | string;
  /** Optional URL to the provider pricing page used as the source. */
  sourceUrl?: string;
  /** Timestamp (ms) indicating when this pricing snapshot was last updated. */
  updatedAt: number;
  /** How confident this data is (design-time friendly). */
  confidence?: "official" | "approx" | "unknown";
  notes?: string;
}

export type ProviderPricingComponent =
  | {
      kind: "tokens";
      unit: "per_million_tokens";
      input: number;
      outputUsd: number;
      cachedInput?: number;
      cachedOutput?: number;
      /** Optional tiered pricing (e.g. different rates by modality or prompt size). */
      tiers?: Array<{
        name: string;
        condition?: string;
        input: number;
        output: number;
        cachedInput?: number;
        cachedOutput?: number;
      }>;
      notes?: string;
    }
  | {
      kind: "characters";
      unit: "per_million_characters";
      input: number;
      notes?: string;
    }
  | {
      kind: "audio_minutes";
      unit: "per_minute";
      input: number;
      output?: number;
      notes?: string;
    }
  | {
      kind: "images";
      unit: "per_image";
      input?: number;
      output?: number;
      notes?: string;
    }
  | {
      kind: "video_seconds";
      unit: "per_second";
      input?: number;
      output?: number;
      notes?: string;
    }
  | {
      kind: "pages";
      unit: "per_1000_pages";
      input?: number;
      output?: number;
      notes?: string;
    };

export interface ProviderModelPricing extends ProviderPricingMeta {
  components: ProviderPricingComponent[];
}

/** Runtime-level support status for a (provider, modelId) pair. */
export enum ProviderModelRuntimeSupportStatus {
  /** Supported by this runtime (intended to work). */
  SUPPORTED = "SUPPORTED",

  /** Explicitly not supported by this runtime (do not attempt provider calls). */
  NOT_SUPPORTED = "NOT_SUPPORTED",

  /** Known failing in current runtime; keep visible but treat as unstable. */
  FAILING = "FAILING",

  /** Under active implementation/curation; not yet reliable. */
  IN_PROGRESS = "IN_PROGRESS",
}

/** Canonical provider API surface preferred by the runtime for a model family. */
export enum ProviderModelPreferredApi {
  CHAT_COMPLETIONS = "CHAT_COMPLETIONS",
  RESPONSES = "RESPONSES",
}

/** Generic prompt/runtime parameter keys that can be exposed to users (UI) and adapters. */
export enum PromptParameterKey {
  TEMPERATURE = "temperature",
  TOP_P = "top_p",
  TOP_K = "top_k",
  MAX_TOKENS = "max_tokens",
  ENABLE_THINKING = "enable_thinking",
  RESPONSE_FORMAT = "response_format",
  PRESENCE_PENALTY = "presence_penalty",
  FREQUENCY_PENALTY = "frequency_penalty",
}

/** Runtime-level parameter support status for a specific model. */
export enum ProviderModelParameterSupportStatus {
  SUPPORTED = "SUPPORTED",

  /** Parameter is not supported and should not be sent. */
  NOT_SUPPORTED = "NOT_SUPPORTED",

  /** Only provider default is supported; runtime should avoid sending custom values. */
  DEFAULT_ONLY = "DEFAULT_ONLY",
}

/** Optional parameter support metadata attached to a model definition (for UI and adapter normalization). */
export interface ProviderModelParameterSupportInfo {
  /** Per-parameter support mapping. Omitted keys mean "unknown" (use adapter defaults). */
  parameters?: Partial<
    Record<PromptParameterKey, ProviderModelParameterSupportStatus>
  >;

  /** Optional recommendations to avoid common misconfiguration. */
  recommended?: {
    /** Recommended minimum `max_tokens` to avoid empty/reasoning-only outputs on some models. */
    minMaxTokens?: number;

    /**
     * When true, adapters may proactively disable provider reasoning/thinking unless explicitly enabled.
     *
     * Notes
     * - This is adapter guidance, not a user-facing runtime default.
     * - Keep this generic so any provider can opt in without provider-specific contract fields.
     */
    disableThinkingByDefault?: boolean;

    /**
     * When true, adapters may use the provider's native structured-output mechanism instead of prompt-only JSON steering.
     *
     * Notes
     * - This is narrower than generic `response_format` availability.
     * - Models without this hint may still support structured output through prompt-only normalization.
     */
    useNativeStructuredOutput?: boolean;
  };

  /** Human-readable notes (safe for UI/logs). */
  notes?: string;

  /** ISO date string of last verification (e.g. from E2E/probes). */
  updatedAt?: string;
}

/** Optional runtime support metadata attached to a model definition. */
export interface ProviderModelRuntimeSupportInfo {
  status: ProviderModelRuntimeSupportStatus;
  preferredApi?: ProviderModelPreferredApi;
  /** Optional curated support state for multimodal execution inputParts. */
  inputParts?: ProviderModelInputPartsSupportInfo;
  /** Optional curated support state for multimodal execution outputParts. */
  outputParts?: ProviderModelOutputPartsSupportInfo;
  /** Human-readable notes (safe for logs/CI). */
  reason?: string;
  /** ISO date string of last verification (e.g. from E2E/probes). */
  updatedAt?: string;
}

/** Optional curated support metadata for `inputParts` accepted by a model/runtime path. */
export interface ProviderModelInputPartsSupportInfo {
  /** Curated status for the currently validated input-part matrix. */
  status: ProviderModelRuntimeSupportStatus;
  /** Asset families verified so far through provider/runtime validation. */
  supportedAssetTypes?: AssetType[];
  /** Source kinds verified so far through provider/runtime validation. */
  supportedSourceKinds?: ExecutionPartSourceKind[];
  /** Human-readable notes (safe for logs/CI). */
  notes?: string;
  /** ISO date string of last verification (e.g. from E2E/probes). */
  updatedAt?: string;
}

/** Optional curated support metadata for `outputParts` emitted by a model/runtime path. */
export interface ProviderModelOutputPartsSupportInfo {
  /** Curated status for the currently validated output-part matrix. */
  status: ProviderModelRuntimeSupportStatus;
  /** Output part families verified so far through provider/runtime validation. */
  supportedPartTypes?: ExecutionPartType[];
  /** Source kinds verified so far through provider/runtime validation. */
  supportedSourceKinds?: ExecutionPartSourceKind[];
  /** Human-readable notes (safe for logs/CI). */
  notes?: string;
  /** ISO date string of last verification (e.g. from E2E/probes). */
  updatedAt?: string;
}

/**
 * Product-level managed categories for public customer models.
 *
 * Purpose
 * - Provide a stable grouping/filtering abstraction for customer-facing UIs.
 * - Avoid exposing a flat provider/model list by default.
 */
export enum DcdrPublicModelCategory {
  /** Maximum quality / strongest reasoning; typically expensive. */
  BEST = "BEST",

  /** Best balance between quality and cost; recommended default for production chat. */
  SMART = "SMART",

  /** Low latency; good for interactive chat/support. */
  FAST = "FAST",

  /** Lowest cost; good for high-volume simple tasks. */
  ECONOMY = "ECONOMY",

  /** Internal/local/company-managed models (self-hosted, Office, etc.). */
  PRIVATE = "PRIVATE",
}

/**
 * Canonical (de-duplicated) model definition.
 *
 * A single model can support multiple IntentType(s). Keeping the model metadata in one place
 * avoids duplicating fields like cost/capabilities across multiple per-type listings.
 */
export interface ProviderModelDefinition {
  id: string;
  types: IntentType[];
  /**
   * If true, this model is eligible for customer-facing UIs.
   *
   * Notes
   * - Fail-closed: missing/undefined is treated as false by the catalog normalizer.
   * - This does not affect runtime execution support; it is a UI curation flag.
   */
  publicForCustomers: boolean;

  /** Stable customer-facing family name for managed public models (should not expose provider/model IDs). */
  publicName?: string;

  /** Small variant label displayed next to `publicName` (e.g. "OpenAI", "Fast", "Lowest cost"). */
  badge?: string;

  /** Primary managed category used for default grouping in simple UI mode. */
  primaryCategory?: DcdrPublicModelCategory;

  /** Additional managed categories/tags for badges and advanced filtering. */
  categories?: DcdrPublicModelCategory[];

  /** Quality tier (1..5), where 5 is best. */
  qualityTier?: number;

  /** Speed tier (1..5), where 5 is best. */
  speedTier?: number;

  /** Cost tier (1..5), where 5 is best (lowest cost). */
  costTier?: number;

  /** Optional suggested use cases (safe for UI). */
  recommendedUseCases?: string[];

  /** Model is generally recommended to customers. */
  isRecommended?: boolean;

  /** Global default model when the user has not chosen any model/category. Exactly one public model should be true. */
  isGlobalDefault?: boolean;

  /** Default model within its primaryCategory when a category is chosen but no specific model is selected. */
  isCategoryDefault?: boolean;

  /**
   * When true, this model has been verified (via E2E) to return token usage (`promptTokens`/`completionTokens`/`totalTokens`)
   * in the runtime execution report.
   *
   * Notes
   * - This is a billing invariant: public customer models must have token usage tracking.
   * - Missing/undefined is treated as false (fail-closed).
   */
  tokenUsageCovered?: boolean;
  pricing?: ProviderModelPricing;
  runtimeSupport?: ProviderModelRuntimeSupportInfo;
  parameterSupport?: ProviderModelParameterSupportInfo;
}

/**
 * Stricter shape for public customer models.
 *
 * Notes
 * - This is an additive (non-breaking) interface.
 * - The catalog normalizer enforces these fields at runtime for models where `publicForCustomers === true`.
 */
export interface ProviderPublicCustomerModelDefinition extends ProviderModelDefinition {
  publicForCustomers: true;
  publicName: string;
  badge?: string;
  tokenUsageCovered: boolean;
  primaryCategory: DcdrPublicModelCategory;
  categories: DcdrPublicModelCategory[];
  qualityTier: number;
  speedTier: number;
  costTier: number;
  recommendedUseCases: string[];
  isRecommended: boolean;
  isGlobalDefault: boolean;
  isCategoryDefault: boolean;
}

/**
 * Input shape for the provider model catalog.
 *
 * `publicForCustomers` is optional here to keep the catalog authoring low-noise;
 * it is normalized to a required boolean in `ProviderModelDefinition`.
 */
export interface ProviderModelDefinitionInput {
  id: string;
  types: IntentType[];
  publicForCustomers?: boolean;
  publicName?: string;
  badge?: string;
  tokenUsageCovered?: boolean;
  primaryCategory?: DcdrPublicModelCategory;
  categories?: DcdrPublicModelCategory[];
  qualityTier?: number;
  speedTier?: number;
  costTier?: number;
  recommendedUseCases?: string[];
  isRecommended?: boolean;
  isGlobalDefault?: boolean;
  isCategoryDefault?: boolean;
  pricing?: ProviderModelPricing;
  runtimeSupport?: ProviderModelRuntimeSupportInfo;
  parameterSupport?: ProviderModelParameterSupportInfo;
}

/** Options for ProviderModelRegistry.listProviderModels(...). */
export interface ProviderModelListProviderModelsOptions {
  /** When true, only returns models explicitly curated for customer-facing UIs. */
  onlyPublicForCustomers?: boolean;
}

/** Provider + model pairing for public customer model listing helpers. */
export interface ProviderPublicCustomerModelRef {
  provider: IntentProvider;
  modelId: string;
  model: ProviderPublicCustomerModelDefinition;
}

/** Options for ProviderModelRegistry.listPublicCustomerModels(...). */
export interface ProviderModelListPublicCustomerModelsOptions {
  /** Optional filter: only include models whose primaryCategory matches this value. */
  primaryCategory?: DcdrPublicModelCategory;

  /** Optional filter: only include models that contain at least one of these categories. */
  includeCategories?: DcdrPublicModelCategory[];
}

export interface ProviderPricingFallbackRule {
  /** If the modelId matches this rule, attempt to inherit pricing from baseModelId. */
  match: RegExp;
  baseModelId: string;
}

export interface ProviderCatalogModuleBuildArgs {
  pricingPerMillionTokens: (args: {
    input: number;
    output: number;
    cachedInput?: number;
    cachedOutput?: number;
    tiers?: Array<{
      name: string;
      condition?: string;
      input: number;
      output: number;
      cachedInput?: number;
      cachedOutput?: number;
    }>;
    sourceUrl: string;
    updatedAt?: number;
    confidence?: ProviderModelPricing["confidence"];
    notes?: string;
  }) => ProviderModelPricing;
  pricingAudioMinutesPerMinute: (args: {
    input: number;
    sourceUrl: string;
    updatedAt?: number;
    confidence?: ProviderModelPricing["confidence"];
    notes?: string;
  }) => ProviderModelPricing;
  catalogEnums: {
    runtimeSupportStatus: typeof ProviderModelRuntimeSupportStatus;
    preferredApi: typeof ProviderModelPreferredApi;
    promptParameterKey: typeof PromptParameterKey;
    parameterSupportStatus: typeof ProviderModelParameterSupportStatus;
    publicModelCategory: typeof DcdrPublicModelCategory;
    get e2eStatus(): typeof ProviderModelE2EStatus;
  };
}

const DEFAULT_TOKEN_PRICING_UPDATED_AT = Date.UTC(2026, 2, 27);
const DEFAULT_AUDIO_PRICING_UPDATED_AT = Date.UTC(2026, 4, 22);

const PRICING_FALLBACK_RULES_BY_PROVIDER: Record<
  IntentProvider,
  ProviderPricingFallbackRule[]
> = {
  [IntentProvider.DCDR]: [],
  [IntentProvider.OPEN_AI]: OPENAI_PROVIDER_PRICING_FALLBACK_RULES,
  [IntentProvider.ANTHROPIC]: ANTHROPIC_PROVIDER_PRICING_FALLBACK_RULES,
  [IntentProvider.GEMINI]: [],
  [IntentProvider.GROK]: [],
  [IntentProvider.MISTRAL]: [],
  [IntentProvider.COHERE]: [],
  [IntentProvider.OFFICE]: [],
  [IntentProvider.OLLAMA]: [],
  [IntentProvider.OPEN_AI_COMPATIBLE]: [],
  [IntentProvider.OCR]: [],
  [IntentProvider.CLIP]: [],
  [IntentProvider.HTTP_TOOL]: [],
  [IntentProvider.RULES]: [],
};

const PROVIDER_CATALOG_MODULE_BUILD_ARGS: ProviderCatalogModuleBuildArgs = {
  pricingPerMillionTokens,
  pricingAudioMinutesPerMinute,
  catalogEnums: {
    runtimeSupportStatus: ProviderModelRuntimeSupportStatus,
    preferredApi: ProviderModelPreferredApi,
    promptParameterKey: PromptParameterKey,
    parameterSupportStatus: ProviderModelParameterSupportStatus,
    publicModelCategory: DcdrPublicModelCategory,
    get e2eStatus() {
      return ProviderModelE2EStatus;
    },
  },
};

const DCDR_VIRTUAL_PROVIDER_PREFIX_BY_PROVIDER: Partial<
  Record<IntentProvider, string>
> = {
  [IntentProvider.OPEN_AI]: "openai",
  [IntentProvider.ANTHROPIC]: "anthropic",
  [IntentProvider.GEMINI]: "gemini",
  [IntentProvider.GROK]: "grok",
  [IntentProvider.MISTRAL]: "mistral",
  [IntentProvider.OFFICE]: "office",
};

const DCDR_VIRTUAL_PROVIDER_BY_PREFIX: Record<string, IntentProvider> = {
  openai: IntentProvider.OPEN_AI,
  anthropic: IntentProvider.ANTHROPIC,
  gemini: IntentProvider.GEMINI,
  grok: IntentProvider.GROK,
  xai: IntentProvider.GROK,
  mistral: IntentProvider.MISTRAL,
  office: IntentProvider.OFFICE,
};

export interface DcdrVirtualModelResolution {
  provider: IntentProvider;
  modelId: string;
  prefixedModelId: string;
}

/**
 * Formats a DCDR virtual provider model id as `provider/model`.
 *
 * Returns an empty string for unsupported provider prefixes.
 */
export function formatDcdrVirtualModelId(
  provider: IntentProvider,
  modelId: string,
): string {
  const prefix = DCDR_VIRTUAL_PROVIDER_PREFIX_BY_PROVIDER[provider];
  if (!prefix) return "";
  const id = String(modelId ?? "").trim();
  if (!id) return "";
  return `${prefix}/${id}`;
}

/**
 * Parses a DCDR virtual provider model id of the form `provider/model`.
 *
 * Returns null when the id is not a valid DCDR virtual model id.
 */
export function parseDcdrVirtualModelId(
  prefixedModelId: string,
): DcdrVirtualModelResolution | null {
  const raw = String(prefixedModelId ?? "").trim();
  if (!raw) return null;

  const idx = raw.indexOf("/");
  if (idx <= 0 || idx >= raw.length - 1) return null;

  const prefix = raw.slice(0, idx).trim().toLowerCase();
  const modelId = raw.slice(idx + 1).trim();
  if (!prefix || !modelId) return null;

  const provider = DCDR_VIRTUAL_PROVIDER_BY_PREFIX[prefix];
  if (!provider) return null;

  return { provider, modelId, prefixedModelId: raw };
}

/**
 * Builds a virtual provider model list for `IntentProvider.DCDR`.
 *
 * Goal
 * - Allow DCDR to reference any model that DCDR runtime explicitly supports.
 *
 * Rules
 * - For hosted providers (OpenAI/Anthropic/Gemini/Grok/Mistral): include only models marked `runtimeSupport.status=SUPPORTED`.
 * - For `OFFICE`: include all declared models (local/runtime-managed; support is deployment-dependent).
 * - Stable deterministic ordering: provider order then model declaration order.
 */
function buildDcdrVirtualProviderModelDefinitions(
  modelsByProvider: Record<IntentProvider, ProviderModelDefinition[]>,
): ProviderModelDefinition[] {
  const providers: IntentProvider[] = [
    IntentProvider.OPEN_AI,
    IntentProvider.ANTHROPIC,
    IntentProvider.GEMINI,
    IntentProvider.GROK,
    IntentProvider.MISTRAL,
    IntentProvider.OFFICE,
  ];

  const out: ProviderModelDefinition[] = [];

  for (const provider of providers) {
    const defs = modelsByProvider[provider] ?? [];
    for (const def of defs) {
      const isOffice = provider === IntentProvider.OFFICE;
      const isSupported =
        def.runtimeSupport?.status ===
        ProviderModelRuntimeSupportStatus.SUPPORTED;
      if (!isOffice && !isSupported) continue;

      const prefixedId = formatDcdrVirtualModelId(provider, def.id);
      if (!prefixedId) continue;

      out.push({
        ...def,
        id: prefixedId,
        publicForCustomers: false,
      });
    }
  }

  return out;
}

/**
 * Canonical provider model catalog (single source of truth).
 */
const PROVIDER_MODEL_DEFINITIONS_BY_PROVIDER_RAW: Record<
  IntentProvider,
  ProviderModelDefinitionInput[]
> = {
  [IntentProvider.DCDR]: buildDcdrProviderModelDefinitions(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.OPEN_AI]: buildOpenAIProviderModelDefinitions(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.GEMINI]: buildGeminiProviderModelDefinitions(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.GROK]: buildGrokProviderModelDefinitions(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.ANTHROPIC]: buildAnthropicProviderModelDefinitions(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.MISTRAL]: buildMistralProviderModelDefinitions(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.COHERE]: buildCohereProviderModelDefinitions(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.OFFICE]: buildOfficeProviderModelDefinitions(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.OLLAMA]: buildOllamaProviderModelDefinitions(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.OPEN_AI_COMPATIBLE]:
    buildOpenAICompatibleProviderModelDefinitions(
      PROVIDER_CATALOG_MODULE_BUILD_ARGS,
    ),
  [IntentProvider.OCR]: buildOcrProviderModelDefinitions(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.CLIP]: buildClipProviderModelDefinitions(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.HTTP_TOOL]: buildHttpToolProviderModelDefinitions(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.RULES]: buildRulesProviderModelDefinitions(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
};

/**
 * Token usage coverage overrides derived from provider E2E curation runs.
 *
 * Notes
 * - This is intended to be filled iteratively (in batches) as we validate token usage reporting
 *   for all `runtimeSupport.status=SUPPORTED` chat models.
 * - These overrides only apply when a model definition omits `tokenUsageCovered`.
 *   (Public customer models still require `tokenUsageCovered=true` on the definition itself.)
 */
const TOKEN_USAGE_COVERAGE_BY_PROVIDER_AND_ID: Partial<
  Record<IntentProvider, Record<string, boolean>>
> = {
  [IntentProvider.OPEN_AI]: {
    "gpt-5.5-2026-04-23": true,
    "gpt-5.5-pro": true,
    "gpt-5.5-pro-2026-04-23": true,
    "gpt-5.4-2026-03-05": true,
    "gpt-5.4-mini-2026-03-17": true,
    "gpt-5.4-nano-2026-03-17": true,
    "gpt-5.4-pro": true,
    "gpt-5.4-pro-2026-03-05": true,
    "gpt-5.3-chat-latest": true,
    "gpt-5.3-codex": true,
    "gpt-5.2": true,
    "gpt-5.2-2025-12-11": true,
    "gpt-5.2-chat-latest": true,
    "gpt-5.2-codex": true,
    "gpt-5.2-pro": true,
    "gpt-5.2-pro-2025-12-11": true,
    "gpt-5.1": true,
    "gpt-5.1-2025-11-13": true,
    "gpt-5.1-chat-latest": true,
    "gpt-5.1-codex": true,
    "gpt-5.1-codex-max": true,
    "gpt-5.1-codex-mini": true,
    "gpt-5": true,
    "gpt-5-2025-08-07": true,
    "gpt-5-chat-latest": true,
    "gpt-5-codex": true,
    "gpt-5-mini": true,
    "gpt-5-mini-2025-08-07": true,
    "gpt-5-nano": true,
    "gpt-5-nano-2025-08-07": true,
    "gpt-5-pro": true,
    "gpt-5-pro-2025-10-06": true,
    "gpt-4.1": true,
    "gpt-4.1-2025-04-14": true,
    "gpt-4.1-mini": true,
    "gpt-4.1-mini-2025-04-14": true,
    "gpt-4.1-nano": true,
    "gpt-4.1-nano-2025-04-14": true,
    "gpt-4o": true,
    "gpt-4o-2024-08-06": true,
    "gpt-4o-2024-11-20": true,
    "gpt-4o-mini": true,
    "gpt-4o-mini-2024-07-18": true,
    "gpt-4o-2024-05-13": true,
    "gpt-4-turbo": true,
    "gpt-4-turbo-2024-04-09": true,
    "gpt-4": true,
    "gpt-4-0613": true,
    "gpt-3.5-turbo": true,
    "gpt-3.5-turbo-0125": true,
    "gpt-3.5-turbo-1106": true,
    "gpt-3.5-turbo-16k": true,
    "o4-mini": true,
    "o4-mini-2025-04-16": true,
    "o3-pro": true,
    "o3-pro-2025-06-10": true,
    o3: true,
    "o3-2025-04-16": true,
    "o3-mini": true,
    "o3-mini-2025-01-31": true,
    "o1-pro": true,
    "o1-pro-2025-03-19": true,
    o1: true,
    "o1-2024-12-17": true,
  },
  [IntentProvider.GEMINI]: {
    "gemini-3.1-pro-preview-customtools": true,
    "gemini-3.1-flash-lite-preview": true,
    "gemini-3.1-flash-lite": true,
    "gemini-3.1-flash-image-preview": true,
    "gemini-3-pro-preview": false,
    "gemini-2.5-flash-image": true,
    "gemini-flash-latest": true,
    "gemini-flash-lite-latest": true,
    "gemini-pro-latest": true,
  },
  [IntentProvider.ANTHROPIC]: {
    "claude-opus-4-6": true,
    "claude-opus-4-5-20251101": true,
    "claude-opus-4-1-20250805": true,
    "claude-sonnet-4-5-20250929": true,
    "claude-haiku-4-5-20251001": true,
  },
  [IntentProvider.OFFICE]: {},
};

function getTokenUsageCoveredOverride(
  provider: IntentProvider,
  modelId: string,
): boolean | undefined {
  return TOKEN_USAGE_COVERAGE_BY_PROVIDER_AND_ID[provider]?.[modelId];
}

/** Normalizes catalog entries so optional flags become required (fail-closed). */
function normalizeProviderModelDefinitions(
  modelsByProvider: Record<IntentProvider, ProviderModelDefinitionInput[]>,
): Record<IntentProvider, ProviderModelDefinition[]> {
  const out = {} as Record<IntentProvider, ProviderModelDefinition[]>;

  let globalDefaultCount = 0;
  const categoryDefaultCounts = new Map<DcdrPublicModelCategory, number>();
  const categoriesWithPublicModels = new Set<DcdrPublicModelCategory>();

  const assertTier = (
    provider: IntentProvider,
    modelId: string,
    field: string,
    value: number,
  ): void => {
    if (!Number.isFinite(value)) {
      throw new Error(
        `Provider model catalog: ${provider}/${modelId} ${field} must be a finite number (1..5).`,
      );
    }
    const n = Math.trunc(value);
    if (n !== value || n < 1 || n > 5) {
      throw new Error(
        `Provider model catalog: ${provider}/${modelId} ${field} must be an integer in range 1..5.`,
      );
    }
  };

  const assertNoLegacyManagedFields = (
    provider: IntentProvider,
    modelId: string,
    def: ProviderModelDefinitionInput,
  ): void => {
    const d = def as unknown as Record<string, unknown>;
    const legacyFields = [
      "publicDisplayName",
      "isRecommendedDefault",
      "default",
    ];
    for (const f of legacyFields) {
      if (Object.prototype.hasOwnProperty.call(d, f)) {
        throw new Error(
          `Provider model catalog: ${provider}/${modelId} must not include legacy field '${f}'.`,
        );
      }
    }
  };

  const assertNonEmptyStringArray = (
    provider: IntentProvider,
    modelId: string,
    field: string,
    value: string[],
  ): void => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(
        `Provider model catalog: ${provider}/${modelId} ${field} must be a non-empty string array.`,
      );
    }
    for (const v of value) {
      if (typeof v !== "string" || !v.trim()) {
        throw new Error(
          `Provider model catalog: ${provider}/${modelId} ${field} must contain only non-empty strings.`,
        );
      }
    }
  };

  for (const provider of Object.values(IntentProvider) as IntentProvider[]) {
    const defs = modelsByProvider[provider] ?? [];

    const ids = new Set<string>();

    out[provider] = defs.map((def) => {
      assertNoLegacyManagedFields(provider, def.id, def);

      if (ids.has(def.id)) {
        throw new Error(
          `Provider model catalog: duplicate modelId '${def.id}' for provider ${provider}.`,
        );
      }
      ids.add(def.id);

      const tokenUsageCoveredOverride = getTokenUsageCoveredOverride(
        provider,
        def.id,
      );

      const normalized: ProviderModelDefinition = {
        ...def,
        publicForCustomers: def.publicForCustomers === true,
        tokenUsageCovered: def.tokenUsageCovered ?? tokenUsageCoveredOverride,
      };

      if (normalized.publicForCustomers) {
        if (normalized.tokenUsageCovered !== true) {
          throw new Error(
            `Provider model catalog: ${provider}/${normalized.id} tokenUsageCovered=true is required for publicForCustomers models.`,
          );
        }
        if (!normalized.publicName?.trim()) {
          throw new Error(
            `Provider model catalog: ${provider}/${normalized.id} publicName is required for publicForCustomers models.`,
          );
        }
        if (!normalized.primaryCategory) {
          throw new Error(
            `Provider model catalog: ${provider}/${normalized.id} primaryCategory is required for publicForCustomers models.`,
          );
        }
        if (
          !Array.isArray(normalized.categories) ||
          normalized.categories.length === 0
        ) {
          throw new Error(
            `Provider model catalog: ${provider}/${normalized.id} categories is required for publicForCustomers models.`,
          );
        }
        if (!normalized.categories.includes(normalized.primaryCategory)) {
          throw new Error(
            `Provider model catalog: ${provider}/${normalized.id} categories must include primaryCategory (${normalized.primaryCategory}).`,
          );
        }

        categoriesWithPublicModels.add(normalized.primaryCategory);

        if (typeof normalized.isRecommended !== "boolean") {
          throw new Error(
            `Provider model catalog: ${provider}/${normalized.id} isRecommended is required for publicForCustomers models.`,
          );
        }
        if (typeof normalized.isGlobalDefault !== "boolean") {
          throw new Error(
            `Provider model catalog: ${provider}/${normalized.id} isGlobalDefault is required for publicForCustomers models.`,
          );
        }
        if (typeof normalized.isCategoryDefault !== "boolean") {
          throw new Error(
            `Provider model catalog: ${provider}/${normalized.id} isCategoryDefault is required for publicForCustomers models.`,
          );
        }

        if (normalized.isGlobalDefault) globalDefaultCount += 1;
        if (normalized.isCategoryDefault) {
          const c = normalized.primaryCategory;
          const prev = categoryDefaultCounts.get(c) ?? 0;
          categoryDefaultCounts.set(c, prev + 1);
        }

        assertTier(
          provider,
          normalized.id,
          "qualityTier",
          normalized.qualityTier ?? Number.NaN,
        );
        assertTier(
          provider,
          normalized.id,
          "speedTier",
          normalized.speedTier ?? Number.NaN,
        );
        assertTier(
          provider,
          normalized.id,
          "costTier",
          normalized.costTier ?? Number.NaN,
        );

        assertNonEmptyStringArray(
          provider,
          normalized.id,
          "recommendedUseCases",
          normalized.recommendedUseCases ?? [],
        );
      }

      return normalized;
    });
  }

  if (globalDefaultCount !== 1) {
    throw new Error(
      `Provider model catalog: expected exactly one public model with isGlobalDefault=true, found ${globalDefaultCount}.`,
    );
  }

  for (const c of categoriesWithPublicModels) {
    const count = categoryDefaultCounts.get(c) ?? 0;
    if (count <= 0) {
      throw new Error(
        `Provider model catalog: expected at least one public model with isCategoryDefault=true for primaryCategory ${c}.`,
      );
    }
  }

  return out;
}

/**
 * Canonical provider model catalog (after enrichment passes).
 */
export const PROVIDER_MODEL_DEFINITIONS_BY_PROVIDER: Record<
  IntentProvider,
  ProviderModelDefinition[]
> = (() => {
  const base = fillMissingPricingFromBaseModels(
    PROVIDER_MODEL_DEFINITIONS_BY_PROVIDER_RAW,
  );
  const normalized = normalizeProviderModelDefinitions(base);

  return {
    ...normalized,
    [IntentProvider.DCDR]: buildDcdrVirtualProviderModelDefinitions(normalized),
  };
})();

const _PROVIDER_MODEL_INDEXES = buildProviderModelCatalogAndTypeIndex(
  PROVIDER_MODEL_DEFINITIONS_BY_PROVIDER,
);

/**
 * Canonical lookup: provider -> modelId -> model definition.
 */
export const PROVIDER_MODEL_CATALOG: Record<
  IntentProvider,
  Record<string, ProviderModelDefinition>
> = _PROVIDER_MODEL_INDEXES.catalog;

/**
 * Primary listing structure (no duplicated metadata): provider -> intent type -> model IDs.
 */
export const PROVIDER_MODEL_IDS_BY_PROVIDER_AND_TYPE: Record<
  IntentProvider,
  Record<IntentType, string[]>
> = _PROVIDER_MODEL_INDEXES.idsByType;

/**
 * E2E model status used by provider test suites.
 *
 * Notes
 * - This is an opt-in testing mechanism; it does not affect runtime behavior.
 * - Use `LEGACY` to explicitly skip obsolete/retired model IDs while still keeping them
 *   discoverable in the catalog for historical compatibility.
 */
export enum ProviderModelE2EStatus {
  /** Model should be exercised by E2E suites (when provider is implemented and credentials exist). */
  ACTIVE = "ACTIVE",

  /** Model is considered legacy/obsolete and may be skipped by E2E suites. */
  LEGACY = "LEGACY",
}

/**
 * Per-model E2E override metadata.
 */
export interface ProviderModelE2EOverride {
  status: ProviderModelE2EStatus;
  /** Human-readable skip rationale (keep short; safe for CI logs). */
  reason: string;
}

/**
 * Optional provider-model overrides consumed by the provider E2E matrix tests.
 */
export const PROVIDER_MODEL_E2E_OVERRIDES: Record<
  IntentProvider,
  Record<string, ProviderModelE2EOverride>
> = {
  [IntentProvider.DCDR]: buildDcdrProviderModelE2EOverrides(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.OPEN_AI]: buildOpenAIProviderModelE2EOverrides(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.GEMINI]: buildGeminiProviderModelE2EOverrides(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.GROK]: buildGrokProviderModelE2EOverrides(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.ANTHROPIC]: buildAnthropicProviderModelE2EOverrides(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.MISTRAL]: buildMistralProviderModelE2EOverrides(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.COHERE]: buildCohereProviderModelE2EOverrides(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.OFFICE]: buildOfficeProviderModelE2EOverrides(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.OLLAMA]: buildOllamaProviderModelE2EOverrides(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.OPEN_AI_COMPATIBLE]:
    buildOpenAICompatibleProviderModelE2EOverrides(
      PROVIDER_CATALOG_MODULE_BUILD_ARGS,
    ),
  [IntentProvider.OCR]: buildOcrProviderModelE2EOverrides(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.CLIP]: buildClipProviderModelE2EOverrides(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.HTTP_TOOL]: buildHttpToolProviderModelE2EOverrides(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
  [IntentProvider.RULES]: buildRulesProviderModelE2EOverrides(
    PROVIDER_CATALOG_MODULE_BUILD_ARGS,
  ),
};

function pricingPerMillionTokens(args: {
  input: number;
  output: number;
  cachedInput?: number;
  cachedOutput?: number;
  tiers?: Array<{
    name: string;
    condition?: string;
    input: number;
    output: number;
    cachedInput?: number;
    cachedOutput?: number;
  }>;
  sourceUrl: string;
  updatedAt?: number;
  confidence?: ProviderModelPricing["confidence"];
  notes?: string;
}): ProviderModelPricing {
  return {
    currency: "USD",
    sourceUrl: args.sourceUrl,
    updatedAt: args.updatedAt ?? DEFAULT_TOKEN_PRICING_UPDATED_AT,
    confidence: args.confidence ?? "official",
    notes: args.notes,
    components: [
      {
        kind: "tokens",
        unit: "per_million_tokens",
        input: args.input,
        outputUsd: args.output,
        cachedInput: args.cachedInput,
        cachedOutput: args.cachedOutput,
        tiers: args.tiers,
      },
    ],
  };
}

/**
 * Gemini token pricing helper.
 *
 * Notes
 * - Uses the Gemini Developer API pricing page as the canonical source.
 * - Pricing tables sometimes vary by modality (text vs audio) and/or prompt size (<=200k vs >200k tokens).
 *   We represent those as `tiers` with a human-readable condition.
 */
function pricingAudioMinutesPerMinute(args: {
  input: number;
  sourceUrl: string;
  updatedAt?: number;
  confidence?: ProviderModelPricing["confidence"];
  notes?: string;
}): ProviderModelPricing {
  return {
    currency: "USD",
    sourceUrl: args.sourceUrl,
    updatedAt: args.updatedAt ?? DEFAULT_AUDIO_PRICING_UPDATED_AT,
    confidence: args.confidence ?? "official",
    notes: args.notes,
    components: [
      {
        kind: "audio_minutes",
        unit: "per_minute",
        input: args.input,
        notes: args.notes,
      },
    ],
  };
}

function clonePricingAsApproxFromBase(args: {
  modelId: string;
  baseId: string;
  basePricing: ProviderModelPricing;
  relation?: "base" | "fallback";
}): ProviderModelPricing {
  const base = args.basePricing;
  const relation = args.relation ?? "base";
  const extraNote =
    relation === "fallback"
      ? `Inherited pricing from fallback model: ${args.baseId}`
      : `Inherited pricing from base model: ${args.baseId}`;
  const notes = base.notes ? `${base.notes} | ${extraNote}` : extraNote;

  return {
    currency: base.currency,
    sourceUrl: base.sourceUrl,
    updatedAt: base.updatedAt,
    confidence: "approx",
    notes,
    components: base.components.map((c) => ({ ...c })),
  };
}

function tryGetBaseModelIdFromVersionedId(modelId: string): string | null {
  const id = String(modelId || "").trim();
  if (!id) return null;

  // Common vendor patterns:
  // - OpenAI: gpt-4o-2024-11-20
  // - OpenAI: gpt-5.4-mini-2026-03-17
  // - Anthropic: claude-haiku-4-5-20251001
  const m1 = id.match(/^(.*)-\d{4}-\d{2}-\d{2}$/);
  if (m1?.[1]) return m1[1];

  const m2 = id.match(/^(.*)-\d{8}$/);
  if (m2?.[1]) return m2[1];

  return null;
}

/**
 * Fills pricing gaps by inheriting pricing from the base model when a vendor exposes
 * versioned/dated aliases that share the same pricing.
 *
 * Notes
 * - Inherited pricing is marked as `confidence: "approx"`.
 * - Only applies when a base model is present in the same provider list.
 */
function fillMissingPricingFromBaseModels(
  modelsByProvider: Record<IntentProvider, ProviderModelDefinitionInput[]>,
): Record<IntentProvider, ProviderModelDefinitionInput[]> {
  const out = {} as Record<IntentProvider, ProviderModelDefinitionInput[]>;

  for (const provider of Object.values(IntentProvider) as IntentProvider[]) {
    const defs = modelsByProvider[provider] ?? [];

    const pricingById: Record<string, ProviderModelPricing> = {};
    for (const def of defs) {
      if (def.pricing) pricingById[def.id] = def.pricing;
    }

    const fallbacks = PRICING_FALLBACK_RULES_BY_PROVIDER[provider] ?? [];

    out[provider] = defs.map((def) => {
      if (def.pricing) return def;

      const baseId = tryGetBaseModelIdFromVersionedId(def.id);
      if (baseId) {
        const basePricing = pricingById[baseId];
        if (basePricing) {
          return {
            ...def,
            pricing: clonePricingAsApproxFromBase({
              modelId: def.id,
              baseId,
              basePricing,
              relation: "base",
            }),
          };
        }
      }

      for (const rule of fallbacks) {
        if (!rule.match.test(def.id)) continue;

        const fallbackPricing = pricingById[rule.baseModelId];
        if (!fallbackPricing) continue;

        return {
          ...def,
          pricing: clonePricingAsApproxFromBase({
            modelId: def.id,
            baseId: rule.baseModelId,
            basePricing: fallbackPricing,
            relation: "fallback",
          }),
        };
      }

      return def;
    });
  }

  return out;
}

function buildProviderModelCatalogAndTypeIndex(
  modelsByProvider: Record<IntentProvider, ProviderModelDefinition[]>,
): {
  catalog: Record<IntentProvider, Record<string, ProviderModelDefinition>>;
  idsByType: Record<IntentProvider, Record<IntentType, string[]>>;
} {
  const intentTypes = Object.values(IntentType) as IntentType[];

  const catalog = {} as Record<
    IntentProvider,
    Record<string, ProviderModelDefinition>
  >;
  const idsByType = {} as Record<IntentProvider, Record<IntentType, string[]>>;

  for (const provider of Object.values(IntentProvider) as IntentProvider[]) {
    catalog[provider] = {};

    const perType = {} as Record<IntentType, string[]>;
    for (const t of intentTypes) perType[t] = [];
    idsByType[provider] = perType;

    const defs = modelsByProvider[provider] ?? [];
    for (const def of defs) {
      catalog[provider][def.id] = def;

      for (const t of def.types) {
        idsByType[provider][t].push(def.id);
      }
    }
  }

  return { catalog, idsByType };
}

/**
 * Static utility class for querying the provider model catalog.
 *
 * Designed for client consumption: `ProviderModelRegistry.listProvidersSupportingType(...)`.
 */
export class ProviderModelRegistry {
  /** Canonical catalog view: provider -> modelId -> definition. */
  static readonly catalog = PROVIDER_MODEL_CATALOG;

  /** Primary listing view: provider -> intent type -> model IDs. */
  static readonly idsByProviderAndType =
    PROVIDER_MODEL_IDS_BY_PROVIDER_AND_TYPE;

  /** Source-of-truth definitions in declared order (useful for UI display). */
  static readonly definitionsByProvider =
    PROVIDER_MODEL_DEFINITIONS_BY_PROVIDER;

  /** Returns the model definition if present; otherwise null. */
  static getModelDefinition(
    provider: IntentProvider,
    modelId: string,
  ): ProviderModelDefinition | null {
    return ProviderModelRegistry.catalog[provider]?.[modelId] ?? null;
  }

  /** Lists all model IDs for a provider (stable order as declared in the catalog). */
  static listProviderModelIds(provider: IntentProvider): string[] {
    return (ProviderModelRegistry.definitionsByProvider[provider] ?? []).map(
      (m) => m.id,
    );
  }

  /** Lists all model definitions for a provider (stable order as declared in the catalog). */
  static listProviderModels(
    provider: IntentProvider,
    options?: ProviderModelListProviderModelsOptions,
  ): ProviderModelDefinition[] {
    const defs = ProviderModelRegistry.definitionsByProvider[provider] ?? [];
    if (!options?.onlyPublicForCustomers) return defs;
    return defs.filter((m) => m.publicForCustomers === true);
  }

  /**
   * Lists all public customer models across all providers.
   *
   * Notes
   * - Uses the catalog declared order (provider order, then per-provider declaration order).
   * - This is a UI/helper surface only; execution still uses provider+modelId.
   */
  static listPublicCustomerModels(
    options?: ProviderModelListPublicCustomerModelsOptions,
  ): ProviderPublicCustomerModelRef[] {
    const out: ProviderPublicCustomerModelRef[] = [];

    for (const provider of Object.values(IntentProvider) as IntentProvider[]) {
      const defs = ProviderModelRegistry.listProviderModels(provider, {
        onlyPublicForCustomers: true,
      });

      for (const def of defs) {
        const model = def as ProviderPublicCustomerModelDefinition;

        if (
          options?.primaryCategory &&
          model.primaryCategory !== options.primaryCategory
        ) {
          continue;
        }

        if (options?.includeCategories?.length) {
          const include = options.includeCategories;
          const hasAny = include.some((c) => model.categories.includes(c));
          if (!hasAny) continue;
        }

        out.push({ provider, modelId: model.id, model });
      }
    }

    return out;
  }

  /**
   * Groups all public customer models by their primaryCategory.
   *
   * Intended for the "simple UI" mode where the UI shows high-level DCDR groups.
   */
  static listPublicCustomerModelsByPrimaryCategory(): Record<
    DcdrPublicModelCategory,
    ProviderPublicCustomerModelRef[]
  > {
    const out = {} as Record<
      DcdrPublicModelCategory,
      ProviderPublicCustomerModelRef[]
    >;

    for (const c of Object.values(
      DcdrPublicModelCategory,
    ) as DcdrPublicModelCategory[]) {
      out[c] = [];
    }

    for (const item of ProviderModelRegistry.listPublicCustomerModels()) {
      out[item.model.primaryCategory].push(item);
    }

    return out;
  }

  /** Lists model IDs for a provider that support a given IntentType. */
  static listProviderModelIdsForType(
    provider: IntentProvider,
    type: IntentType,
  ): string[] {
    return ProviderModelRegistry.idsByProviderAndType[provider]?.[type] ?? [];
  }

  /** Lists model definitions for a provider that support a given IntentType. */
  static listProviderModelsForType(
    provider: IntentProvider,
    type: IntentType,
  ): ProviderModelDefinition[] {
    const ids = ProviderModelRegistry.listProviderModelIdsForType(
      provider,
      type,
    );
    return ids
      .map((id) => ProviderModelRegistry.getModelDefinition(provider, id))
      .filter((m): m is ProviderModelDefinition => m !== null);
  }

  /** Returns true if the provider has at least one model for the given IntentType. */
  static providerSupportsType(
    provider: IntentProvider,
    type: IntentType,
  ): boolean {
    return (
      ProviderModelRegistry.listProviderModelIdsForType(provider, type).length >
      0
    );
  }

  /** Returns true if the model supports the given IntentType (based on the catalog). */
  static modelSupportsType(
    provider: IntentProvider,
    modelId: string,
    type: IntentType,
  ): boolean {
    const def = ProviderModelRegistry.getModelDefinition(provider, modelId);
    if (!def) return false;
    return def.types.includes(type);
  }

  /** Lists all providers that have at least one model supporting the given IntentType. */
  static listProvidersSupportingType(type: IntentType): IntentProvider[] {
    return (Object.values(IntentProvider) as IntentProvider[]).filter((p) =>
      ProviderModelRegistry.providerSupportsType(p, type),
    );
  }

  /** Returns all model IDs across all providers for a given type. */
  static listAllModelIdsForType(
    type: IntentType,
  ): Array<{ provider: IntentProvider; modelId: string }> {
    const out: Array<{ provider: IntentProvider; modelId: string }> = [];
    for (const provider of Object.values(IntentProvider) as IntentProvider[]) {
      for (const modelId of ProviderModelRegistry.listProviderModelIdsForType(
        provider,
        type,
      )) {
        out.push({ provider, modelId });
      }
    }
    return out;
  }

  /** Convenience: get unified pricing if present (or null if not set/unknown). */
  static getModelPricing(
    provider: IntentProvider,
    modelId: string,
  ): ProviderModelPricing | null {
    return (
      ProviderModelRegistry.getModelDefinition(provider, modelId)?.pricing ??
      null
    );
  }

  /** Get a specific pricing component from a model by kind (or null if absent). */
  static getPricingComponent<TKind extends ProviderPricingComponent["kind"]>(
    provider: IntentProvider,
    modelId: string,
    kind: TKind,
  ): Extract<ProviderPricingComponent, { kind: TKind }> | null {
    const pricing = ProviderModelRegistry.getModelPricing(provider, modelId);
    if (!pricing) return null;

    const found = pricing.components.find((c) => c.kind === kind);
    return (found as any) ?? null;
  }

  /** Convenience: token pricing (per MTok) if present. */
  static getTokenPricing(
    provider: IntentProvider,
    modelId: string,
  ): Extract<ProviderPricingComponent, { kind: "tokens" }> | null {
    return ProviderModelRegistry.getPricingComponent(
      provider,
      modelId,
      "tokens",
    );
  }
}

import { ImplementationContract } from "./implementations.contract";
import { Message } from "./messages.contract";
import { Intent, IntentContract, IntentType } from "./intent.contract";
import { PromptParameters } from "./policies.contract";
import { PromptTemplate } from "./prompts.contract";
import { CredentialsContract } from "./credentials.contract";

/**
 * Supported provider backends capable of executing an intent.
 *
 * These represent the underlying execution engines used by the runtime.
 * A provider may represent:
 *
 * - A hosted LLM service (OpenAI, Gemini, Grok, etc.)
 * - A local inference runtime (OFFICE, OLLAMA, VLLM)
 * - A specialized processing engine (OCR, CLIP)
 * - An internal execution system (RULES, HTTP_TOOL)
 */
export enum IntentProvider {

    /** OpenAI hosted models (GPT family, embeddings, etc.) */
    OPEN_AI = "OPEN_AI",

    /** Google Gemini models */
    GEMINI = "GEMINI",

    /** xAI Grok models */
    GROK = "GROK",

    /** Anthropic Claude models */
    ANTHROPIC = "ANTHROPIC",

    /** Mistral hosted models */
    MISTRAL = "MISTRAL",

    /** Cohere models (chat + embeddings) */
    COHERE = "COHERE",

    /**
     * Local inference runtime hosted internally.
     * In your case this maps to your office GPU cluster (vLLM etc.).
     */
    OFFICE = "OFFICE",

    /**
     * Ollama local inference runtime.
     * Useful for developer setups and local deployments.
     */
    OLLAMA = "OLLAMA",

    /**
     * Generic OpenAI-compatible endpoint.
     * Covers many providers exposing the OpenAI API format.
     */
    OPEN_AI_COMPATIBLE = "OPEN_AI_COMPATIBLE",

    /**
     * Optical character recognition engine.
     */
    OCR = "OCR",

    /**
     * CLIP-like models for multimodal embedding.
     */
    CLIP = "CLIP",

    /**
     * Generic HTTP tool provider.
     * Used to call external APIs or services.
     */
    HTTP_TOOL = "HTTP_TOOL",

    /**
     * Internal rule-based execution engine.
     * Used for deterministic logic instead of LLMs.
     */
    RULES = "RULES",
}


export type ProviderExecuteArgs = {
    intent: Intent;
    implementation: ImplementationContract;
    credentials: CredentialsContract | null;

    // Prompt + rendered messages are provided by the caller (ExecutionService)
    prompt: PromptTemplate;
    renderedMessages: Message[];

    // Original vars used for interpolation (handy for debugging / adapters)
    vars: Record<string, unknown>;

    /**
     * If provided, this is what will be sent to the provider.
     */
    runtimeConfig?: PromptParameters;

    /**
     * ✅ Attempt timeout controlled by run policy.
     */
    attemptTimeoutMs?: number;

    /**
     * ✅ Optional model contract for schemas, tool configs, etc.
     * If you don't want to pass the whole model, pass outputSchema only.
     */
    model?: IntentContract | null;

    /** The hash of the problem associated with this execution. */
    problemHash: string | null;

    /** The hash of the run associated with this execution. */
    runHash: string | null;

    /**
     * Optional tenant/customer id to scope runtime-side caches and circuit breakers.
     *
     * Notes
     * - When omitted, the runtime will treat it as internal/default scope.
     */
    tenantCid?: string;
};



/**
 * The result of executing a provider call.
 * This is what ProviderExecutor returns to ExecutionService, which later writes it to AICallLog.
 */
export type ProviderExecuteResult = {

    output: unknown;

    cached: boolean;

    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };

};


/**
 * Pricing metadata shared across different pricing components.
 */
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
        input: number;
        notes?: string;
    };

/** Unified pricing for a model: composed of 1..N pricing components. */
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

    /** Under active work; may be partially implemented. */
    IN_PROGRESS = "IN_PROGRESS",
}

/** Preferred upstream API surface for this model (when provider offers multiple). */
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
    SEED = "seed",
    ENABLE_THINKING = "enable_thinking",
    RESPONSE_FORMAT = "response_format",
    PRESENCE_PENALTY = "presence_penalty",
    FREQUENCY_PENALTY = "frequency_penalty",
}

/** Runtime-level parameter support status for a specific model. */
export enum ProviderModelParameterSupportStatus {
    /** Parameter is supported and may be used. */
    SUPPORTED = "SUPPORTED",

    /** Parameter is not supported and should not be sent. */
    NOT_SUPPORTED = "NOT_SUPPORTED",

    /** Only provider default is supported; runtime should avoid sending custom values. */
    DEFAULT_ONLY = "DEFAULT_ONLY",
}

/** Optional parameter support metadata attached to a model definition (for UI and adapter normalization). */
export interface ProviderModelParameterSupportInfo {
    /** Per-parameter support mapping. Omitted keys mean "unknown" (use adapter defaults). */
    parameters?: Partial<Record<PromptParameterKey, ProviderModelParameterSupportStatus>>;

    /** Optional recommendations to avoid common misconfiguration. */
    recommended?: {
        /** Recommended minimum `max_tokens` to avoid empty/reasoning-only outputs on some models. */
        minMaxTokens?: number;
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
    /** Human-readable notes (safe for logs/CI). */
    reason?: string;
    /** ISO date string of last verification (e.g. from E2E/probes). */
    updatedAt?: string;
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
    pricing?: ProviderModelPricing;
    runtimeSupport?: ProviderModelRuntimeSupportInfo;
    parameterSupport?: ProviderModelParameterSupportInfo;
}

interface ProviderPricingFallbackRule {
    /** If the modelId matches this rule, attempt to inherit pricing from baseModelId. */
    match: RegExp;
    baseModelId: string;
}

const PRICING_UPDATED_AT_20260327 = Date.UTC(2026, 2, 27);
const PRICING_UPDATED_AT_20260326 = Date.UTC(2026, 2, 26);
const PRICING_UPDATED_AT_20260430 = Date.UTC(2026, 3, 30);
const OPENAI_PRICING_URL = "https://developers.openai.com/api/docs/pricing";
const XAI_PRICING_URL = "https://docs.x.ai/developers/models";
const ANTHROPIC_MODELS_URL = "https://platform.claude.com/docs/en/docs/about-claude/models";
const MISTRAL_MODELS_URL = "https://docs.mistral.ai/getting-started/models/";
const GEMINI_PRICING_URL = "https://ai.google.dev/gemini-api/docs/pricing";

const OPENAI_GPT5_PARAMETER_SUPPORT: ProviderModelParameterSupportInfo = {
    parameters: {
        [PromptParameterKey.TEMPERATURE]: ProviderModelParameterSupportStatus.DEFAULT_ONLY,
        [PromptParameterKey.TOP_P]: ProviderModelParameterSupportStatus.DEFAULT_ONLY,
        [PromptParameterKey.TOP_K]: ProviderModelParameterSupportStatus.NOT_SUPPORTED,
    },
    recommended: {
        // E2E and probes showed that very low budgets (e.g. 16) can yield reasoning-only outputs.
        minMaxTokens: 64,
    },
    notes: "GPT-5 family: avoid custom sampling params; ensure sufficient max_tokens budget.",
    updatedAt: "2026-04-28",
};

const PRICING_FALLBACK_RULES_BY_PROVIDER: Record<IntentProvider, ProviderPricingFallbackRule[]> = {
    [IntentProvider.OPEN_AI]: [
        // Not officially published separately; assume same token pricing as base GPT-5.
        { match: /^gpt-5-search-api/, baseModelId: "gpt-5" },
    ],
    [IntentProvider.ANTHROPIC]: [
        // Opus/Sonnet/Haiku family pricing is expected to be consistent across close variants.
        { match: /^claude-opus-4-/, baseModelId: "claude-opus-4-7" },
        { match: /^claude-sonnet-4-/, baseModelId: "claude-sonnet-4-6" },
        { match: /^claude-haiku-4-/, baseModelId: "claude-haiku-4-5" },
    ],
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


/**
 * Canonical provider model catalog (single source of truth).
 *
 * Note: This is a curated snapshot of commonly used official model IDs (updated March 2026).
 * Providers may add/deprecate models frequently; keep this list in sync with vendor docs.
 */
const PROVIDER_MODEL_DEFINITIONS_BY_PROVIDER_RAW: Record<IntentProvider, ProviderModelDefinition[]> = {
    [IntentProvider.OPEN_AI]: [
        // Pricing snapshot: OpenAI pricing page, updatedAt=2026-03-27
        // Model IDs below are kept in roughly "newest first" order.
        // Discovered aliases are sourced from OpenAI `GET /v1/models` (snapshot 2026-04-27).

        // --- gpt-5.5 (discovered; priced) ---
        { id: "gpt-5.5", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 5.0, cachedInput: 0.5, output: 30.0, tiers: [{ name: "long_context", condition: "Long context", input: 10.0, cachedInput: 1.0, output: 45.0 }], sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.5-2026-04-23", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.5-pro", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 30.0, output: 180.0, tiers: [{ name: "long_context", condition: "Long context", input: 60.0, output: 270.0 }], sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "OpenAI responses-only model (not supported on /v1/chat/completions)", updatedAt: "2026-04-27" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.5-pro-2026-04-23", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "OpenAI responses-only model (not supported on /v1/chat/completions)", updatedAt: "2026-04-27" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },

        // --- gpt-5.4 (discovered; priced) ---
        { id: "gpt-5.4", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 2.5, cachedInput: 0.25, output: 15.0, tiers: [{ name: "long_context", condition: "Long context", input: 5.0, cachedInput: 0.5, output: 22.5 }], sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.4-2026-03-05", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.4-mini", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 0.75, cachedInput: 0.075, output: 4.5, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.4-mini-2026-03-17", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.4-nano", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 0.2, cachedInput: 0.02, output: 1.25, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.4-nano-2026-03-17", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.4-pro", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 30.0, output: 180.0, tiers: [{ name: "long_context", condition: "Long context", input: 60.0, output: 270.0 }], sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "OpenAI responses-only model (not supported on /v1/chat/completions)", updatedAt: "2026-04-27" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.4-pro-2026-03-05", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "OpenAI responses-only model (not supported on /v1/chat/completions)", updatedAt: "2026-04-27" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },

        // --- gpt-5.3 (discovered; priced) ---
        { id: "gpt-5.3-chat-latest", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 1.75, cachedInput: 0.175, output: 14.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.3-codex", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 1.75, cachedInput: 0.175, output: 14.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },

        // --- gpt-5.2 (base IDs are priced; aliases discovered) ---
        { id: "gpt-5.2", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS], pricing: pricingPerMillionTokens({ input: 1.75, cachedInput: 0.175, output: 14.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.2-2025-12-11", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.2-chat-latest", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.2-codex", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.2-pro", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS], pricing: pricingPerMillionTokens({ input: 21.0, output: 168.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "OpenAI responses-only model (not supported on /v1/chat/completions)", updatedAt: "2026-04-27" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.2-pro-2025-12-11", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "OpenAI responses-only model (not supported on /v1/chat/completions)", updatedAt: "2026-04-27" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },

        // --- gpt-5.1 (base ID is priced; aliases discovered) ---
        { id: "gpt-5.1", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS], pricing: pricingPerMillionTokens({ input: 1.25, cachedInput: 0.125, output: 10.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.1-2025-11-13", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.1-chat-latest", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.1-codex", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.1-codex-max", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5.1-codex-mini", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },

        // --- gpt-5.0 (base IDs are priced; aliases discovered) ---
        { id: "gpt-5", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS], pricing: pricingPerMillionTokens({ input: 1.25, cachedInput: 0.125, output: 10.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5-2025-08-07", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5-chat-latest", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5-codex", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5-mini", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS], pricing: pricingPerMillionTokens({ input: 0.25, cachedInput: 0.025, output: 2.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5-mini-2025-08-07", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5-nano", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS], pricing: pricingPerMillionTokens({ input: 0.05, cachedInput: 0.005, output: 0.4, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5-nano-2025-08-07", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5-pro", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS], pricing: pricingPerMillionTokens({ input: 15.0, output: 120.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "OpenAI responses-only model (not supported on /v1/chat/completions)", updatedAt: "2026-04-27" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5-pro-2025-10-06", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "OpenAI responses-only model (not supported on /v1/chat/completions)", updatedAt: "2026-04-27" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5-search-api", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.NOT_SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Not supported by runtime: upstream 5xx on basic calls; structured json_schema not supported", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },
        { id: "gpt-5-search-api-2025-10-14", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.NOT_SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Not supported by runtime: upstream 5xx on basic calls; structured json_schema not supported", updatedAt: "2026-04-28" }, parameterSupport: OPENAI_GPT5_PARAMETER_SUPPORT },

        { id: "gpt-4.1", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS], pricing: pricingPerMillionTokens({ input: 2.0, cachedInput: 0.5, output: 8.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-4.1-2025-04-14", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-4.1-mini", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS], pricing: pricingPerMillionTokens({ input: 0.4, cachedInput: 0.1, output: 1.6, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-4.1-mini-2025-04-14", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-4.1-nano", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS], pricing: pricingPerMillionTokens({ input: 0.1, cachedInput: 0.025, output: 0.4, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-4.1-nano-2025-04-14", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },

        { id: "gpt-4o", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS], pricing: pricingPerMillionTokens({ input: 2.5, cachedInput: 1.25, output: 10.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-4o-2024-08-06", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-4o-2024-11-20", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-4o-mini", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS], pricing: pricingPerMillionTokens({ input: 0.15, cachedInput: 0.075, output: 0.6, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-4o-mini-2024-07-18", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },

        { id: "gpt-4o-2024-05-13", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS], pricing: pricingPerMillionTokens({ input: 5.0, output: 15.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E (structured uses prompt-only JSON)", updatedAt: "2026-04-28" }, parameterSupport: { parameters: { [PromptParameterKey.RESPONSE_FORMAT]: ProviderModelParameterSupportStatus.NOT_SUPPORTED }, notes: "This model version rejects response_format=json_schema; use prompt-only JSON + local parse.", updatedAt: "2026-04-28" } },
        { id: "gpt-4-turbo", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-4-turbo-2024-04-09", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 10.0, output: 30.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-4", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-4-0613", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 30.0, output: 60.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },

        { id: "gpt-3.5-turbo", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 0.5, output: 1.5, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-3.5-turbo-0125", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 0.5, output: 1.5, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-3.5-turbo-1106", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 1.0, output: 2.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },
        { id: "gpt-3.5-turbo-16k", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 3.0, output: 4.0, sourceUrl: OPENAI_PRICING_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.CHAT_COMPLETIONS, reason: "Validated via provider E2E", updatedAt: "2026-04-28" } },

        // --- o-series (reasoning; exposed in /v1/models as o*) ---
        { id: "o4-mini", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 1.1, cachedInput: 0.275, output: 4.4, sourceUrl: OPENAI_PRICING_URL, notes: "Reasoning-family model" }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" } },
        { id: "o4-mini-2025-04-16", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" } },

        { id: "o3-pro", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 20.0, output: 80.0, sourceUrl: OPENAI_PRICING_URL, notes: "Reasoning-family model" }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" } },
        { id: "o3-pro-2025-06-10", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" } },
        { id: "o3", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 2.0, cachedInput: 0.5, output: 8.0, sourceUrl: OPENAI_PRICING_URL, notes: "Reasoning-family model" }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" } },
        { id: "o3-2025-04-16", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" } },
        { id: "o3-mini", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 1.1, cachedInput: 0.55, output: 4.4, sourceUrl: OPENAI_PRICING_URL, notes: "Reasoning-family model" }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" } },
        { id: "o3-mini-2025-01-31", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" } },

        { id: "o1-pro", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 150.0, output: 600.0, sourceUrl: OPENAI_PRICING_URL, notes: "Reasoning-family model" }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" } },
        { id: "o1-pro-2025-03-19", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" } },
        { id: "o1", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 15.0, cachedInput: 7.5, output: 60.0, sourceUrl: OPENAI_PRICING_URL, notes: "Reasoning-family model" }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" } },
        { id: "o1-mini", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 1.1, cachedInput: 0.55, output: 4.4, sourceUrl: OPENAI_PRICING_URL, notes: "Reasoning-family model" }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.IN_PROGRESS, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Priced on OpenAI pricing page; not yet validated via provider E2E in this repo", updatedAt: "2026-04-28" } },
        { id: "o1-2024-12-17", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, preferredApi: ProviderModelPreferredApi.RESPONSES, reason: "Validated via provider E2E; routed via OpenAI Responses API", updatedAt: "2026-04-28" } },

        // Other OpenAI models (pricing varies by endpoint/unit; fill as needed)
        { id: "text-embedding-3-small", types: [IntentType.EMBEDDING] },
        { id: "text-embedding-3-large", types: [IntentType.EMBEDDING] },
        { id: "text-embedding-ada-002", types: [IntentType.EMBEDDING] },

        { id: "gpt-image-1.5", types: [IntentType.IMAGE_GENERATION] },
        { id: "gpt-image-1-mini", types: [IntentType.IMAGE_GENERATION] },
        { id: "dall-e-3", types: [IntentType.IMAGE_GENERATION] },
        { id: "dall-e-2", types: [IntentType.IMAGE_GENERATION] },

        { id: "gpt-4o-transcribe", types: [IntentType.SPEECH_TO_TEXT] },
        { id: "gpt-4o-mini-transcribe", types: [IntentType.SPEECH_TO_TEXT] },
        { id: "gpt-4o-transcribe-diarize", types: [IntentType.SPEECH_TO_TEXT] },
        { id: "whisper-1", types: [IntentType.SPEECH_TO_TEXT] },

        { id: "gpt-4o-mini-tts", types: [IntentType.TEXT_TO_SPEECH] },
        { id: "tts-1", types: [IntentType.TEXT_TO_SPEECH] },
        { id: "tts-1-hd", types: [IntentType.TEXT_TO_SPEECH] },

        { id: "gpt-realtime-1.5", types: [IntentType.MULTIMODAL] },
        { id: "gpt-realtime-mini", types: [IntentType.MULTIMODAL] },
    ],

    [IntentProvider.GEMINI]: [
        // Source: Gemini Models API (`npm run gemini-models:sync`), updated 2026-05-04
        // Notes:
        // - DCDR runtime v1 implements Gemini for CHAT only (via generateContent / generateContentStream).
        // - Embedding models are cataloged as EMBEDDING, but the runtime does not yet implement a Gemini embedding adapter.

        // --- Validated starter model ---
        {
            id: "gemini-2.5-flash",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.30,
                output: 2.50,
                tiers: [
                    { name: "audio", condition: "audio", input: 1.00, output: 2.50 },
                ],
                notes: "Prices may differ by modality; output includes thinking tokens.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (run + structured + streaming SSE)", updatedAt: "2026-05-04" },
        },

        // --- Newer preview families (pending E2E curation) ---
        {
            id: "gemini-3.1-pro-preview-customtools",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 2.00,
                output: 12.00,
                tiers: [
                    { name: "prompts <= 200k", condition: "prompts <= 200k tokens", input: 2.00, output: 12.00 },
                    { name: "prompts > 200k", condition: "prompts > 200k tokens", input: 4.00, output: 18.00 },
                ],
                notes: "Output price includes thinking tokens.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (text + structured + streaming SSE) with larger token budgets; model uses thinking", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-3.1-pro-preview",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 2.00,
                output: 12.00,
                tiers: [
                    { name: "prompts <= 200k", condition: "prompts <= 200k tokens", input: 2.00, output: 12.00 },
                    { name: "prompts > 200k", condition: "prompts > 200k tokens", input: 4.00, output: 18.00 },
                ],
                notes: "Output price includes thinking tokens.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (text + structured + streaming SSE) with larger token budgets; model uses thinking", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-3.1-flash-tts-preview",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 1.00,
                output: 20.00,
                notes: "TTS preview: output billed as audio tokens (docs: ~25 tokens/sec).",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.NOT_SUPPORTED, reason: "Rejects developer/system instruction in runtime prompt shape (400 INVALID_ARGUMENT)", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-3.1-flash-live-preview",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.75,
                output: 4.50,
                tiers: [
                    { name: "audio", condition: "audio", input: 3.00, output: 12.00 },
                    { name: "image/video", condition: "image/video", input: 1.00, output: 4.50 },
                ],
                notes: "Live preview pricing varies by modality; docs also list per-minute rates for audio/video.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.FAILING, reason: "Model/endpoint not found (404) in provider E2E for this account", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-3.1-flash-lite-preview",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.25,
                output: 1.50,
                tiers: [
                    { name: "audio", condition: "audio", input: 0.50, output: 1.50 },
                ],
                notes: "Prices may differ by modality; output includes thinking tokens.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (text + structured + streaming SSE)", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-3.1-flash-image-preview",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.50,
                output: 3.00,
                notes: "Image-preview model; docs list separate image output pricing (not modeled here).",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (text + structured + streaming SSE)", updatedAt: "2026-05-04" },
        },

        {
            id: "gemini-3-pro-preview",
            types: [IntentType.CHAT],
            pricing: {
                ...pricingGeminiPerMillionTokens({
                    input: 2.00,
                    output: 12.00,
                    tiers: [
                        { name: "prompts <= 200k", condition: "prompts <= 200k tokens", input: 2.00, output: 12.00 },
                        { name: "prompts > 200k", condition: "prompts > 200k tokens", input: 4.00, output: 18.00 },
                    ],
                    notes: "Output price includes thinking tokens.",
                }),
                confidence: "approx",
                notes: "Not explicitly listed on pricing page; approximated from Gemini 3.1 Pro Preview.",
            },
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (text + structured + streaming SSE)", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-3-pro-image-preview",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 2.00,
                output: 12.00,
                tiers: [
                    { name: "prompts <= 200k", condition: "prompts <= 200k tokens", input: 2.00, output: 12.00 },
                    { name: "prompts > 200k", condition: "prompts > 200k tokens", input: 4.00, output: 18.00 },
                ],
                notes: "Image generation model; text pricing is the same as Gemini 3.1 Pro (image output priced separately).",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.FAILING, reason: "Structured mode returned empty text in provider E2E (streaming SSE OK)", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-3-flash-preview",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.50,
                output: 3.00,
                tiers: [
                    { name: "audio", condition: "audio", input: 1.00, output: 3.00 },
                ],
                notes: "Prices may differ by modality; output includes thinking tokens.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (text + structured + streaming SSE)", updatedAt: "2026-05-04" },
        },

        // --- 2.5 family variants (pending E2E curation) ---
        {
            id: "gemini-2.5-pro",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 1.25,
                output: 10.00,
                tiers: [
                    { name: "prompts <= 200k", condition: "prompts <= 200k tokens", input: 1.25, output: 10.00 },
                    { name: "prompts > 200k", condition: "prompts > 200k tokens", input: 2.50, output: 15.00 },
                ],
                notes: "Output price includes thinking tokens.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.FAILING, reason: "Provider E2E: empty output in text + structured (streaming SSE OK)", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-2.5-pro-preview-tts",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 1.00,
                output: 20.00,
                notes: "TTS preview: output billed as audio tokens.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.NOT_SUPPORTED, reason: "Audio-only response modality (TEXT unsupported) in provider E2E; runtime v1 is text-only", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-2.5-flash-lite",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.10,
                output: 0.40,
                tiers: [
                    { name: "audio", condition: "audio", input: 0.30, output: 0.40 },
                ],
                notes: "Prices may differ by modality; output includes thinking tokens.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (text + structured + streaming SSE)", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-2.5-flash-image",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.30,
                output: 2.50,
                notes: "Image generation model; docs list separate per-image output pricing (not modeled here).",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (text + structured + streaming SSE)", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-2.5-flash-native-audio-latest",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.50,
                output: 2.00,
                tiers: [
                    { name: "audio/video", condition: "audio/video", input: 3.00, output: 12.00 },
                ],
                notes: "Native audio (Live API): docs also list per-minute rates for audio; output includes thinking tokens.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.NOT_SUPPORTED, reason: "Native-audio model (text-only runtime v1); also 404 in provider E2E for this account", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-2.5-flash-native-audio-preview-09-2025",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.50,
                output: 2.00,
                tiers: [
                    { name: "audio/video", condition: "audio/video", input: 3.00, output: 12.00 },
                ],
                notes: "Native audio (Live API): docs also list per-minute rates for audio; output includes thinking tokens.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.NOT_SUPPORTED, reason: "Native-audio model (text-only runtime v1); also 404 in provider E2E for this account", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-2.5-flash-native-audio-preview-12-2025",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.50,
                output: 2.00,
                tiers: [
                    { name: "audio/video", condition: "audio/video", input: 3.00, output: 12.00 },
                ],
                notes: "Native audio (Live API): docs also list per-minute rates for audio; output includes thinking tokens.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.NOT_SUPPORTED, reason: "Native-audio model (text-only runtime v1); also 404 in provider E2E for this account", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-2.5-flash-preview-tts",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.50,
                output: 10.00,
                notes: "TTS preview: output billed as audio tokens.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.NOT_SUPPORTED, reason: "Audio-only response modality (TEXT unsupported) in provider E2E; runtime v1 is text-only", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-2.5-computer-use-preview-10-2025",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 1.25,
                output: 10.00,
                tiers: [
                    { name: "prompts <= 200k", condition: "prompts <= 200k tokens", input: 1.25, output: 10.00 },
                    { name: "prompts > 200k", condition: "prompts > 200k tokens", input: 2.50, output: 15.00 },
                ],
                notes: "Computer Use model token pricing (tools may have separate charges).",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.NOT_SUPPORTED, reason: "Requires Computer Use tool wiring (not supported in runtime v1)", updatedAt: "2026-05-04" },
        },

        // --- Older 2.0 family IDs (may appear but can be unavailable to new users) ---
        {
            id: "gemini-2.0-flash",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.10,
                output: 0.40,
                tiers: [
                    { name: "audio", condition: "audio", input: 0.70, output: 0.40 },
                ],
                notes: "Deprecated model family (shutdown noted in docs).",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.FAILING, reason: "Visible via Models API but may be unavailable to new users (404)", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-2.0-flash-001",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.10,
                output: 0.40,
                tiers: [
                    { name: "audio", condition: "audio", input: 0.70, output: 0.40 },
                ],
                notes: "Deprecated model family (shutdown noted in docs).",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.FAILING, reason: "Visible via Models API but may be unavailable to new users (404)", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-2.0-flash-lite",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.075,
                output: 0.30,
                notes: "Deprecated model family (shutdown noted in docs).",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.FAILING, reason: "Visible via Models API but may be unavailable to new users (404)", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-2.0-flash-lite-001",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 0.075,
                output: 0.30,
                notes: "Deprecated model family (shutdown noted in docs).",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.FAILING, reason: "Visible via Models API but may be unavailable to new users (404)", updatedAt: "2026-05-04" },
        },

        // --- Rolling aliases ---
        {
            id: "gemini-flash-latest",
            types: [IntentType.CHAT],
            pricing: {
                ...pricingGeminiPerMillionTokens({
                    input: 0.30,
                    output: 2.50,
                    tiers: [
                        { name: "audio", condition: "audio", input: 1.00, output: 2.50 },
                    ],
                    notes: "Prices may differ by modality; output includes thinking tokens.",
                }),
                confidence: "approx",
                notes: "Rolling alias; priced as Gemini 2.5 Flash (approx).",
            },
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (text + structured + streaming SSE) (alias)", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-flash-lite-latest",
            types: [IntentType.CHAT],
            pricing: {
                ...pricingGeminiPerMillionTokens({
                    input: 0.10,
                    output: 0.40,
                    tiers: [
                        { name: "audio", condition: "audio", input: 0.30, output: 0.40 },
                    ],
                    notes: "Prices may differ by modality; output includes thinking tokens.",
                }),
                confidence: "approx",
                notes: "Rolling alias; priced as Gemini 2.5 Flash-Lite (approx).",
            },
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (text + structured + streaming SSE) (alias)", updatedAt: "2026-05-04" },
        },
        {
            id: "gemini-pro-latest",
            types: [IntentType.CHAT],
            pricing: {
                ...pricingGeminiPerMillionTokens({
                    input: 1.25,
                    output: 10.00,
                    tiers: [
                        { name: "prompts <= 200k", condition: "prompts <= 200k tokens", input: 1.25, output: 10.00 },
                        { name: "prompts > 200k", condition: "prompts > 200k tokens", input: 2.50, output: 15.00 },
                    ],
                    notes: "Output price includes thinking tokens.",
                }),
                confidence: "approx",
                notes: "Rolling alias; priced as Gemini 2.5 Pro (approx).",
            },
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (text + structured + streaming SSE) (alias)", updatedAt: "2026-05-04" },
        },

        // --- Robotics models (listed by API; may require special modalities) ---
        {
            id: "gemini-robotics-er-1.6-preview",
            types: [IntentType.CHAT],
            pricing: pricingGeminiPerMillionTokens({
                input: 1.00,
                output: 5.00,
                tiers: [
                    { name: "audio", condition: "audio", input: 2.00, output: 5.00 },
                ],
                notes: "Prices may differ by modality; output includes thinking tokens.",
            }),
            runtimeSupport: { status: ProviderModelRuntimeSupportStatus.FAILING, reason: "Provider E2E: empty output in text + structured + streaming", updatedAt: "2026-05-04" },
        },
        { id: "gemini-robotics-er-1.5-preview", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.FAILING, reason: "Model/endpoint not found (404) in provider E2E for this account", updatedAt: "2026-05-04" } },

        // --- Embeddings (cataloged, but runtime adapter not implemented yet) ---
        { id: "gemini-embedding-2-preview", types: [IntentType.EMBEDDING], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.NOT_SUPPORTED, reason: "Gemini embedding adapter not implemented in runtime v1", updatedAt: "2026-05-04" } },
        { id: "gemini-embedding-2", types: [IntentType.EMBEDDING], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.NOT_SUPPORTED, reason: "Gemini embedding adapter not implemented in runtime v1", updatedAt: "2026-05-04" } },
        { id: "gemini-embedding-001", types: [IntentType.EMBEDDING], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.NOT_SUPPORTED, reason: "Gemini embedding adapter not implemented in runtime v1", updatedAt: "2026-05-04" } },
    ],

    [IntentProvider.GROK]: [],

    [IntentProvider.ANTHROPIC]: [
        // Source: Anthropic Models overview (latest models comparison), updated 2026-05-04
        // Note: DCDR runtime v1 treats Anthropic as CHAT-only; multimodal/vision intent types are intentionally not listed yet.
        { id: "claude-opus-4-7", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 5.0, output: 25.0, sourceUrl: ANTHROPIC_MODELS_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (run + streaming SSE)", updatedAt: "2026-05-04" } },
        // Legacy/stable IDs still visible via Models API for some accounts.
        { id: "claude-opus-4-6", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (run + structured + streaming SSE)", updatedAt: "2026-05-04" } },
        { id: "claude-opus-4-5-20251101", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (run + structured + streaming SSE)", updatedAt: "2026-05-04" } },
        { id: "claude-opus-4-1-20250805", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (run + structured + streaming SSE)", updatedAt: "2026-05-04" } },
        { id: "claude-sonnet-4-6", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 3.0, output: 15.0, sourceUrl: ANTHROPIC_MODELS_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (run + streaming SSE)", updatedAt: "2026-05-04" } },
        { id: "claude-sonnet-4-5-20250929", types: [IntentType.CHAT], runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (run + structured + streaming SSE)", updatedAt: "2026-05-04" } },
        // Haiku is the cheapest/default smoke-test model.
        { id: "claude-haiku-4-5", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 1.0, output: 5.0, sourceUrl: ANTHROPIC_MODELS_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (run + streaming SSE)", updatedAt: "2026-05-04" } },
        { id: "claude-haiku-4-5-20251001", types: [IntentType.CHAT], pricing: pricingPerMillionTokens({ input: 1.0, output: 5.0, sourceUrl: ANTHROPIC_MODELS_URL }), runtimeSupport: { status: ProviderModelRuntimeSupportStatus.SUPPORTED, reason: "Validated via provider E2E (run + streaming SSE)", updatedAt: "2026-05-04" } },
    ],

    [IntentProvider.MISTRAL]: [],

    [IntentProvider.COHERE]: [],

    [IntentProvider.OFFICE]: [
        // Office = internal/local OpenAI-compatible runtime (vLLM etc.)
        // Keep IDs aligned with the common local model naming used in registries.
        { id: "Qwen3-4B-Instruct-2507", types: [IntentType.CHAT] },        
    ],

    [IntentProvider.OLLAMA]: [],

    [IntentProvider.OPEN_AI_COMPATIBLE]: [],

    [IntentProvider.OCR]: [],

    [IntentProvider.CLIP]: [],
    [IntentProvider.HTTP_TOOL]: [],
    [IntentProvider.RULES]: [],
};

/**
 * Canonical provider model catalog (after enrichment passes).
 */
export const PROVIDER_MODEL_DEFINITIONS_BY_PROVIDER: Record<IntentProvider, ProviderModelDefinition[]> =
    fillMissingPricingFromBaseModels(PROVIDER_MODEL_DEFINITIONS_BY_PROVIDER_RAW);

const _PROVIDER_MODEL_INDEXES = buildProviderModelCatalogAndTypeIndex(PROVIDER_MODEL_DEFINITIONS_BY_PROVIDER);

/**
 * Canonical lookup: provider -> modelId -> model definition.
 */
export const PROVIDER_MODEL_CATALOG: Record<IntentProvider, Record<string, ProviderModelDefinition>> =
    _PROVIDER_MODEL_INDEXES.catalog;

/**
 * Primary listing structure (no duplicated metadata): provider -> intent type -> model IDs.
 */
export const PROVIDER_MODEL_IDS_BY_PROVIDER_AND_TYPE: Record<IntentProvider, Record<IntentType, string[]>> =
    _PROVIDER_MODEL_INDEXES.idsByType;

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
 *
 * How to use
 * - When a model ID becomes obsolete/retired, mark it as `LEGACY` with a reason.
 * - The E2E suite will still enumerate it (catalog stays complete) but will skip execution.
 */
export const PROVIDER_MODEL_E2E_OVERRIDES: Record<IntentProvider, Record<string, ProviderModelE2EOverride>> = {
    [IntentProvider.OPEN_AI]: {
        // Not chat-completions models (will 404 on /v1/chat/completions)
        "babbage-002": { status: ProviderModelE2EStatus.LEGACY, reason: "Not a chat-completions model" },
        "davinci-002": { status: ProviderModelE2EStatus.LEGACY, reason: "Not a chat-completions model" },
        "gpt-3.5-turbo-instruct": { status: ProviderModelE2EStatus.LEGACY, reason: "Not a chat-completions model" },
    },
    [IntentProvider.GEMINI]: {
        // Listed by the Models API but not callable for many accounts (404).
        "gemini-2.0-flash": { status: ProviderModelE2EStatus.LEGACY, reason: "Listed but not callable for many accounts (404)" },
        "gemini-2.0-flash-001": { status: ProviderModelE2EStatus.LEGACY, reason: "Listed but not callable for many accounts (404)" },
        "gemini-2.0-flash-lite": { status: ProviderModelE2EStatus.LEGACY, reason: "Listed but not callable for many accounts (404)" },
        "gemini-2.0-flash-lite-001": { status: ProviderModelE2EStatus.LEGACY, reason: "Listed but not callable for many accounts (404)" },

        // Preview/live endpoint variants can be account-gated or missing.
        "gemini-3.1-flash-live-preview": { status: ProviderModelE2EStatus.LEGACY, reason: "Model/endpoint not found (404) in provider E2E" },

        // Requires explicit Computer Use tooling.
        "gemini-2.5-computer-use-preview-10-2025": { status: ProviderModelE2EStatus.LEGACY, reason: "Requires Computer Use tool wiring (not supported in runtime v1)" },

        // Audio-only response modalities (runtime v1 is text-only).
        "gemini-2.5-pro-preview-tts": { status: ProviderModelE2EStatus.LEGACY, reason: "Audio-only response modality (TEXT unsupported)" },
        "gemini-2.5-flash-preview-tts": { status: ProviderModelE2EStatus.LEGACY, reason: "Audio-only response modality (TEXT unsupported)" },
        "gemini-2.5-flash-native-audio-latest": { status: ProviderModelE2EStatus.LEGACY, reason: "Native-audio model (text-only runtime)" },
        "gemini-2.5-flash-native-audio-preview-09-2025": { status: ProviderModelE2EStatus.LEGACY, reason: "Native-audio model (text-only runtime)" },
        "gemini-2.5-flash-native-audio-preview-12-2025": { status: ProviderModelE2EStatus.LEGACY, reason: "Native-audio model (text-only runtime)" },

        // Some robotics preview IDs appear/disappear across accounts.
        "gemini-robotics-er-1.5-preview": { status: ProviderModelE2EStatus.LEGACY, reason: "Model/endpoint not found (404) in provider E2E" },
    },
    [IntentProvider.GROK]: {},
    [IntentProvider.ANTHROPIC]: {},
    [IntentProvider.MISTRAL]: {},
    [IntentProvider.COHERE]: {},
    [IntentProvider.OFFICE]: {},
    [IntentProvider.OLLAMA]: {},
    [IntentProvider.OPEN_AI_COMPATIBLE]: {},
    [IntentProvider.OCR]: {},
    [IntentProvider.CLIP]: {},
    [IntentProvider.HTTP_TOOL]: {},
    [IntentProvider.RULES]: {},
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
        updatedAt: args.updatedAt ?? PRICING_UPDATED_AT_20260327,
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
function pricingGeminiPerMillionTokens(args: {
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
    return pricingPerMillionTokens({
        input: args.input,
        output: args.output,
        tiers: args.tiers,
        sourceUrl: GEMINI_PRICING_URL,
        updatedAt: PRICING_UPDATED_AT_20260430,
        confidence: "official",
        notes: args.notes,
    });
}

function clonePricingAsApproxFromBase(args: {
    modelId: string;
    baseId: string;
    basePricing: ProviderModelPricing;
    relation?: "base" | "fallback";
}): ProviderModelPricing {
    const base = args.basePricing;
    const relation = args.relation ?? "base";
    const extraNote = relation === "fallback"
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
function fillMissingPricingFromBaseModels(modelsByProvider: Record<IntentProvider, ProviderModelDefinition[]>): Record<IntentProvider, ProviderModelDefinition[]> {
    const out = {} as Record<IntentProvider, ProviderModelDefinition[]>;

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
                        pricing: clonePricingAsApproxFromBase({ modelId: def.id, baseId, basePricing, relation: "base" }),
                    };
                }
            }

            for (const rule of fallbacks) {
                if (!rule.match.test(def.id)) continue;

                const fallbackPricing = pricingById[rule.baseModelId];
                if (!fallbackPricing) continue;

                return {
                    ...def,
                    pricing: clonePricingAsApproxFromBase({ modelId: def.id, baseId: rule.baseModelId, basePricing: fallbackPricing, relation: "fallback" }),
                };
            }

            return def;
        });
    }

    return out;
}

function buildProviderModelCatalogAndTypeIndex(
    modelsByProvider: Record<IntentProvider, ProviderModelDefinition[]>
): {
    catalog: Record<IntentProvider, Record<string, ProviderModelDefinition>>;
    idsByType: Record<IntentProvider, Record<IntentType, string[]>>;
} {
    const intentTypes = Object.values(IntentType) as IntentType[];

    const catalog = {} as Record<IntentProvider, Record<string, ProviderModelDefinition>>;
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
    static readonly idsByProviderAndType = PROVIDER_MODEL_IDS_BY_PROVIDER_AND_TYPE;

    /** Source-of-truth definitions in declared order (useful for UI display). */
    static readonly definitionsByProvider = PROVIDER_MODEL_DEFINITIONS_BY_PROVIDER;

    /** Returns the model definition if present; otherwise null. */
    static getModelDefinition(provider: IntentProvider, modelId: string): ProviderModelDefinition | null {
        return ProviderModelRegistry.catalog[provider]?.[modelId] ?? null;
    }

    /** Lists all model IDs for a provider (stable order as declared in the catalog). */
    static listProviderModelIds(provider: IntentProvider): string[] {
        return (ProviderModelRegistry.definitionsByProvider[provider] ?? []).map((m) => m.id);
    }

    /** Lists all model definitions for a provider (stable order as declared in the catalog). */
    static listProviderModels(provider: IntentProvider): ProviderModelDefinition[] {
        return ProviderModelRegistry.definitionsByProvider[provider] ?? [];
    }

    /** Lists model IDs for a provider that support a given IntentType. */
    static listProviderModelIdsForType(provider: IntentProvider, type: IntentType): string[] {
        return ProviderModelRegistry.idsByProviderAndType[provider]?.[type] ?? [];
    }

    /** Lists model definitions for a provider that support a given IntentType. */
    static listProviderModelsForType(provider: IntentProvider, type: IntentType): ProviderModelDefinition[] {
        const ids = ProviderModelRegistry.listProviderModelIdsForType(provider, type);
        return ids
            .map((id) => ProviderModelRegistry.getModelDefinition(provider, id))
            .filter((m): m is ProviderModelDefinition => m !== null);
    }

    /** Returns true if the provider has at least one model for the given IntentType. */
    static providerSupportsType(provider: IntentProvider, type: IntentType): boolean {
        return ProviderModelRegistry.listProviderModelIdsForType(provider, type).length > 0;
    }

    /** Returns true if the model supports the given IntentType (based on the catalog). */
    static modelSupportsType(provider: IntentProvider, modelId: string, type: IntentType): boolean {
        const def = ProviderModelRegistry.getModelDefinition(provider, modelId);
        if (!def) return false;
        return def.types.includes(type);
    }

    /** Lists all providers that have at least one model supporting the given IntentType. */
    static listProvidersSupportingType(type: IntentType): IntentProvider[] {
        return (Object.values(IntentProvider) as IntentProvider[]).filter((p) => ProviderModelRegistry.providerSupportsType(p, type));
    }

    /** Returns all model IDs across all providers for a given type. */
    static listAllModelIdsForType(type: IntentType): Array<{ provider: IntentProvider; modelId: string }> {
        const out: Array<{ provider: IntentProvider; modelId: string }> = [];
        for (const provider of Object.values(IntentProvider) as IntentProvider[]) {
            for (const modelId of ProviderModelRegistry.listProviderModelIdsForType(provider, type)) {
                out.push({ provider, modelId });
            }
        }
        return out;
    }

    /** Convenience: get unified pricing if present (or null if not set/unknown). */
    static getModelPricing(provider: IntentProvider, modelId: string): ProviderModelPricing | null {
        return ProviderModelRegistry.getModelDefinition(provider, modelId)?.pricing ?? null;
    }

    /** Get a specific pricing component from a model by kind (or null if absent). */
    static getPricingComponent<TKind extends ProviderPricingComponent["kind"]>(
        provider: IntentProvider,
        modelId: string,
        kind: TKind
    ): Extract<ProviderPricingComponent, { kind: TKind }> | null {
        const pricing = ProviderModelRegistry.getModelPricing(provider, modelId);
        if (!pricing) return null;

        const found = pricing.components.find((c) => c.kind === kind);
        return (found as any) ?? null;
    }

    /** Convenience: token pricing (per MTok) if present. */
    static getTokenPricing(provider: IntentProvider, modelId: string): Extract<ProviderPricingComponent, { kind: "tokens" }> | null {
        return ProviderModelRegistry.getPricingComponent(provider, modelId, "tokens");
    }
}
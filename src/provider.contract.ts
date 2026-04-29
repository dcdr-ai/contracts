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

const PRICING_UPDATED_AT_20260327 = Date.UTC(2026, 2, 27);
const PRICING_UPDATED_AT_20260326 = Date.UTC(2026, 2, 26);
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
 * Canonical provider model catalog (single source of truth).
 *
 * Note: This is a curated snapshot of commonly used official model IDs (updated March 2026).
 * Providers may add/deprecate models frequently; keep this list in sync with vendor docs.
 */
export const PROVIDER_MODEL_DEFINITIONS_BY_PROVIDER: Record<IntentProvider, ProviderModelDefinition[]> = {
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
        {
            id: "gemini-2.5-pro",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                components: [
                    {
                        kind: "tokens",
                        unit: "per_million_tokens",
                        input: 1.25,
                        outputUsd: 10.0,
                        cachedInput: 0.125,
                        tiers: [
                            {
                                name: "prompts > 200k tokens",
                                condition: "prompts > 200k tokens",
                                input: 2.5,
                                output: 15.0,
                                cachedInput: 0.25,
                            },
                        ],
                    },
                ],
            },
        },
        {
            id: "gemini-2.5-flash",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                components: [
                    {
                        kind: "tokens",
                        unit: "per_million_tokens",
                        input: 0.3,
                        outputUsd: 2.5,
                        cachedInput: 0.03,
                        tiers: [
                            {
                                name: "audio input",
                                condition: "audio input tokens",
                                input: 1.0,
                                output: 2.5,
                                cachedInput: 0.1,
                            },
                        ],
                    },
                ],
            },
        },
        {
            id: "gemini-2.5-flash-lite",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                components: [
                    {
                        kind: "tokens",
                        unit: "per_million_tokens",
                        input: 0.1,
                        outputUsd: 0.4,
                        cachedInput: 0.01,
                        tiers: [
                            {
                                name: "audio input",
                                condition: "audio input tokens",
                                input: 0.3,
                                output: 0.4,
                                cachedInput: 0.03,
                            },
                        ],
                    },
                ],
            },
        },
        {
            id: "gemini-3.1-pro-preview",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                components: [
                    {
                        kind: "tokens",
                        unit: "per_million_tokens",
                        input: 2.0,
                        outputUsd: 12.0,
                        cachedInput: 0.2,
                        tiers: [
                            {
                                name: "prompts > 200k tokens",
                                condition: "prompts > 200k tokens",
                                input: 4.0,
                                output: 18.0,
                                cachedInput: 0.4,
                            },
                        ],
                    },
                ],
            },
        },
        {
            id: "gemini-3-flash-preview",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                components: [
                    {
                        kind: "tokens",
                        unit: "per_million_tokens",
                        input: 0.5,
                        outputUsd: 3.0,
                        cachedInput: 0.05,
                        tiers: [
                            {
                                name: "audio input",
                                condition: "audio input tokens",
                                input: 1.0,
                                output: 3.0,
                                cachedInput: 0.1,
                            },
                        ],
                    },
                ],
            },
        },
        {
            id: "gemini-3.1-flash-lite-preview",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                components: [
                    {
                        kind: "tokens",
                        unit: "per_million_tokens",
                        input: 0.25,
                        outputUsd: 1.5,
                        cachedInput: 0.025,
                        tiers: [
                            {
                                name: "audio input",
                                condition: "audio input tokens",
                                input: 0.5,
                                output: 1.5,
                                cachedInput: 0.05,
                            },
                        ],
                    },
                ],
            },
        },

        {
            id: "gemini-embedding-001",
            types: [IntentType.EMBEDDING],
            pricing: pricingPerMillionTokens({ input: 0.15, output: 0.0, sourceUrl: GEMINI_PRICING_URL, updatedAt: PRICING_UPDATED_AT_20260326 }),
        },
        {
            id: "gemini-embedding-2-preview",
            types: [IntentType.EMBEDDING],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                notes:
                    "Modality-specific input pricing. Page also lists equivalences: image $0.00012/image; audio $0.00016/sec; video $0.00079/frame.",
                components: [
                    {
                        kind: "tokens",
                        unit: "per_million_tokens",
                        input: 0.2,
                        outputUsd: 0.0,
                        tiers: [
                            { name: "image input", condition: "image input", input: 0.45, output: 0.0 },
                            { name: "audio input", condition: "audio input", input: 6.5, output: 0.0 },
                            { name: "video input", condition: "video input", input: 12.0, output: 0.0 },
                        ],
                    },
                    { kind: "images", unit: "per_image", input: 0.00012, notes: "Image input equivalence from pricing page" },
                    { kind: "audio_minutes", unit: "per_minute", input: 0.0096, notes: "Derived from $0.00016/sec shown on pricing page" },
                ],
            },
        },

        {
            id: "gemini-2.5-flash-image",
            types: [IntentType.IMAGE_GENERATION],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                notes: "Text input priced like Gemini 2.5 Flash; image output priced per image.",
                components: [
                    {
                        kind: "tokens",
                        unit: "per_million_tokens",
                        input: 0.3,
                        outputUsd: 2.5,
                        cachedInput: 0.03,
                    },
                    { kind: "images", unit: "per_image", output: 0.039, notes: "Up to 1024x1024 equivalent" },
                ],
            },
        },
        {
            id: "imagen-4.0-generate-001",
            types: [IntentType.IMAGE_GENERATION],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                components: [{ kind: "images", unit: "per_image", output: 0.04 }],
            },
        },
        {
            id: "imagen-4.0-ultra-generate-001",
            types: [IntentType.IMAGE_GENERATION],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                components: [{ kind: "images", unit: "per_image", output: 0.06 }],
            },
        },
        {
            id: "imagen-4.0-fast-generate-001",
            types: [IntentType.IMAGE_GENERATION],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                components: [{ kind: "images", unit: "per_image", output: 0.02 }],
            },
        },
        {
            id: "gemini-3.1-flash-image-preview",
            types: [IntentType.IMAGE_GENERATION],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                notes:
                    "Pricing page lists image output as $60 / 1M tokens with per-image equivalents by resolution (0.5K/1K/2K/4K).",
                components: [
                    {
                        kind: "tokens",
                        unit: "per_million_tokens",
                        input: 0.5,
                        outputUsd: 3.0,
                        tiers: [{ name: "image output tokens", condition: "image output tokens", input: 0.5, output: 60.0 }],
                    },
                ],
            },
        },
        {
            id: "gemini-3-pro-image-preview",
            types: [IntentType.IMAGE_GENERATION],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                notes:
                    "Text IO priced like Gemini 3.1 Pro Preview. Page lists image input equivalence $0.0011/image and image output as $120 / 1M tokens with per-image equivalents.",
                components: [
                    {
                        kind: "tokens",
                        unit: "per_million_tokens",
                        input: 2.0,
                        outputUsd: 12.0,
                        tiers: [{ name: "image output tokens", condition: "image output tokens", input: 2.0, output: 120.0 }],
                    },
                    { kind: "images", unit: "per_image", input: 0.0011, notes: "Image input equivalence from pricing page" },
                ],
            },
        },

        {
            id: "gemini-2.5-flash-preview-tts",
            types: [IntentType.TEXT_TO_SPEECH],
            pricing: pricingPerMillionTokens({
                input: 0.5,
                output: 10.0,
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                notes: "Pricing table labels output as audio; represented here as token-like units per the Gemini pricing page.",
            }),
        },
        {
            id: "gemini-2.5-pro-preview-tts",
            types: [IntentType.TEXT_TO_SPEECH],
            pricing: pricingPerMillionTokens({
                input: 1.0,
                output: 20.0,
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                notes: "Pricing table labels output as audio; represented here as token-like units per the Gemini pricing page.",
            }),
        },

        {
            id: "gemini-3.1-flash-live-preview",
            types: [IntentType.MULTIMODAL],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                notes:
                    "Live API model: pricing page lists both token-based prices and alternate per-minute rates for some modalities.",
                components: [
                    {
                        kind: "tokens",
                        unit: "per_million_tokens",
                        input: 0.75,
                        outputUsd: 4.5,
                        tiers: [
                            { name: "audio", condition: "audio", input: 3.0, output: 12.0 },
                            { name: "image/video input", condition: "image/video input", input: 1.0, output: 4.5 },
                        ],
                    },
                    {
                        kind: "audio_minutes",
                        unit: "per_minute",
                        input: 0.005,
                        output: 0.018,
                        notes: "Audio per-minute alternative. Page also lists image/video input alternative: $0.002/min.",
                    },
                ],
            },
        },
        {
            id: "gemini-2.5-flash-native-audio-preview-12-2025",
            types: [IntentType.MULTIMODAL],
            pricing: {
                currency: "USD",
                sourceUrl: GEMINI_PRICING_URL,
                updatedAt: PRICING_UPDATED_AT_20260326,
                confidence: "official",
                notes: "Live API native audio model.",
                components: [
                    {
                        kind: "tokens",
                        unit: "per_million_tokens",
                        input: 0.5,
                        outputUsd: 2.0,
                        tiers: [{ name: "audio/video", condition: "audio/video", input: 3.0, output: 12.0 }],
                    },
                ],
            },
        },
    ],

    [IntentProvider.GROK]: [
        { id: "grok-4", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS] },
        { id: "grok-4-latest", types: [IntentType.CHAT, IntentType.MULTIMODAL] },
        {
            id: "grok-4.20-0309-reasoning",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: pricingPerMillionTokens({ input: 2.0, cachedInput: 0.2, output: 6.0, sourceUrl: XAI_PRICING_URL }),
        },
        {
            id: "grok-4.20-0309-non-reasoning",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: pricingPerMillionTokens({ input: 2.0, cachedInput: 0.2, output: 6.0, sourceUrl: XAI_PRICING_URL }),
        },
        {
            id: "grok-4-1-fast-reasoning",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: pricingPerMillionTokens({ input: 0.2, cachedInput: 0.05, output: 0.5, sourceUrl: XAI_PRICING_URL }),
        },
        {
            id: "grok-4-1-fast-non-reasoning",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: pricingPerMillionTokens({ input: 0.2, cachedInput: 0.05, output: 0.5, sourceUrl: XAI_PRICING_URL }),
        },
        { id: "grok-4.20-multi-agent-0309", types: [IntentType.CHAT, IntentType.MULTIMODAL] },
        { id: "grok-3", types: [IntentType.CHAT, IntentType.MULTIMODAL] },
        { id: "grok-3-mini", types: [IntentType.CHAT, IntentType.MULTIMODAL] },

        { id: "grok-imagine-image", types: [IntentType.IMAGE_GENERATION] },
        { id: "grok-imagine-image-pro", types: [IntentType.IMAGE_GENERATION] },
    ],

    [IntentProvider.ANTHROPIC]: [
        {
            id: "claude-opus-4-6",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: pricingPerMillionTokens({ input: 5.0, output: 25.0, sourceUrl: ANTHROPIC_MODELS_URL }),
        },
        {
            id: "claude-sonnet-4-6",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: pricingPerMillionTokens({ input: 3.0, output: 15.0, sourceUrl: ANTHROPIC_MODELS_URL }),
        },
        {
            id: "claude-haiku-4-5",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: pricingPerMillionTokens({ input: 1.0, output: 5.0, sourceUrl: ANTHROPIC_MODELS_URL }),
        },
        {
            id: "claude-haiku-4-5-20251001",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: pricingPerMillionTokens({ input: 1.0, output: 5.0, sourceUrl: ANTHROPIC_MODELS_URL }),
        },
    ],

    [IntentProvider.MISTRAL]: [
        {
            id: "mistral-large-2512",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: pricingPerMillionTokens({ input: 0.5, output: 1.5, sourceUrl: MISTRAL_MODELS_URL }),
        },
        {
            id: "mistral-small-2603",
            types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS],
            pricing: pricingPerMillionTokens({ input: 0.15, output: 0.6, sourceUrl: MISTRAL_MODELS_URL }),
        },

        {
            id: "mistral-embed-2312",
            types: [IntentType.EMBEDDING],
            pricing: pricingPerMillionTokens({ input: 0.1, output: 0.0, sourceUrl: MISTRAL_MODELS_URL, notes: "Embedding models are typically billed on input tokens only" }),
        },

        { id: "voxtral-mini-2602", types: [IntentType.SPEECH_TO_TEXT] },
        { id: "voxtral-tts-2603", types: [IntentType.TEXT_TO_SPEECH] },
    ],

    [IntentProvider.COHERE]: [
        { id: "command-a-03-2025", types: [IntentType.CHAT] },
        { id: "command-a-reasoning-08-2025", types: [IntentType.CHAT] },
        { id: "command-r-plus-08-2024", types: [IntentType.CHAT] },
        { id: "command-r-08-2024", types: [IntentType.CHAT] },
        { id: "command-r7b-12-2024", types: [IntentType.CHAT] },
        { id: "c4ai-aya-expanse-32b", types: [IntentType.CHAT] },
        { id: "command-a-vision-07-2025", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS] },
        { id: "c4ai-aya-vision-32b", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS] },

        { id: "embed-v4.0", types: [IntentType.EMBEDDING] },
        { id: "embed-english-v3.0", types: [IntentType.EMBEDDING] },
        { id: "embed-english-light-v3.0", types: [IntentType.EMBEDDING] },
        { id: "embed-multilingual-v3.0", types: [IntentType.EMBEDDING] },
        { id: "embed-multilingual-light-v3.0", types: [IntentType.EMBEDDING] },

        { id: "cohere-transcribe-03-2026", types: [IntentType.SPEECH_TO_TEXT] },
    ],

    [IntentProvider.OFFICE]: [
        // Office = internal/local OpenAI-compatible runtime (vLLM etc.)
        // Keep IDs aligned with the common local model naming used in registries.
        { id: "Qwen3-4B-Instruct-2507", types: [IntentType.CHAT] },        
    ],

    [IntentProvider.OLLAMA]: [
        { id: "llama3.3", types: [IntentType.CHAT] },
        { id: "llama3.2", types: [IntentType.CHAT] },
        { id: "llama3.1", types: [IntentType.CHAT] },
        { id: "qwen3", types: [IntentType.CHAT] },
        { id: "qwen2.5", types: [IntentType.CHAT] },
        { id: "deepseek-r1", types: [IntentType.CHAT] },
        { id: "gemma3", types: [IntentType.CHAT] },
        { id: "mistral", types: [IntentType.CHAT] },
        { id: "phi4", types: [IntentType.CHAT] },
        { id: "gpt-oss", types: [IntentType.CHAT] },

        { id: "llava", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS] },
        { id: "llama3.2-vision", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS] },
        { id: "minicpm-v", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS] },
        { id: "moondream", types: [IntentType.CHAT, IntentType.MULTIMODAL, IntentType.IMAGE_ANALYSIS] },

        { id: "nomic-embed-text", types: [IntentType.EMBEDDING] },
        { id: "mxbai-embed-large", types: [IntentType.EMBEDDING] },
        { id: "bge-m3", types: [IntentType.EMBEDDING] },
        { id: "embeddinggemma", types: [IntentType.EMBEDDING] },
        { id: "qwen3-embedding", types: [IntentType.EMBEDDING] },
    ],

    [IntentProvider.OPEN_AI_COMPATIBLE]: [],

    [IntentProvider.OCR]: [
        { id: "mistral-ocr-2512", types: [IntentType.IMAGE_ANALYSIS] },
    ],

    [IntentProvider.CLIP]: [],
    [IntentProvider.HTTP_TOOL]: [],
    [IntentProvider.RULES]: [],
};

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
    [IntentProvider.GEMINI]: {},
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
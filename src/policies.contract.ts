import { IntentProvider } from "./provider.contract";
import { IsBoolean, IsEnum, IsOptional, Max, Min } from "class-validator";

/**
 * Retry policy for an intent/model.
 * Keep this stable; it's part of the behavior contract.
 */
/**
 * Retry policy for an intent/model.
 * Keep this stable; it's part of the behavior contract.
 */
export class RetryPolicy {
    /**
     * Max total attempts across all candidates (including first try).
     * Example: 3 => try primary + up to 2 more attempts.
     */
    @Min(1)
    @Max(10)
    maxAttempts: number = 1;

    /**
     * Max retries per single candidate before switching to next.
     * Example: 1 => at most 1 attempt per candidate (no local retries).
     * Example: 2 => 2 attempts on same candidate before fallback.
     */
    @Min(1)
    @Max(10)
    @IsOptional()
    maxPerCandidate?: number = 1;

    /**
     * Timeout for a single provider attempt in milliseconds.
     * If not provided, provider adapter default is used.
     */
    @Min(0)
    @Max(600000) // 10 minutes max timeout
    attemptTimeoutMs?: number = 60000; // Default to 60 seconds

    /**
     * Whether fallback to the next candidate is allowed.
     * If false, fail after exhausting retries of the selected candidate(s).
     */
    @IsBoolean()
    allowFallback: boolean = true;

    /**
        * Whether to do a "repair pass" when output fails JSON/schema validation.
        * Useful for strict JSON intents (format parser, mappers).
        *
        * Repair pass semantics (runtime behavior)
        * - Trigger condition: the previous attempt failed with `PARSE_FAIL` or `SCHEMA_FAIL`.
        * - Structured-only: only applies when the intent is in structured mode (has `outputSchema` and/or
        *   `response_format` is `json_object`/`json_schema`).
        * - Effect: the gateway appends one extra *system* instruction message to the existing rendered prompt
        *   (marker: `[DCDR_REPAIR_PASS]`) asking the model to re-emit ONLY valid JSON matching the expected schema.
        * - Budgeting: consumes the normal retry budget (must still be within `maxPerCandidate` and `maxAttempts`).
        * - Scope: at most one repair pass is attempted per candidate execution.
        *
        * Notes
        * - This does not change the intent inputs; it only changes the instruction for the next attempt.
        * - If you want repair behavior, you typically enable this AND include `PARSE_FAIL`/`SCHEMA_FAIL` in `retryOn`,
        *   but the repair pass itself is allowed even when `retryOn` is empty.
     */
    @IsOptional()
    @IsBoolean()
    repairOnParseFail?: boolean = false;


    /**
     * Backoff strategy between attempts.
     * - fixed: always wait retryBackoffMs
     * - exponential: retryBackoffMs * 2^(n-1), capped by retryBackoffCapMs
     */
    @IsOptional()
    retryBackoffStrategy?: "fixed" | "exponential" = "exponential";

    /**
     * Base backoff delay in milliseconds between attempts (after the first).
     * Defaults can be applied by the engine if undefined.
     */
    @Min(0)
    @Max(600000)
    @IsOptional()
    retryBackoffMs?: number = 250;

    /**
     * Maximum backoff delay in milliseconds when using exponential strategy.
     */
    @Min(0)
    @Max(600000)
    @IsOptional()
    retryBackoffCapMs?: number = 5000;

    /**
     * Adds random jitter [0..retryJitterMs] to backoff to avoid synchronized retries.
     */
    @Min(0)
    @Max(600000)
    @IsOptional()
    retryJitterMs?: number = 250;


    /**
     * Error codes that are considered retryable/fallbackable.
     * Keep values stable. Your engine should map real exceptions into these codes.
     */
    @IsOptional()
    retryOn?: Array<
        | "TIMEOUT"
        | "RATE_LIMIT"
        | "UPSTREAM_5XX"
        | "NETWORK"
        | "PARSE_FAIL"
        | "SCHEMA_FAIL"
    >;
}



/**
 * How hard the model should think before it answers.
 *
 * Replaces `enable_thinking?: boolean` (removed in 3.11.0). A flag could not express the difference
 * between a cheap classification and a hard planning step, and it could not be mapped faithfully to
 * any provider: none of the three takes a boolean. They take a level or a token budget.
 *
 * The ladder is **OpenAI's**, verified against the installed SDK rather than assumed
 * (`openai/resources/shared.d.ts`: `ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high'
 * | 'xhigh' | 'max' | null`). Mirroring it means no DCDR value has to collapse into another one on
 * the provider with the most granular control - the failure mode where a contract promises a
 * distinction the adapter cannot keep.
 *
 * For providers that take a budget instead of a level - Anthropic's `thinking.budget_tokens` and
 * Gemini's `thinkingConfig.thinkingBudget`, both integers - the mapping is
 * {@link THINKING_LEVEL_TOKEN_BUDGET}, which is deliberately one exported table so a tenant can be
 * shown what a level will cost them before they are billed for it.
 *
 * Two things that follow from the providers' own rules and are handled by the adapters:
 * - **Reasoning tokens come out of `max_tokens`.** Anthropic states it outright ("counts towards your
 *   `max_tokens` limit", and `budget_tokens` must be `< max_tokens`). So raising the level without
 *   raising the budget spends the allowance on thinking and truncates the answer.
 * - **Sampling and reasoning do not mix.** Reasoning models constrain or reject `temperature`, so
 *   the adapter drops it rather than asking every caller to know three providers' rules.
 */
export enum ThinkingLevel {
  /** No reasoning pass. The default, and what an absent value means. */
  NONE = "NONE",
  MINIMAL = "MINIMAL",
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  XHIGH = "XHIGH",
  MAX = "MAX",
}

/**
 * Token budget each level asks for, on providers that take a budget rather than a level.
 *
 * Chosen as a doubling ladder from Anthropic's documented floor: `budget_tokens` "must be >= 1024",
 * which is why `MINIMAL` is 1024 and not something smaller. A budget is a *ceiling on thinking*, not
 * a reservation - a model that needs less uses less - so the cost of a generous upper rung is only
 * paid by a request that genuinely reasons that long.
 *
 * These numbers are the contract's answer to "what does HIGH cost", and they are exported for that
 * reason: the control plane shows them, the adapters apply them, and there is one place to change
 * them. An adapter must still clamp against the request's own `max_tokens` (see
 * {@link resolveThinkingTokenBudget}), because the provider rejects a budget that does not leave
 * room for an answer.
 */
export const THINKING_LEVEL_TOKEN_BUDGET: Readonly<Record<ThinkingLevel, number>> = Object.freeze({
  [ThinkingLevel.NONE]: 0,
  [ThinkingLevel.MINIMAL]: 1_024,
  [ThinkingLevel.LOW]: 2_048,
  [ThinkingLevel.MEDIUM]: 4_096,
  [ThinkingLevel.HIGH]: 8_192,
  [ThinkingLevel.XHIGH]: 16_384,
  [ThinkingLevel.MAX]: 32_768,
});

/**
 * The smallest budget a budget-taking provider will accept (Anthropic's documented floor).
 *
 * Below this the request is refused, so a clamp that cannot reach it must turn thinking **off**
 * rather than send a value the provider will reject.
 */
export const THINKING_MIN_TOKEN_BUDGET = 1_024;

/**
 * Fraction of `max_tokens` that thinking may consume when the level's budget does not fit.
 *
 * Anthropic requires `budget_tokens < max_tokens`, and a budget equal to the whole allowance leaves
 * nothing for the answer - which is the failure the backend hit with a 512-token planner: a response
 * truncated into invalid JSON, reported as a planner error rather than as a budget one. Two thirds
 * leaves a third for the result, which is the right side to err on: thinking that stops early
 * degrades quality, an answer that stops early is unparseable.
 */
export const THINKING_MAX_BUDGET_FRACTION = 2 / 3;

/**
 * The budget to send for a level, clamped so the answer still has room.
 *
 * @param level Requested level; `NONE` or absent means no thinking.
 * @param maxTokens The request's own `max_tokens`, when known.
 * @returns The budget to send, or `null` when thinking should be off (either it was not asked for,
 *   or the allowance is too small to leave a usable budget above the provider floor).
 */
export function resolveThinkingTokenBudget(level: ThinkingLevel | undefined, maxTokens?: number): number | null {
  if (!level || level === ThinkingLevel.NONE) return null;

  const requested = THINKING_LEVEL_TOKEN_BUDGET[level] ?? 0;
  if (requested <= 0) return null;
  if (!maxTokens || maxTokens <= 0) return requested;

  const ceiling = Math.floor(maxTokens * THINKING_MAX_BUDGET_FRACTION);
  // Too small to think at all: sending a budget under the provider floor is a refused request, and
  // silently thinking less than asked is better than failing the call outright.
  if (ceiling < THINKING_MIN_TOKEN_BUDGET) return null;
  return Math.min(requested, ceiling);
}

/**
 * The level a pre-3.11.0 `enable_thinking` flag meant.
 *
 * `true` becomes `MEDIUM` rather than `HIGH` because `medium` is literally what the only adapter
 * that honoured the flag sent (`openai.provider.ts`, hardcoded), so this preserves behaviour exactly
 * rather than approximately. Exported so the control plane's jsonb migration and the runtime agree
 * on one answer.
 *
 * @param enableThinking The legacy flag.
 * @returns The equivalent level.
 */
export function thinkingLevelFromLegacyFlag(enableThinking: boolean | undefined | null): ThinkingLevel {
  return enableThinking === true ? ThinkingLevel.MEDIUM : ThinkingLevel.NONE;
}

export type ResponseFormat = "json_object" | "json_schema" | "text" | "markdown" | "html";

/**
 * Preferred upstream API surface for OpenAI-compatible providers.
 *
 * Notes
 * - This is an execution/routing hint, not a prompt-semantics control.
 * - Provider adapters may still reject unsupported combinations.
 */
export enum PromptParametersPreferredApi {
    CHAT_COMPLETIONS = "CHAT_COMPLETIONS",
    RESPONSES = "RESPONSES",
}


export class PromptParameters {
    /**
     * Typical range: 0.0–2.0 (default: 0.7)
     */
    @Min(0)
    @Max(2)
    @IsOptional()
    temperature?: number;
    /**
     * Typical range: 0.0–1.0 (default: 1)
     */
    @Min(0)
    @Max(1)
    @IsOptional()
    top_p?: number;

    /**
     * Typical range: 1–100 (default: 50)
     */
    @Min(1)
    @Max(100)
    @IsOptional()
    top_k?: number;
    /**
     * Upper bound on the completion the provider may generate.
     *
     * The ceiling is 200 000 because the bound has to clear the largest output window any supported
     * model offers, and 8 192 stopped doing that some time ago: current frontier models emit far
     * more in a single completion, and a reasoning model spends part of the same budget on thinking
     * tokens before it writes anything. A validation cap below what the provider accepts does not
     * protect anyone - it just makes a legitimate configuration unpublishable, and the real limits
     * are the ones that matter: the provider's own per-model maximum (which rejects an oversized
     * request itself) and the tenant's cost controls.
     */
    @Min(1)
    @Max(200_000)
    @IsOptional()
    max_tokens?: number;
    /**
     * Any integer (optional, for reproducibility)
     */
    @IsOptional()
    seed?: number;

    /**
     * How hard the model should think before answering (3.11.0; replaces `enable_thinking`).
     *
     * Absent means {@link ThinkingLevel.NONE}. Note that reasoning tokens are drawn from the same
     * `max_tokens` allowance as the answer, and that asking for thinking causes the adapter to drop
     * `temperature` - a reasoning model constrains it, and resolving that per caller is how most
     * callers get it wrong, silently, in the direction of non-determinism.
     */
    @IsOptional()
    @IsEnum(ThinkingLevel)
    thinking?: ThinkingLevel;

    @IsOptional()
    response_format?: ResponseFormat

    /**
     * Optional override for the upstream API surface used by OpenAI-compatible adapters.
     *
     * Precedence
     * - If set, this overrides provider/model defaults and local heuristics.
     * - When omitted, provider/model defaults remain in effect.
     */
    @IsOptional()
    preferred_api?: PromptParametersPreferredApi;

    /**
     * Typical range: -2.0–2.0 (default: 0.0)
     */
    @Min(-2)
    @Max(2)
    @IsOptional()
    presence_penalty?: number;

    /**
     * Typical range: -2.0–2.0 (default: 0.0)
     */
    @Min(-2)
    @Max(2)
    @IsOptional()
    frequency_penalty?: number;
};





/**
 * Supported execution policy types.
 *
 * These policies decide how the gateway chooses the initial implementation
 * order before retries / fallback logic is applied.
 *
 * Notes:
 * - RetryPolicy is still responsible for retry attempts and failure handling.
 * - ExecutionPolicy is responsible for candidate planning and prioritization.
 */
export enum ExecutionPolicyType {
    /**
     * Use implementation weights as provided.
     * This is the simplest and most backward-compatible mode.
     */
    WEIGHTED = "WEIGHTED",

    /**
     * Use a fixed implementation order.
     * The first active/healthy implementation is tried first, then the next one.
     */
    FALLBACK_CHAIN = "FALLBACK_CHAIN",

    /**
     * Prefer local / office / on-prem implementations first.
     * If none are available, use the remaining implementations.
     */
    LOCAL_FIRST = "LOCAL_FIRST",

    /**
     * Prefer the cheapest implementations first.
     * Requires each implementation to expose an estimated cost score.
     */
    CHEAPEST_FIRST = "CHEAPEST_FIRST",

    /**
     * Prefer the fastest implementations first.
     * Requires each implementation to expose an expected latency score.
     */
    FASTEST_FIRST = "FASTEST_FIRST",

    /**
     * Prefer the highest-quality implementations first.
     * Requires each implementation to expose a quality score.
     */
    QUALITY_FIRST = "QUALITY_FIRST",

    /**
     * Conditioned routing based on request context.
     *
     * Notes
     * - Implementations must define `ImplementationContract.condition`.
     * - When no conditions match, runtime should fail explicitly.
     */
    CONDITION_ON_CONTEXT = "CONDITION_ON_CONTEXT",

    /**
     * Conditioned routing based on interpolated input variables (`ExecuteIntentRequest.vars`).
     *
     * Notes
     * - Implementations must define `ImplementationContract.condition`.
     * - When no conditions match, runtime should fail explicitly.
     */
    CONDITION_ON_INPUT = "CONDITION_ON_INPUT",
}

/**
 * Optional behavior when the selected policy cannot be fully evaluated.
 *
 * Example:
 * - CHEAPEST_FIRST was requested, but implementations do not provide cost metadata.
 */
export enum ExecutionPolicyFallbackMode {
    /**
     * Fall back to simple weighted selection.
     */
    WEIGHTED = "WEIGHTED",

    /**
     * Fall back to the declared implementation order.
     */
    DECLARED_ORDER = "DECLARED_ORDER",

    /**
     * Fail fast if the policy cannot be evaluated correctly.
     */
    ERROR = "ERROR",
}

/**
 * Exploration modes for candidate planning.
 *
 * Exploration is always explicit (opt-in) and is applied *after* deterministic ordering.
 *
 * V1 invariant
 * - Do not combine weight-based selection with score-based ordering.
 * - Exploration may reorder which candidate is tried first, but it must not change the underlying score ordering.
 */
export enum ExplorationMode {
    /**
     * Epsilon-greedy exploration over the top-K candidates.
     *
     * With probability `epsilon`, pick a random candidate in the top-K list.
     * Otherwise, keep the deterministic best candidate.
     */
    EPSILON_GREEDY_TOP_K = "EPSILON_GREEDY_TOP_K",
}

/**
 * Optional exploration configuration.
 *
 * Notes
 * - This is intended for Cloud/Cloud Pro only; runtime (self-hosted) may reject registries that require it.
 * - Parameters are validated at runtime.
 */
export interface ExplorationPolicy {
    /** Exploration mode. */
    mode: ExplorationMode;

    /** Probability of exploring (0..1). */
    epsilon: number;

    /** Max number of top candidates to sample within (>= 1). */
    topK: number;
}



/**
 * A simple execution policy contract for v1.
 *
 * This policy defines how the gateway should prioritize candidate
 * implementations for an intent before executing retries/fallbacks.
 *
 * Design goals:
 * - Simple
 * - Backward-compatible
 * - Easy to store in DB
 * - Easy to render in UI
 */
export interface ExecutionPolicy {


    /** Policy type. */
    type: ExecutionPolicyType;

    /**
     * Optional fixed implementation order.
     *
     * Used mainly for:
     * - FALLBACK_CHAIN
     *
     * Values should contain ImplementationContract IDs.
     */
    implementationOrder?: string[];

    /**
     * Optional provider affinity ordering.
     *
     * Used mainly for:
     * - LOCAL_FIRST
     *
     * Example:
     * [OFFICE, OPEN_AI]
     */
    preferredProviders?: IntentProvider[];

    /**
     * Secondary fallback mode if the selected policy cannot be fully evaluated.
     *
     * Example:
     * - CHEAPEST_FIRST without cost metadata
     * - FASTEST_FIRST without latency metadata
     */
    fallbackMode?: ExecutionPolicyFallbackMode;

    /**
     * Optional exploration behavior applied after deterministic ordering.
     *
     * Exploration is never enabled by default; it is only used when this block is present.
     */
    exploration?: ExplorationPolicy;
}

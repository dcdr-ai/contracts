import { IntentProvider } from "./provider.contract";
import { HttpRequestParams } from "./http.contract";

/**
 * Time window constraints for an implementation.
 * If present, the implementation is eligible ONLY within these windows.
 */
export interface ExecutionWindow {

  /**
   * UTC window: Bit 0..6 represent days of week (recommended: 0=Mon ... 6=Sun).
   */
  daysMask?: number;

  /**
   * UTC window: Bit 0..23 represent hour slots (bit0 = 00:00-01:00, bit23 = 23:00-00:00).
   */
  hoursMask?: number;

  /**
   * Whether the execution window must be enforced (if false, the gateway may ignore it and use the implementation anyway).
   */
  active?: boolean;
}


/**
 * Time window constraints for an implementation.
 * If present, the implementation is eligible ONLY within these windows.
 */
export interface ExecutionWindow {

  /**
   * UTC window: Bit 0..6 represent days of week (recommended: 0=Mon ... 6=Sun).
   */
  daysMask?: number;

  /**
   * UTC window: Bit 0..23 represent hour slots (bit0 = 00:00-01:00, bit23 = 23:00-00:00).
   */
  hoursMask?: number;

  /**
   * Whether the execution window must be enforced (if false, the gateway may ignore it and use the implementation anyway).
   */
  active?: boolean;
}


/**
 * Implementation contract: describes how a given provider/model endpoint can be used.
 * This is pure configuration; provider adapters interpret it.
 */
export interface ImplementationContract {

  /** Unique implementation ID (stable, e.g., UUID). */
  id: string;

  /** Provider type (OFFICE, OPEN_AI, GROK...). */
  provider: IntentProvider;

  /** Human-readable name for this implementation (e.g., "openai-format-parser"). */
  name: string;

  /** Version of this implementation (e.g., "2026-02-18.2"). */
  version: string;

  /**
   * SHA256 hash of the canonical implementation payload (stable JSON serialization).
   * Useful as an immutable fingerprint / audit trail.
   */
  sha256: string;

  /**
   * Precomputed semantic hash (stable across irrelevant formatting changes).
   * This MUST be exported from backend and used for:
   * - runHash (execution dedupe)
   */
  semanticHash: string;

  /**
   * Technical model identifier for the provider.
   * Examples:
   * - "gpt-4.1-mini"
   * - "Qwen3-4B-Instruct-2507"
   * - "grok-2"
   */
  model: string;

  /** Human readable description for diagnostics. */
  description?: string;

  /** Execution endpoint (HTTP, OpenAI-compatible, Dcdr, etc). */
  endpoint: string;

  /**
   * Auth configuration (token, headers, mTLS, etc).
   * NOTE: This must NOT affect semantic hashing in runtime.
   */
  authConfig?: HttpRequestParams;


  /** Optional reference to a credential contract (by id) for provider-specific auth config */
  credentialRef?: string;
  

  /**
   * Provider-specific runtime defaults (modelName, temperature, top_p, max_tokens, response_format, etc).
   * NOTE: AISemantics will filter keys when building runtimeParamsKey.
   */
  runtimeConfig?: any;

  /** Is this implementation usable. */
  active: boolean;

  /** Weight for load balancing or selection purposes. */
  weight?: number;

  order?: number; // Optional explicit order for selection; lower values are preferred. If not set, selection is non-deterministic among equals

  /**
   * Whether this implementation should be considered local / on-prem / office-side.
   * Useful for LOCAL_FIRST execution policies.
   */
  local?: boolean;

  /**
   * Relative cost score for policy-based selection.
   * Lower values mean cheaper implementations.
   * Used by CHEAPEST_FIRST policies.
   */
  costScore?: number;

  /**
   * Relative latency score for policy-based selection.
   * Lower values mean faster implementations.
   * Used by FASTEST_FIRST policies.
   */
  latencyScore?: number;

  /**
   * Relative quality score for policy-based selection.
   * Higher values mean better expected output quality.
   * Used by QUALITY_FIRST policies.
   */
  qualityScore?: number;

  trackingIOProbability?: number; // 0.0 to 1.0, probability of tracking input/output for this implementation (for privacy control)

  cacheTTLSeconds?: number; // If set, this implementation is cacheable for the given TTL (in seconds). Requires runHash and cacheable provider.

  /** Execution window constraints. */
  executionWindow?: ExecutionWindow;  
}
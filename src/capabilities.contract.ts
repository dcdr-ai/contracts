import { DcdrRegistry } from "./control.contract";
import { IntentContract } from "./intent.contract";
import { ExecutionPolicyType } from "./policies.contract";

/**
 * Stable, public capability identifiers derived from configuration/registry usage.
 *
 * Purpose
 * - Provide a single, exportable vocabulary to describe what a given registry/config *requires*.
 * - Enable:
 *   - Freeware runtime (`runtime` mode) to reject advanced features (allowlist).
 *   - Backend tier enforcement to map subscriptions/features to required runtime capabilities.
 *
 * Notes
 * - These are *technical* capabilities, not billing/subscription concepts.
 * - Keep values stable; they can become part of wire-level compatibility checks.
 */
export enum CapabilityKey {
  /** Prompt canary rollouts (canary prompt + weight). */
  AI_PROMPTS_CANARY = "AI_PROMPTS_CANARY",

  /** Any non-default/advanced execution policy (non-WEIGHTED). */
  AI_INTENTS_ADVANCED_EXECUTION_POLICY = "AI_INTENTS_ADVANCED_EXECUTION_POLICY",

  /** ExecutionPolicy exploration enabled (epsilon-greedy / top-K sampling). */
  AI_INTENTS_EXPLORATION_POLICY = "AI_INTENTS_EXPLORATION_POLICY",

  /** Response caching enabled with per-implementation TTL configuration. */
  AI_RUNTIME_CACHE_TTL_CONFIGURABLE = "AI_RUNTIME_CACHE_TTL_CONFIGURABLE",

  /** Execution window override at the implementation level. */
  AI_BASE_MODEL_EXECUTION_WINDOWS_OVERRIDE_PER_IMPLEMENTATION = "AI_BASE_MODEL_EXECUTION_WINDOWS_OVERRIDE_PER_IMPLEMENTATION",

  // ---------------------------------------------------------------------------
  // Runtime / platform capabilities (may be enforced by mode, not by registry)
  // ---------------------------------------------------------------------------

  /** Backend registry sync (cloud/cloud-pro control plane). */
  AI_RUNTIME_BACKEND_REGISTRY_SYNC = "AI_RUNTIME_BACKEND_REGISTRY_SYNC",

  /** Backend log ingestion (cloud/cloud-pro; runtime/freeware should not send logs to backend). */
  AI_OBSERVABILITY_BACKEND_LOG_INGESTION = "AI_OBSERVABILITY_BACKEND_LOG_INGESTION",

  /** Internal backend bypass auth mode (backend-to-runtime trusted traffic). */
  AI_SECURITY_INTERNAL_BYPASS = "AI_SECURITY_INTERNAL_BYPASS",
}

/**
 * Extracts required capabilities for a single intent.
 * @param intent The intent contract to inspect.
 * @returns Required capabilities for this intent.
 */
export function getRequiredCapabilitiesForIntent(intent: IntentContract): CapabilityKey[] {
  const out: CapabilityKey[] = [];

  if (!intent) return out;

  if (intent.canaryPrompt || (typeof intent.canaryPromptWeight === "number" && intent.canaryPromptWeight > 0)) {
    out.push(CapabilityKey.AI_PROMPTS_CANARY);
  }

  if (intent.executionPolicy && intent.executionPolicy.type !== ExecutionPolicyType.WEIGHTED) {
    out.push(CapabilityKey.AI_INTENTS_ADVANCED_EXECUTION_POLICY);
  }

  if (intent.executionPolicy && intent.executionPolicy.exploration) {
    out.push(CapabilityKey.AI_INTENTS_EXPLORATION_POLICY);
  }

  const implementations = Array.isArray(intent.implementations) ? intent.implementations : [];
  for (const impl of implementations) {
    if (!impl) continue;

    if (typeof impl.cacheTTLSeconds === "number" && impl.cacheTTLSeconds > 0) {
      out.push(CapabilityKey.AI_RUNTIME_CACHE_TTL_CONFIGURABLE);
    }

    if (impl.executionWindow) {
      out.push(CapabilityKey.AI_BASE_MODEL_EXECUTION_WINDOWS_OVERRIDE_PER_IMPLEMENTATION);
    }
  }

  return out;
}

/**
 * Derives the set of required capabilities implied by a registry.
 *
 * Intended usage
 * - Runtime freeware mode: compare with an allowlist and fail loudly when unsupported.
 * - Backend: map subscription/module-features to capabilities and enforce before emitting a registry.
 *
 * @param registry The registry to inspect.
 * @returns Unique capability keys required by the registry.
 */
export function getRequiredCapabilitiesFromRegistry(registry: DcdrRegistry): CapabilityKey[] {
  const unique = new Set<CapabilityKey>();
  const intents = registry && Array.isArray(registry.intents) ? registry.intents : [];

  for (const intent of intents) {
    for (const cap of getRequiredCapabilitiesForIntent(intent)) {
      unique.add(cap);
    }
  }

  return Array.from(unique.values());
}

/**
 * Returns the capabilities that are required but not present in the allowlist.
 * @param required Required capabilities.
 * @param allowed Allowed capabilities.
 * @returns Missing capabilities.
 */
export function getMissingCapabilities(required: CapabilityKey[], allowed: CapabilityKey[]): CapabilityKey[] {
  const allowedSet = new Set<CapabilityKey>(Array.isArray(allowed) ? allowed : []);
  const out: CapabilityKey[] = [];

  for (const cap of Array.isArray(required) ? required : []) {
    if (!allowedSet.has(cap)) out.push(cap);
  }

  return out;
}

/**
 * Asserts that all required capabilities are in the allowlist.
 *
 * Intended usage
 * - Freeware runtime mode: reject registries/configurations that require pro/cloud capabilities.
 *
 * @param required Required capabilities.
 * @param allowed Allowed capabilities.
 * @param context Optional context string included in error messages.
 */
export function assertCapabilitiesAllowed(required: CapabilityKey[], allowed: CapabilityKey[], context?: string): void {
  const missing = getMissingCapabilities(required, allowed);
  if (missing.length === 0) return;

  const ctx = context ? ` (${context})` : "";
  throw new Error(`Unsupported capabilities${ctx}: ${missing.join(", ")}`);
}

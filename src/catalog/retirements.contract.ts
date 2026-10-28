import { IntentProvider } from "../provider.contract";
import type { ProviderModelRetirementRecord } from "../provider.catalog.contract";

/** OpenAI's answer for a retired chat/completions model id that `/v1/models` may still list. */
const OPENAI_DEPRECATED_404_REASON =
  "Retired by OpenAI: calls return 404 model_not_found ('has been deprecated').";
/** OpenAI's answer for a retired id on an endpoint that does not say "deprecated". */
const OPENAI_DOES_NOT_EXIST_REASON =
  "Retired by OpenAI: calls answer that the model does not exist.";
/** Gemini's answer for a retired generateContent model. */
const GEMINI_NO_LONGER_AVAILABLE_REASON =
  "Retired by Google: calls return 404 ('This model ... is no longer available').";
/** Gemini's answer when the exact model id is gone from the API. */
const GEMINI_NOT_FOUND_REASON =
  "Retired by Google: the Gemini API returns 404 NOT_FOUND for the model id.";
/** Anthropic's answer for a model retired on its own API. */
const ANTHROPIC_NOT_FOUND_REASON =
  "Retired by Anthropic on its own API (still served on some partner clouds): calls return 404 not_found_error.";

/**
 * The global retired list (v3.21.0): one shape and one policy for every provider.
 *
 * A record goes here only when a real call to the exact model id answered "not found" /
 * "deprecated". A model that merely left a `/v1/models` listing is E2E scope (a LEGACY override in
 * its provider file), not a retirement. Records are attached to the catalog at load and validated
 * there: an unknown model, a duplicate, a non-ISO date or a public model fails the load. The stage
 * (RETIRING for 30 days from `detectedAt`, then RETIRED) is computed, never written.
 *
 * `detectedAt` is the first date the retirement was measured. Never move it forward on a re-check.
 */
export const PROVIDER_MODEL_RETIREMENTS: ProviderModelRetirementRecord[] = [
  // --- OpenAI: measured 2026-09-06 (deprecation sweep), re-confirmed 2026-10-28 ---
  ...[
    "gpt-5.3-chat-latest",
    "gpt-5.2-chat-latest",
    "gpt-5.2-codex",
    "gpt-5.1-chat-latest",
    "gpt-5.1-codex",
    "gpt-5.1-codex-max",
    "gpt-5.1-codex-mini",
    "gpt-5-chat-latest",
    "gpt-5-codex",
  ].map((modelId) => ({
    provider: IntentProvider.OPEN_AI,
    modelId,
    detectedAt: "2026-09-06",
    reason: OPENAI_DEPRECATED_404_REASON,
  })),

  // --- OpenAI: measured 2026-10-27 (liveness probe of every SUPPORTED model) ---
  ...[
    "gpt-4.1-nano",
    "gpt-4.1-nano-2025-04-14",
    "gpt-4o-2024-05-13",
    "gpt-4-turbo",
    "gpt-4-turbo-2024-04-09",
    "gpt-4",
    "gpt-4-0613",
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-0125",
    "gpt-3.5-turbo-1106",
    "gpt-3.5-turbo-16k",
    "o4-mini",
    "o4-mini-2025-04-16",
    "o3-mini",
    "o3-mini-2025-01-31",
    "o1-pro",
    "o1-pro-2025-03-19",
    "o1",
    "o1-2024-12-17",
  ].map((modelId) => ({
    provider: IntentProvider.OPEN_AI,
    modelId,
    detectedAt: "2026-10-27",
    reason: OPENAI_DEPRECATED_404_REASON,
  })),

  // --- OpenAI: measured 2026-10-28 (re-check of the LEGACY overrides) ---
  // babbage-002 and davinci-002 also answer "deprecated" but have E2E overrides only, no catalog entry.
  ...["gpt-3.5-turbo-instruct", "gpt-3.5-turbo-instruct-0914"].map(
    (modelId) => ({
      provider: IntentProvider.OPEN_AI,
      modelId,
      detectedAt: "2026-10-28",
      reason: OPENAI_DEPRECATED_404_REASON,
    }),
  ),
  ...["dall-e-3", "dall-e-2", "gpt-realtime-mini-2025-10-06"].map((modelId) => ({
    provider: IntentProvider.OPEN_AI,
    modelId,
    detectedAt: "2026-10-28",
    reason: OPENAI_DOES_NOT_EXIST_REASON,
  })),

  // --- Gemini: measured 2026-10-28 (re-check of the LEGACY overrides) ---
  ...["gemini-2.0-flash", "gemini-2.0-flash-001", "gemini-2.0-flash-lite", "gemini-2.0-flash-lite-001", "gemini-3-pro-preview"].map(
    (modelId) => ({
      provider: IntentProvider.GEMINI,
      modelId,
      detectedAt: "2026-10-28",
      reason: GEMINI_NO_LONGER_AVAILABLE_REASON,
    }),
  ),
  ...["gemini-robotics-er-1.6-preview", "gemini-robotics-er-1.5-preview"].map((modelId) => ({
    provider: IntentProvider.GEMINI,
    modelId,
    detectedAt: "2026-10-28",
    reason: GEMINI_NOT_FOUND_REASON,
  })),

  // --- Anthropic: measured 2026-10-27 ---
  {
    provider: IntentProvider.ANTHROPIC,
    modelId: "claude-opus-4-1-20250805",
    detectedAt: "2026-10-27",
    reason: ANTHROPIC_NOT_FOUND_REASON,
  },
];

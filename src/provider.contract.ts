import { ImplementationContract } from "./implementations.contract";
import { Message } from "./messages.contract";
import { ExecutionInputPart } from "./execution.contract";
import { Intent, IntentContract } from "./intent.contract";
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
  /**
   * Virtual provider managed by DCDR.
   *
   * Notes
   * - Cloud-only concept: the registry/runtime can resolve the underlying real provider (OpenAI/Anthropic/Gemini/Grok/Mistral/Office).
   * - Model IDs are namespaced as `provider/model` (e.g. `openai/gpt-4o-mini`) for deterministic resolution.
   */
  DCDR = "DCDR",

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
   * Local inference runtime hosted internally (runtime-managed).
   *
   * Notes
   * - Use this when the runtime/operator controls the endpoint (e.g. office GPU cluster running vLLM).
   * - If a customer wants to plug in their own OpenAI-compatible endpoint, use OPEN_AI_COMPATIBLE.
   */
  OFFICE = "OFFICE",

  /**
   * Ollama local inference runtime.
   * Useful for developer setups and local deployments.
   */
  OLLAMA = "OLLAMA",

  /**
   * Generic OpenAI-compatible endpoint (bring-your-own).
   *
   * Goal
   * - Allow customers to plug in internal systems that expose an OpenAI-style API.
   *
   * Examples
   * - vLLM, TGI, LM Studio, or custom gateways that mimic the OpenAI schema.
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
  inputParts?: ExecutionInputPart[];

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

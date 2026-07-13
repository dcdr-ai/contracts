import { ImplementationContract } from "./implementations.contract";
import { RetryPolicy, PromptParameters, ExecutionPolicy } from "./policies.contract";
import { PromptTemplate, PromptVariable } from "./prompts.contract";
import { ProcessingProcessor } from "./processing.contract";



export type Intent = string;


/**
 * Supported intent execution types.
 *
 * This defines the type of task the intent performs and which
 * provider capabilities are required.
 */
export enum IntentType {

  /**
   * Standard conversational or prompt-response interaction.
   *
   * Examples:
   * - Q&A
   * - summarization
   * - reasoning
   * - structured output generation
   */
  CHAT = "CHAT",

  /**
   * Text embedding generation.
   *
   * Examples:
   * - semantic search
   * - vector indexing
   * - similarity comparison
   */
  EMBEDDING = "EMBEDDING",

  /**
   * Image generation.
   *
   * Examples:
   * - DALL·E
   * - diffusion models
   */
  IMAGE_GENERATION = "IMAGE_GENERATION",

  /**
   * Video generation.
   *
   * Examples:
   * - text-to-video models
   * - image-to-video models
   */
  VIDEO_GENERATION = "VIDEO_GENERATION",

  /**
   * Image understanding / multimodal analysis.
   *
   * Examples:
   * - vision LLMs
   * - OCR-assisted models
   */
  IMAGE_ANALYSIS = "IMAGE_ANALYSIS",

  /**
   * Audio transcription.
   *
   * Examples:
   * - Whisper
   * - speech-to-text models
   */
  SPEECH_TO_TEXT = "SPEECH_TO_TEXT",

  /**
   * Audio generation / text-to-speech.
   */
  TEXT_TO_SPEECH = "TEXT_TO_SPEECH",

  /**
   * Multimodal tasks combining text + images + audio.
   */
  MULTIMODAL = "MULTIMODAL",

  /**
   * Deterministic tool execution.
   *
   * Examples:
   * - HTTP calls
   * - scripts
   * - external API connectors
   */
  TOOL = "TOOL",

  /**
   * Internal deterministic rule engine.
   */
  RULE_ENGINE = "RULE_ENGINE",
}



/**
 * A single intent contract.
 * This is what the gateway uses to execute requests in a provider-agnostic way.
 */
export interface IntentContract {

  id: string; // Unique intent ID (stable, e.g., UUID)

  /** Semantic intent (e.g., "name_processor", "format_parser"). */
  intent: Intent;

  /** Intent execution type */
  type: IntentType;

  /** Optional human-friendly name for diagnostics/UI (can equal intent). */
  name?: string;

  /** Global enable/disable for this intent. */
  active: boolean;

  /** Human readable description for diagnostics. */
  description?: string;

  /**
   * Input schema (JSON Schema or custom prompt schema).
   * The gateway may validate input before running providers.
   */
  inputSchema?: Record<string, PromptVariable>;

  /**
   * Output schema (JSON Schema or custom prompt schema).
   * The gateway may validate output and trigger repair/fallback when it fails.
   */
  outputSchema?: Record<string, PromptVariable>;

  /**
   * Active prompt template for this intent.
   * Versioned + hashed for reproducibility.
   */
  defaultPrompt: PromptTemplate;

  /**
   * Optional alternate prompt template for canary/A/B testing.
   */
  canaryPrompt?: PromptTemplate;

  /**
   * Weight for selecting the canary prompt (e.g., 0.1 for 10% traffic).
   * The gateway should use this to randomly route requests to the canary prompt.
   */
  canaryPromptWeight?: number;

  /**
   * Execution policy for selecting and prioritizing implementations.
   */
  executionPolicy?: ExecutionPolicy;

  /**
   * Retry/fallback policy for this intent.
   * This should be centrally configured from your backend UI.
   */
  retryPolicy: RetryPolicy;

  /**
   * Optional governed processing processors executed around the intent runtime pipeline.
   *
   * Notes
   * - `INPUT` processors run before prompt rendering / provider execution.
   * - `OUTPUT` processors run after provider execution and before the final caller-visible result is finalized.
   * - Each processor is a versioned ordered sequence of atomic rules.
   * - This applies to intent execution only, not the OpenAI-compatible `/v1` gateway proxy.
   */
  processors?: ProcessingProcessor[];

  /**
   * Implementations available for this intent.
   * The gateway selects candidates based on the execution policy first,
   * then applies retry/fallback logic if needed.
   */
  implementations: ImplementationContract[];

  /**
   * Optional tags for future filtering (e.g., sector, "strict_json", etc.).
   */
  tags?: string[];
}

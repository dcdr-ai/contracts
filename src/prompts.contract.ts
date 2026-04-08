import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { Message } from "./messages.contract";
import { PromptParameters } from "./policies.contract";



export enum PromptTemplateInterpolationType {

    /** {{var}} — Mustache style (RECOMMENDED) */
    MUSTACHE = "MUSTACHE",

    /** ${var} — JavaScript template literal style */
    JS_TEMPLATE = "JS_TEMPLATE",

    /** #var# — Simple legacy style */
    HASH = "HASH",

    /** <<var>> — XML / chatbot legacy style */
    ANGLE = "ANGLE",
}


export enum PromptVariableType {
    INTEGER = "integer",
    FLOAT = "float",
    STRING = "string",
    BOOLEAN = "boolean",
    JSON = "json",
    ANY = "any",
    ARRAY = "array",
    OBJECT = "object",
    ENUM = "enum", // ✅ NEW
}




export class PromptVariable {

    type: PromptVariableType;

    @IsBoolean()
    @IsOptional()
    required?: boolean;

    @IsOptional()
    description?: string;

    @IsOptional()
    itemsType?: PromptVariableType;

    @IsOptional()
    properties?: Record<string, PromptVariable>; // NEW

    // Enum values (only meaningful when type === "enum")
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    values?: string[];

    /**
     * Optional constraints:
     * - For integer/float: min/max numeric value
     * - For string: min/max length
     */
    @IsOptional()
    @IsNumber()
    min?: number;

    @IsOptional()
    @IsNumber()
    max?: number;

    constructor(
        type: PromptVariableType,
        required: boolean = false,
        description?: string,
        itemsType?: PromptVariableType,
        properties?: Record<string, PromptVariable>,
        values?: string[], // NEW
        min?: number,
        max?: number,
    ) {
        this.type = type;
        this.required = required;
        this.description = description;
        this.itemsType = itemsType;
        this.properties = properties;
        this.values = values;
        this.min = min;
        this.max = max;
    }
}


// If you don't want an import cycle, move the enum to a dedicated "interpolation.contract.ts".

/**
 * A versioned prompt template.
 * This should be stable and reproducible:
 * - `id`, `version`, and `sha256` MUST uniquely identify the prompt content.
 * - `semanticHash` MUST represent the semantic meaning (stable normalization).
 * - `messages` is the canonical representation (avoid raw string prompts).
 */
export interface PromptTemplate {

    /** Unique prompt identifier (e.g., UUID). */
    id: string;

    /** Human-friendly version label (e.g., "2026-02-17.1" or "v20260217.3"). */
    version: string;

    /** Human-readable name (e.g., "openai-format-parser"). */
    name: string;

    /** Human-readable description for diagnostics. */
    description?: string;

    /**
     * SHA256 hash of the canonical prompt payload (e.g., stable JSON serialization).
     * Useful as an immutable fingerprint / audit trail.
     */
    sha256: string;

    /**
     * Precomputed semantic hash (stable across irrelevant formatting changes).
     * This MUST be exported from backend and used for:
     * - problemHash (dataset dedupe)
     * - runHash (execution dedupe)
     */
    semanticHash: string;

    /**
     * Provider-agnostic prompt messages (with optional placeholders).
     * This is the canonical representation.
     */
    messages: Message[];

    /**
     * Declared variables contract (not values).
     * Used for validation / preflight checks, not interpolation.
     */
    //variables?: Record<string, { required?: boolean; description?: string }>;

    /**
     * Interpolation style to render placeholders in messages.
     * Default MUST be MUSTACHE.
     */
    variablesInterpolationType?: PromptTemplateInterpolationType;

    /**
   * Default runtime params (temperature, max_tokens, etc.).
   * Can be overridden per request.
   *
   * NOTE:
   * - AISemantics.buildRuntimeParamsKey can include these as another layer if you want:
   *   impl.runtimeConfig -> prompt.params -> model.params -> request.override
   */
    params?: PromptParameters;

    /** Optional tags for routing/diagnostics (e.g., "strict_json", "qc", "beta"). */
    tags?: string[];

    /** Optional metadata for audits/diagnostics. */
    meta?: Record<string, any>;
}
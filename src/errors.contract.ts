/**
 * Error info for a single attempt or final result.
 * Keep codes stable because your backend may do analytics on them.
 */
export enum ExecutionErrorCode {
  BAD_REQUEST = "BAD_REQUEST",
  TOKEN_BUDGET_TOO_LOW = "TOKEN_BUDGET_TOO_LOW",
  INVALID_INPUT = "INVALID_INPUT",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNSUPPORTED_OPERATION = "UNSUPPORTED_OPERATION",
  MISSING_VARIABLE = "MISSING_VARIABLE",
  CONFIG_ERROR = "CONFIG_ERROR",
  RULES_ERROR = "RULES_ERROR",
  INVALID_OPERATION = "INVALID_OPERATION",
  MODEL_NOT_FOUND = "MODEL_NOT_FOUND",
  MODEL_UNSUPPORTED = "MODEL_UNSUPPORTED",
  PAYMENT_REQUIRED = "PAYMENT_REQUIRED",
  PROVIDER_LIMIT_EXCEEDED = "PROVIDER_LIMIT_EXCEEDED",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  NO_CONFIG = "NO_CONFIG",
  NO_ACTIVE_MODEL = "NO_ACTIVE_MODEL",
  NO_ELIGIBLE_IMPLEMENTATION = "NO_ELIGIBLE_IMPLEMENTATION",
  PROVIDER_ERROR = "PROVIDER_ERROR",
  PROVIDER_EMPTY_RESPONSE = "PROVIDER_EMPTY_RESPONSE",
  TIMEOUT = "TIMEOUT",
  RATE_LIMIT = "RATE_LIMIT",
  UPSTREAM_5XX = "UPSTREAM_5XX",
  NETWORK = "NETWORK",
  PARSE_FAIL = "PARSE_FAIL",
  SCHEMA_FAIL = "SCHEMA_FAIL",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  CIRCUIT_OPEN = "CIRCUIT_OPEN",
}

export interface ExecutionError {
  /**
   * Stable, analytics-friendly code.
   */
  code: ExecutionErrorCode;
  message: string;
  providerStatus?: number;
  details?: any;
}

/**
 * Runtime guard for checking whether a string is a known execution error code.
 */
export function isExecutionErrorCode(code: string): code is ExecutionErrorCode {
  // Object.values on string enums returns the string values.
  return (Object.values(ExecutionErrorCode) as string[]).includes(code);
}

/**
 * Whether a thrown value is an `ExecutionError`.
 *
 * Shape, not `instanceof`, and deliberately: `createExecutionError` returns a plain object because
 * `ExecutionError` is a **wire** type as much as a thrown one - it is serialised into responses and
 * reports, and `Error.message` is non-enumerable, so a class would make `JSON.stringify` of one
 * produce `{}`. Callers also build these as literals without going through the factory. Checking the
 * shape is the only test that holds for all of those.
 *
 * @param value Thrown value.
 * @returns Whether it carries an execution error's shape.
 */
export function isExecutionError(value: unknown): value is ExecutionError {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { code?: unknown; message?: unknown };
  return typeof candidate.message === "string" && typeof candidate.code === "string" && isExecutionErrorCode(candidate.code);
}

/**
 * The message to show for anything that was thrown.
 *
 * Exists because the obvious line - `error instanceof Error ? error.message : String(error)` - is
 * wrong for exactly the errors this runtime raises on purpose. An `ExecutionError` is a plain
 * object, so it falls to `String(error)` and every API response carrying one said
 * **`"[object Object]"`**: the code was right, the message was gone, and a caller debugging a failed
 * upload learned nothing. It was in ten places across four routers.
 *
 * @param error Thrown value.
 * @returns A message worth putting in a response.
 */
export function toErrorMessage(error: unknown): string {
  if (isExecutionError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  // Last resort, and still better than `[object Object]`: something structured says more than
  // nothing, even when nobody planned for this shape.
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Circular, or a getter that threw. Falls through to the description below, which is the case
    // `String(error)` answers with `[object Object]` - the exact uselessness this function exists
    // to remove, so it must not be the fallback of the fallback.
  }
  if (error && typeof error === "object") {
    const name = error.constructor?.name || "Object";
    const keys = Object.keys(error);
    return keys.length ? `${name} { ${keys.join(", ")} }` : name;
  }
  return String(error);
}

export function createExecutionError(
  code: ExecutionErrorCode,
  message: string,
  details?: any,
  providerStatus?: number,
): ExecutionError {
  return { code, message, details, providerStatus };
}

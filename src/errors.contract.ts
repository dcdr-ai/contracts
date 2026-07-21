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

export function createExecutionError(
  code: ExecutionErrorCode,
  message: string,
  details?: any,
  providerStatus?: number,
): ExecutionError {
  return { code, message, details, providerStatus };
}

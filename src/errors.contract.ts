/**
 * Error info for a single attempt or final result.
 * Keep codes stable because your backend may do analytics on them.
 */
export interface ExecutionError {
  code:
    | "BAD_REQUEST"
    | "INVALID_INPUT"
    | "VALIDATION_ERROR"
    | "UNSUPPORTED_OPERATION"
    | "MISSING_VARIABLE"
    | "CONFIG_ERROR"
    | "RULES_ERROR"
    | "INVALID_OPERATION"
    | "MODEL_NOT_FOUND"
    | "MODEL_UNSUPPORTED"
    | "PAYMENT_REQUIRED"
    | "INVALID_CREDENTIALS"
    | "NO_CONFIG"
    | "NO_ACTIVE_MODEL"
    | "NO_ELIGIBLE_IMPLEMENTATION"
    | "PROVIDER_ERROR"
    | "PROVIDER_EMPTY_RESPONSE"
    | "TIMEOUT"
    | "RATE_LIMIT"
    | "UPSTREAM_5XX"
    | "NETWORK"
    | "PARSE_FAIL"
    | "SCHEMA_FAIL"
    | "INTERNAL_ERROR"
    | "CIRCUIT_OPEN";
  message: string;
  providerStatus?: number;
  details?: any;
}

export function createExecutionError(
  code: ExecutionError["code"],
  message: string,
  details?: any,
  providerStatus?: number,
): ExecutionError {
  return { code, message, details, providerStatus };
}

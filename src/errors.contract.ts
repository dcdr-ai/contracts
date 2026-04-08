


/**
 * Error info for a single attempt or final result.
 * Keep codes stable because your backend may do analytics on them.
 */
export interface ExecutionError {
  code:
    | "BAD_REQUEST"
    | "NO_CONFIG"
    | "NO_ACTIVE_MODEL"
    | "NO_ELIGIBLE_IMPLEMENTATION"
    | "PROVIDER_ERROR"
    | "TIMEOUT"
    | "RATE_LIMIT"
    | "UPSTREAM_5XX"
    | "NETWORK"
    | "PARSE_FAIL"
    | "SCHEMA_FAIL"    
    | "INTERNAL_ERROR"
    | "CIRCUIT_OPEN"
    ;
  message: string;
  providerStatus?: number;
  details?: any;
}


export function createExecutionError(code: ExecutionError["code"], message: string, details?: any, providerStatus?: number): ExecutionError {
  return { code, message, details, providerStatus };
}
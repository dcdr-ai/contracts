# Execution error codes

The runtime uses stable, analytics-friendly error codes exposed as `ExecutionErrorCode` in `@dcdr/contracts`.

Where you see them:

- `ExecuteIntentResponse.error.code`
- `ExecutionAttemptReport.error.code`

## Guidance

- Treat codes as stable identifiers (good for metrics, alerting, and client logic).
- Use `ExecutionErrorCode` in TypeScript instead of string literals.
- `message` is intended for humans; do not parse it.

## Code reference

| Code                         | Meaning / scenario                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `BAD_REQUEST`                | Missing/invalid required input at the API boundary.                                                     |
| `TOKEN_BUDGET_TOO_LOW`       | Output budget too small to produce visible output (common with high-reasoning models).                  |
| `INVALID_INPUT`              | Input is syntactically valid but semantically unusable for execution (e.g. empty prompt after mapping). |
| `VALIDATION_ERROR`           | Contract/schema validation failed for request or derived config.                                        |
| `UNSUPPORTED_OPERATION`      | The request asks for a feature/operation the runtime does not support.                                  |
| `MISSING_VARIABLE`           | A required prompt variable is missing.                                                                  |
| `CONFIG_ERROR`               | Registry/runtime configuration is invalid or inconsistent for the requested execution.                  |
| `RULES_ERROR`                | Rules engine refused execution (intent/rules path).                                                     |
| `INVALID_OPERATION`          | Operation is not valid in the current mode/state (e.g. cloud-only behavior in runtime mode).            |
| `MODEL_NOT_FOUND`            | Model ID is unknown/not enabled/not present in the runtime catalog.                                     |
| `MODEL_UNSUPPORTED`          | Model exists but does not support the requested intent/endpoint/features.                               |
| `PAYMENT_REQUIRED`           | Feature is gated by plan/tier/entitlements (e.g. paid virtual provider disabled).                       |
| `INVALID_CREDENTIALS`        | Provider rejected credentials (typically 401/403 upstream).                                             |
| `NO_CONFIG`                  | Missing required configuration (e.g. missing provider API key).                                         |
| `NO_ACTIVE_MODEL`            | No active model configured for the requested intent.                                                    |
| `NO_ELIGIBLE_IMPLEMENTATION` | Implementations exist but none are eligible after filters/windows/deny rules.                           |
| `PROVIDER_ERROR`             | Upstream provider rejected the request (4xx/other non-success that is not more specific).               |
| `PROVIDER_EMPTY_RESPONSE`    | Provider returned a successful response but with no usable output.                                      |
| `TIMEOUT`                    | Execution exceeded a timeout or was aborted/cancelled.                                                  |
| `RATE_LIMIT`                 | Provider rate-limited the request (typically 429).                                                      |
| `UPSTREAM_5XX`               | Provider/server returned 5xx (transient upstream failure).                                              |
| `NETWORK`                    | Network/DNS/TCP connection failure talking to provider.                                                 |
| `PARSE_FAIL`                 | Output could not be parsed into the expected structured format (usually JSON).                          |
| `SCHEMA_FAIL`                | Output parsed but did not match the expected schema.                                                    |
| `INTERNAL_ERROR`             | Unexpected runtime failure (bug/exception).                                                             |
| `CIRCUIT_OPEN`               | Execution blocked by circuit breaker protection.                                                        |

## Runtime guard

If you accept arbitrary strings (e.g. from logs/telemetry), you can validate them:

- `isExecutionErrorCode(value)`

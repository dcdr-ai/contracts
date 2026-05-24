import { IntentProvider } from "./provider.contract";
import { HttpRequestParams } from "./http.contract";

/**
 * How a credential is resolved into concrete HTTP request parameters.
 *
 * Security model
 * - `INLINE`: Secrets (headers/query/cookies) are carried inside the registry.
 * - `BACKEND`: Registry carries only a reference; runtime resolves secrets from backend at execution time.
 */
export enum CredentialsResolutionMode {
  INLINE = "INLINE",
  BACKEND = "BACKEND",
}

/**
 * Represents credentials used to authenticate provider requests.
 * Implementations reference credentials via credentialRef.
 */
export interface CredentialsContract {
  id: string;
  name: string;
  description?: string;

  /**
   * Resolution strategy.
   * - Omitted defaults to `INLINE` for backward compatibility.
   */
  resolution?: CredentialsResolutionMode;

  /**
   * Optional provider hint for UI, filtering or validation.
   * Credentials remain provider-agnostic at runtime.
   */
  provider?: IntentProvider;

  /** HTTP headers/query injected into provider requests */
  readonly headers?: HttpRequestParams["headers"];
  readonly query?: HttpRequestParams["query"];
  readonly cookies?: HttpRequestParams["cookies"];
}

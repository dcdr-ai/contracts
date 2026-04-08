import { IntentProvider } from "./provider.contract";
import { HttpRequestParams } from "./http.contract";

/**
 * Represents credentials used to authenticate provider requests.
 * Implementations reference credentials via credentialRef.
 */
export interface CredentialsContract {
  id: string;
  name: string;
  description?: string;

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

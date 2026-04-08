/**
 * Canonical HTTP params shape used by runtime for request customization.
 *
 * IMPORTANT:
 * - No multi-value headers yet. Duplicates should be resolved by the runtime merge rules.
 */

export interface NameValuePair {
  name: string;
  value: string;
}

export interface HttpRequestParams {
  headers?: NameValuePair[];
  query?: NameValuePair[];

  /**
   * Convenience field to build the outgoing request Cookie header.
   * Runtime will serialize these pairs into a single `Cookie` header.
   */
  cookies?: NameValuePair[];
}

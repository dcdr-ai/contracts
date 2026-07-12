/**
 * Snapshot of allowed (and revoked) customer service tokens.
 *
 * IMPORTANT:
 * - Never include tokens in clear.
 * - Tokens are referenced by sha256(utf8(tokenString)) in hex.
 * - Backend should keep this snapshot stable & ordered for reproducible ETags.
 */
import { IntentProvider } from "./provider.contract";

export type DcdrServiceTokenStatus = "ACTIVE" | "REVOKED";

/**
 * Stable well-known scopes that can be attached to DCDR service tokens.
 *
 * Notes
 * - `scopes` remains an open `string[]` surface for backward compatibility.
 * - This enum only publishes shared canonical values that runtime/backend/UI
 *   may want to reference consistently.
 */
export enum DcdrServiceTokenScope {
  GATEWAY = "gateway",
}

export enum DcdrServiceTokenLimitType {
  FIXED = "FIXED",
  LIMITED_BY_HOUR = "LIMITED_BY_HOUR",
  LIMITED_BY_DAY = "LIMITED_BY_DAY",
  LIMITED_BY_MONTH = "LIMITED_BY_MONTH",
}

/**
 * Gateway binding for one provider.
 *
 * Notes
 * - `credentialRef` uses the same reference concept already used elsewhere in
 *   DCDR contracts.
 * - Runtime/backend should treat `provider` as unique within one token's
 *   `gatewayBindings` array.
 */
export interface DcdrServiceTokenGatewayProviderBinding {
  provider: IntentProvider;
  credentialRef: string;
}

export interface DcdrServiceTokenLimit {
  /**
   * Maximum number of execution endpoint calls allowed for this limit window.
   */
  maxCalls: number;

  /**
   * Limit window type.
   */
  type: DcdrServiceTokenLimitType;

  /**
   * Optional execution intent scopes for this limit. Defaults to `*` when omitted.
   */
  scopes?: string[];
}

export type DcdrServiceTokenSnapshotItem = {
  /** Human-friendly identifier ("ci-pipeline", "mobile-app", etc.). */
  id: string;

  /** SHA-256 hash of the full bearer token string (hex). */
  sha256: string;

  status: DcdrServiceTokenStatus;

  /** Token scopes as understood by the gateway (should match or superset payload.scopes policy). */
  scopes: string[];

  /** Optional snapshot-side expiry hint (unix ms). Token exp enforcement remains the token payload exp. */
  exp?: number;

  /** Optional runtime-enforced execution limits for this token. */
  limits?: DcdrServiceTokenLimit[];

  /**
   * Optional OpenAI-compatible gateway bindings.
   *
   * Intended use
   * - A token with `gateway` scope can be constrained to exactly one backend-
   *   managed credential reference per provider.
   * - Runtime should resolve the selected credential by reference via backend
   *   before making the upstream provider call.
   */
  gatewayBindings?: DcdrServiceTokenGatewayProviderBinding[];

  /** Optional note for operators. */
  note?: string;
};

export type DcdrServiceTokensSnapshotContract = {
  cid: string;
  tokens: DcdrServiceTokenSnapshotItem[];
  /** Snapshot issued at (unix ms). Optional. */
  iat?: number;
};

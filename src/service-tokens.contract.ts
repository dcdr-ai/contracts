/**
 * Snapshot of allowed (and revoked) customer service tokens.
 *
 * IMPORTANT:
 * - Never include tokens in clear.
 * - Tokens are referenced by sha256(utf8(tokenString)) in hex.
 * - Backend should keep this snapshot stable & ordered for reproducible ETags.
 */

export type DcdrServiceTokenStatus = "ACTIVE" | "REVOKED";

export enum DcdrServiceTokenLimitType {
  FIXED = "FIXED",
  LIMITED_BY_HOUR = "LIMITED_BY_HOUR",
  LIMITED_BY_DAY = "LIMITED_BY_DAY",
  LIMITED_BY_MONTH = "LIMITED_BY_MONTH",
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

  /** Optional note for operators. */
  note?: string;
};

export type DcdrServiceTokensSnapshotContract = {
  cid: string;
  tokens: DcdrServiceTokenSnapshotItem[];
  /** Snapshot issued at (unix ms). Optional. */
  iat?: number;
};

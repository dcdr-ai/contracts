/**
 * Snapshot of allowed (and revoked) customer service tokens.
 *
 * IMPORTANT:
 * - Never include tokens in clear.
 * - Tokens are referenced by sha256(utf8(tokenString)) in hex.
 * - Backend should keep this snapshot stable & ordered for reproducible ETags.
 */
import { DcdrAssetScope } from "./asset.contract";
import { IntentProvider } from "./provider.contract";
import { DcdrProviderLimitsConfig } from "./provider-limits.contract";

export type DcdrServiceTokenStatus = "ACTIVE" | "REVOKED";

/**
 * Every scope that can be attached to a DCDR service token.
 *
 * This is the **whole vocabulary**, published so nobody writes one of these strings by hand again.
 * Until 3.9.0 this enum carried only `GATEWAY` while the real list lived in the backend, so the
 * vocabulary existed in two places and nothing compared them - and a scope is a string that either
 * matches exactly or silently grants nothing.
 *
 * Notes
 * - `scopes` stays an open `string[]` on the wire, so a token may carry a value this enum does not
 *   know yet. That is deliberate: it is what lets an older runtime keep working against a newer
 *   backend.
 * - The asset members reuse {@link DcdrAssetScope}, which owns those three strings.
 * - `FULL_ACCESS` (`*`) satisfies every check. Nothing else is implied by any member: scopes are
 *   compared exactly, never by prefix.
 */
export enum DcdrServiceTokenScope {
  /** Read the tenant registry snapshot. */
  REGISTRY_READ = "registry:read",
  /** Read the tenant entitlements snapshot. */
  ENTITLEMENTS_READ = "entitlements:read",
  /** Write execution logs back to the control plane. */
  LOGS_WRITE = "logs:write",
  /** Read a managed asset (`GET /api/assets`). */
  ASSETS_READ = DcdrAssetScope.READ,
  /** Create a managed asset (`POST /api/assets/upload`). */
  ASSETS_WRITE = DcdrAssetScope.WRITE,
  /** Delete a managed asset (`DELETE /api/assets`). */
  ASSETS_DELETE = DcdrAssetScope.DELETE,
  /** Execute any intent. A token may instead carry individual intent names as its scopes. */
  EXECUTE_ALL = "execute:*",
  /** Use the OpenAI-compatible governance proxy. */
  GATEWAY = "gateway",
  /** Read the tenant workflow API: the catalogue, runs, steps, evidence, reports, parked tasks. */
  WORKFLOWS_READ = "workflows:read",
  /** Run workflows and act on their runs (cancel, resume). */
  WORKFLOWS_RUN = "workflows:run",
  /**
   * Author workflows through the API.
   *
   * **Reserved: no endpoint serves it yet.** It is published now because a scope that appears later
   * under a different name is a scope every stored token has to be re-issued for. It is separate
   * from {@link WORKFLOWS_RUN} because a definition names intents, connections, allowed hosts and
   * allowed shell commands: writing one reaches everything the tenant's connections reach, while
   * running one is bounded by what a person published.
   */
  WORKFLOWS_WRITE = "workflows:write",
  /** Everything. */
  FULL_ACCESS = "*",
}

/**
 * Whether a scope list satisfies a required scope.
 *
 * The one place this comparison belongs, so `*` is honoured identically everywhere and nobody
 * reimplements it as a `startsWith` - which would make `workflows:read` grant `workflows:write`.
 *
 * @param scopes Scopes carried by the token.
 * @param required Scope the operation needs.
 * @returns `true` when the token carries that scope, or `*`.
 */
export function hasDcdrServiceTokenScope(scopes: readonly string[] | undefined | null, required: DcdrServiceTokenScope | string): boolean {
  if (!Array.isArray(scopes) || !scopes.length) return false;
  return scopes.includes(DcdrServiceTokenScope.FULL_ACCESS) || scopes.includes(String(required));
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

/**
 * Backend response for a gateway service-token validity check.
 */
export interface DcdrGatewayTokenCheckResponse {
  valid: boolean;
  cid?: string;
  tokenId?: string;
  scopes?: string[];
  gatewayBindings?: DcdrServiceTokenGatewayProviderBinding[];
  providerLimits?: DcdrProviderLimitsConfig;
  token?: {
    id?: string;
    scopes?: string[];
    gatewayBindings?: DcdrServiceTokenGatewayProviderBinding[];
    providerLimits?: DcdrProviderLimitsConfig;
  };
}

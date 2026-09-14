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

/**
 * Legacy execution-call limit.
 *
 * @deprecated Since 3.14.0 a token carries `rules` (`DcdrServiceTokenLimitRule[]`). When `rules` is
 * present - even empty - `limits` is ignored. Legacy entries mean exactly what
 * `translateLegacyServiceTokenLimits` returns: `CALLS` rules on the `INTENT` surface.
 */
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

/**
 * Who a token belongs to. A personal token is a `TEAM` of one; membership stays in the control plane.
 */
export enum DcdrServiceTokenKind {
  SERVICE = "SERVICE",
  TEAM = "TEAM",
}

/** What a limit rule measures. */
export enum DcdrServiceTokenLimitMetric {
  /** Calls: consume-then-compare at the point the rule counts (see `isDcdrServiceTokenLimitRuleDispatchCounted`). */
  CALLS = "CALLS",
  /** Spend in the tenant wallet currency, enforced against the control plane's baseline only. */
  BUDGET = "BUDGET",
}

/** The window a limit rule's bucket spans. Calendar windows are UTC. */
export enum DcdrServiceTokenLimitWindow {
  HOUR = "HOUR",
  DAY = "DAY",
  /** ISO-8601 week: Monday 00:00 UTC, week-year of the week's Thursday, key `YYYY-Www`. */
  WEEK = "WEEK",
  MONTH = "MONTH",
  /**
   * The signed session token's lifetime. Only on rules translated from legacy `limits`, and only on
   * the `INTENT` surface - the gateway has no session token to bind it to.
   */
  FIXED = "FIXED",
}

/** The two surfaces a token reaches. */
export enum DcdrServiceTokenLimitSurface {
  /** `/api/execution/*`: intent execution. */
  INTENT = "INTENT",
  /** `/v1/*`: the governance gateway. */
  GATEWAY = "GATEWAY",
}

/** One provider model, as the effective (DCDR-virtual unwrapped) provider and model id. */
export interface DcdrServiceTokenLimitRuleModelRef {
  provider: IntentProvider;
  modelId: string;
}

/**
 * Which traffic a rule applies to. Every dimension given must match (AND); an absent or empty
 * dimension matches everything.
 *
 * Notes
 * - `intents` never matches gateway traffic, so `surfaces: ["GATEWAY"]` together with `intents`
 *   matches nothing; editors should refuse that combination.
 * - Naming `providers` or `models` makes a `CALLS` rule count upstream dispatches instead of requests.
 */
export interface DcdrServiceTokenLimitRuleScope {
  surfaces?: DcdrServiceTokenLimitSurface[];
  intents?: string[];
  providers?: IntentProvider[];
  models?: DcdrServiceTokenLimitRuleModelRef[];
}

/** The control plane's count for a rule's current window, carried on the rule itself. */
export interface DcdrServiceTokenLimitRuleUsage {
  /** The window's key (`dcdrServiceTokenLimitPeriodKey`); a baseline for another window is ignored. */
  periodKey: string;
  /** Calls, or spend in the wallet currency, already consumed in that window. */
  consumed: number;
}

/**
 * One limit on a token. All rules on a token apply together: a request proceeds only if every rule
 * whose scope matches it still has room.
 *
 * Counting
 * - `CALLS` with a scope naming `providers` or `models` counts **dispatches**: each upstream call to a
 *   matching provider/model, consumed right before the call (after a cache miss), fallbacks and retries
 *   included. Any other `CALLS` rule counts **requests**, consumed at admission, cache hits included.
 * - `BUDGET` consumes nothing locally: it compares `usage.consumed` against `max`, and a rule with no
 *   baseline for the current window is not enforced.
 * - A request refused by any rule gives back every unit the other rules took for it.
 */
export interface DcdrServiceTokenLimitRule {
  metric: DcdrServiceTokenLimitMetric;
  window: DcdrServiceTokenLimitWindow;
  /** Calls, or budget in the tenant wallet currency. A non-positive or non-finite value disables the rule. */
  max: number;
  scope?: DcdrServiceTokenLimitRuleScope;
  usage?: DcdrServiceTokenLimitRuleUsage;
}

/**
 * Whether a rule counts upstream dispatches rather than requests: its scope names providers or models.
 *
 * @param rule The rule.
 * @returns True for a dispatch-counted rule.
 */
export function isDcdrServiceTokenLimitRuleDispatchCounted(rule: Pick<DcdrServiceTokenLimitRule, "scope">): boolean {
  return Boolean(rule.scope?.providers?.length || rule.scope?.models?.length);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * The ISO-8601 week of a UTC instant.
 *
 * @param nowMs Unix ms.
 * @returns The week-year (the year of that week's Thursday) and the week number (1-53).
 */
export function dcdrIsoWeekOf(nowMs: number): { weekYear: number; week: number } {
  const d = new Date(nowMs);
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Monday = 1 ... Sunday = 7; move to the Thursday of this week.
  const isoDay = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
  day.setUTCDate(day.getUTCDate() + 4 - isoDay);
  const weekYear = day.getUTCFullYear();
  const firstDay = Date.UTC(weekYear, 0, 1);
  const week = Math.ceil(((day.getTime() - firstDay) / 86_400_000 + 1) / 7);
  return { weekYear, week };
}

/**
 * The bucket key of a window at an instant - the key `usage.periodKey` must carry.
 *
 * Formats: `HOUR` `YYYY-MM-DD-HH`, `DAY` `YYYY-MM-DD`, `WEEK` `YYYY-Www`, `MONTH` `YYYY-MM`, `FIXED`
 * `fixed`. The hour, day and month formats are the ones Provider Limits baselines already use.
 *
 * @param window Rule window.
 * @param nowMs Unix ms.
 * @returns The period key.
 */
export function dcdrServiceTokenLimitPeriodKey(window: DcdrServiceTokenLimitWindow, nowMs: number): string {
  const d = new Date(nowMs);
  switch (window) {
    case DcdrServiceTokenLimitWindow.HOUR:
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}-${pad2(d.getUTCHours())}`;
    case DcdrServiceTokenLimitWindow.DAY:
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    case DcdrServiceTokenLimitWindow.WEEK: {
      const { weekYear, week } = dcdrIsoWeekOf(nowMs);
      return `${weekYear}-W${pad2(week)}`;
    }
    case DcdrServiceTokenLimitWindow.MONTH:
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
    default:
      return "fixed";
  }
}

/**
 * What legacy `limits` mean as rules: `CALLS` rules on the `INTENT` surface, request-counted, with the
 * legacy intent scopes (`*` or none meaning every intent).
 *
 * @param limits Legacy limits.
 * @returns Equivalent rules; entries with no positive `maxCalls` are dropped.
 */
export function translateLegacyServiceTokenLimits(limits: readonly DcdrServiceTokenLimit[] | undefined | null): DcdrServiceTokenLimitRule[] {
  // `Array.isArray` narrows a readonly array to `any[]`; keep the element type explicit.
  const list: readonly DcdrServiceTokenLimit[] = Array.isArray(limits) ? (limits as readonly DcdrServiceTokenLimit[]) : [];
  const windowByType: Record<DcdrServiceTokenLimitType, DcdrServiceTokenLimitWindow> = {
    [DcdrServiceTokenLimitType.FIXED]: DcdrServiceTokenLimitWindow.FIXED,
    [DcdrServiceTokenLimitType.LIMITED_BY_HOUR]: DcdrServiceTokenLimitWindow.HOUR,
    [DcdrServiceTokenLimitType.LIMITED_BY_DAY]: DcdrServiceTokenLimitWindow.DAY,
    [DcdrServiceTokenLimitType.LIMITED_BY_MONTH]: DcdrServiceTokenLimitWindow.MONTH,
  };
  const out: DcdrServiceTokenLimitRule[] = [];
  for (const limit of list) {
    if (!limit || !Number.isFinite(limit.maxCalls) || limit.maxCalls <= 0) continue;
    const intents = (limit.scopes ?? []).map((scope) => String(scope ?? "").trim()).filter(Boolean);
    const everyIntent = intents.length === 0 || intents.includes("*");
    out.push({
      metric: DcdrServiceTokenLimitMetric.CALLS,
      window: windowByType[limit.type] ?? DcdrServiceTokenLimitWindow.MONTH,
      max: limit.maxCalls,
      scope: everyIntent
        ? { surfaces: [DcdrServiceTokenLimitSurface.INTENT] }
        : { surfaces: [DcdrServiceTokenLimitSurface.INTENT], intents: Array.from(new Set(intents)).sort() },
    });
  }
  return out;
}

/**
 * The rules a token is enforced with: `rules` when present (even empty), otherwise its legacy `limits`
 * translated.
 *
 * @param token Snapshot item or token-check payload.
 * @returns Effective rules.
 */
export function resolveDcdrServiceTokenLimitRules(token: {
  rules?: readonly DcdrServiceTokenLimitRule[] | null;
  limits?: readonly DcdrServiceTokenLimit[] | null;
}): DcdrServiceTokenLimitRule[] {
  if (Array.isArray(token.rules)) return [...(token.rules as readonly DcdrServiceTokenLimitRule[])];
  return translateLegacyServiceTokenLimits(token.limits);
}

export type DcdrServiceTokenSnapshotItem = {
  /**
   * Stable token identifier. A UUID from 3.14.0; earlier control planes used a human-chosen id
   * ("ci-pipeline"). Limit-rule buckets key on it, so it must survive a secret rotation.
   */
  id: string;

  /** Display name, for logs. */
  name?: string;

  /** Who the token belongs to. */
  kind?: DcdrServiceTokenKind;

  /** SHA-256 hash of the full bearer token string (hex). */
  sha256: string;

  status: DcdrServiceTokenStatus;

  /** Token scopes as understood by the gateway (should match or superset payload.scopes policy). */
  scopes: string[];

  /** Optional snapshot-side expiry hint (unix ms). Token exp enforcement remains the token payload exp. */
  exp?: number;

  /**
   * Optional runtime-enforced execution limits for this token.
   *
   * @deprecated Use `rules`; ignored when `rules` is present.
   */
  limits?: DcdrServiceTokenLimit[];

  /** Limit rules, enforced on both surfaces (3.14.0). */
  rules?: DcdrServiceTokenLimitRule[];

  /**
   * Which provider/model pairs this token may use (3.14.0) - an **allowlist, not a limit**. Rules count
   * and cap; they cannot express a ban (a non-positive `max` disables a rule), so access lives here.
   *
   * - absent or `null`: no opinion - every model of the bound providers, as before.
   * - `[]`: nothing is allowed. Control planes should refuse to store it; a runtime reads it that way.
   * - Narrows, never widens: a pair whose provider has no `gatewayBindings` entry stays unreachable on the
   *   gateway, and the tenant's Provider Limits still apply.
   *
   * Pairs are effective provider/model (DCDR-virtual unwrapped). Enforced on `/v1/*` (listing and
   * resolution) and `/api/execution/*` (candidates) by runtimes announcing
   * `CapabilityKey.AI_RUNTIME_SERVICE_TOKEN_ALLOWED_MODELS`.
   */
  allowedModels?: DcdrServiceTokenLimitRuleModelRef[] | null;

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
  /** Display name, for logs (3.14.0). */
  name?: string;
  /** Who the token belongs to (3.14.0). */
  kind?: DcdrServiceTokenKind;
  scopes?: string[];
  gatewayBindings?: DcdrServiceTokenGatewayProviderBinding[];
  providerLimits?: DcdrProviderLimitsConfig;
  /** The token's limit rules with their baselines, as on the snapshot item (3.14.0). */
  rules?: DcdrServiceTokenLimitRule[];
  /** The token's model allowlist, as on the snapshot item (3.14.0). */
  allowedModels?: DcdrServiceTokenLimitRuleModelRef[] | null;
  token?: {
    id?: string;
    name?: string;
    kind?: DcdrServiceTokenKind;
    scopes?: string[];
    gatewayBindings?: DcdrServiceTokenGatewayProviderBinding[];
    providerLimits?: DcdrProviderLimitsConfig;
    rules?: DcdrServiceTokenLimitRule[];
    allowedModels?: DcdrServiceTokenLimitRuleModelRef[] | null;
  };
}

/**
 * Whether a token's `allowedModels` lets it use a provider/model pair.
 *
 * @param allowedModels The token's allowlist: absent/`null` allows everything, `[]` allows nothing.
 * @param provider Effective provider.
 * @param modelId Effective model id.
 * @returns True when the pair is allowed.
 */
export function isDcdrServiceTokenModelAllowed(
  allowedModels: readonly DcdrServiceTokenLimitRuleModelRef[] | null | undefined,
  provider: IntentProvider,
  modelId: string,
): boolean {
  if (allowedModels === null || allowedModels === undefined) return true;
  if (!Array.isArray(allowedModels)) return true;
  return (allowedModels as readonly DcdrServiceTokenLimitRuleModelRef[]).some(
    (entry) => Boolean(entry) && entry.provider === provider && entry.modelId === modelId,
  );
}

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
  /**
   * List and read knowledge collections and their documents (`GET /api/dcdr/knowledge/collections*`).
   *
   * Effective only together with a collection grant: see {@link hasDcdrKnowledgeAccess}. Since 3.20.0.
   */
  KNOWLEDGE_READ = "knowledge:read",
  /**
   * Search knowledge collections and answer from them (`POST /api/dcdr/knowledge/search`, `/answer`,
   * `/answer/stream`).
   *
   * Separate from {@link KNOWLEDGE_READ} because it spends: every call embeds the query and an answer
   * also runs a model, and both count against the tenant's knowledge limits. Effective only together
   * with a collection grant. Since 3.20.0.
   */
  KNOWLEDGE_RUN = "knowledge:run",
  /**
   * Create collections and upload documents through the API.
   *
   * **Reserved: no endpoint serves it yet.** Collections are configured in the DCDR web UI. It is
   * published now because a scope that appears later under a different name is a scope every stored
   * token has to be re-issued for. Since 3.20.0.
   */
  KNOWLEDGE_WRITE = "knowledge:write",
  /**
   * Grants every knowledge collection of the tenant, present and future.
   *
   * A **target**, not an action: it grants nothing on its own and is combined with
   * {@link KNOWLEDGE_READ} / {@link KNOWLEDGE_RUN}. A single collection is granted with
   * {@link knowledgeCollectionScope} (`knowledge:collection:<key>`). Since 3.20.0.
   */
  KNOWLEDGE_COLLECTIONS_ALL = "knowledge:collections:*",
  /** Everything. */
  FULL_ACCESS = "*",
}

/** Prefix of a per-collection knowledge grant: `knowledge:collection:<key>`. Since 3.20.0. */
export const DCDR_KNOWLEDGE_COLLECTION_SCOPE_PREFIX = "knowledge:collection:";

/** What {@link grantedDcdrKnowledgeCollections} returns when every collection is granted. Since 3.20.0. */
export const DCDR_KNOWLEDGE_ALL_COLLECTIONS = "ALL";

/**
 * The action half of a knowledge access check. Since 3.20.0.
 *
 * The values are the plain words so a caller may pass `"read"` / `"run"` / `"write"` directly.
 */
export enum DcdrKnowledgeAccessAction {
  /** List and read collections and documents: needs {@link DcdrServiceTokenScope.KNOWLEDGE_READ}. */
  READ = "read",
  /** Search and answer: needs {@link DcdrServiceTokenScope.KNOWLEDGE_RUN}. */
  RUN = "run",
  /** Reserved: needs {@link DcdrServiceTokenScope.KNOWLEDGE_WRITE}; no endpoint serves it yet. */
  WRITE = "write",
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

/** Action scope each knowledge action needs. */
const KNOWLEDGE_ACTION_SCOPES: Record<DcdrKnowledgeAccessAction, DcdrServiceTokenScope> = {
  [DcdrKnowledgeAccessAction.READ]: DcdrServiceTokenScope.KNOWLEDGE_READ,
  [DcdrKnowledgeAccessAction.RUN]: DcdrServiceTokenScope.KNOWLEDGE_RUN,
  [DcdrKnowledgeAccessAction.WRITE]: DcdrServiceTokenScope.KNOWLEDGE_WRITE,
};

/**
 * The scope that grants one knowledge collection: `knowledge:collection:<key>`.
 *
 * Built from the collection **key**, never its id: the key is write-once and tenant-unique, so a grant
 * written today still names the same collection tomorrow, in every environment the key exists in. The
 * key is used as it is (trimmed, case and hyphens kept) because scopes compare exactly.
 *
 * @param collectionKey Collection key, e.g. `product-sheets`.
 * @returns The scope string.
 * @throws Error When the key is blank: `knowledge:collection:` would be a grant that names nothing.
 * @since 3.20.0
 */
export function knowledgeCollectionScope(collectionKey: string): string {
  const key = String(collectionKey ?? "").trim();
  if (!key) throw new Error("knowledgeCollectionScope requires a non-empty collection key");
  return `${DCDR_KNOWLEDGE_COLLECTION_SCOPE_PREFIX}${key}`;
}

/**
 * Whether a token may perform a knowledge action on one collection.
 *
 * The rule, in one place so the control plane, the runner and any client apply it identically:
 * **action scope AND collection grant**. The action scope is `knowledge:read`, `knowledge:run` or
 * `knowledge:write`; the grant is `knowledge:collections:*` or `knowledge:collection:<key>`. Either one
 * alone grants nothing - a token with `knowledge:run` and no grant sees no collection at all. `*`
 * satisfies both halves. Scopes are compared exactly, never by prefix.
 *
 * @param scopes Scopes carried by the token.
 * @param action `"read"`, `"run"` or `"write"`.
 * @param collectionKey Key of the collection being reached. A blank key is never granted.
 * @returns `true` when the token may perform the action on that collection.
 * @since 3.20.0
 */
export function hasDcdrKnowledgeAccess(
  scopes: readonly string[] | undefined | null,
  action: DcdrKnowledgeAccessAction | "read" | "run" | "write",
  collectionKey: string,
): boolean {
  if (!Array.isArray(scopes) || !scopes.length) return false;
  const key = String(collectionKey ?? "").trim();
  if (!key) return false;
  if (scopes.includes(DcdrServiceTokenScope.FULL_ACCESS)) return true;

  const actionScope = KNOWLEDGE_ACTION_SCOPES[String(action) as DcdrKnowledgeAccessAction];
  if (!actionScope || !scopes.includes(actionScope)) return false;
  return scopes.includes(DcdrServiceTokenScope.KNOWLEDGE_COLLECTIONS_ALL) || scopes.includes(knowledgeCollectionScope(key));
}

/**
 * Which knowledge collections a token's grants name, for filtering a listing.
 *
 * Answers the **target** half only; whether the token may read or run is
 * {@link hasDcdrKnowledgeAccess}'s question. `*` and `knowledge:collections:*` both mean every
 * collection; `knowledge:collection:*` is not a wildcard (it would be a collection whose key is `*`).
 *
 * @param scopes Scopes carried by the token.
 * @returns {@link DCDR_KNOWLEDGE_ALL_COLLECTIONS} (`"ALL"`), or the granted keys in the order they
 * appear, without duplicates - empty when nothing is granted.
 * @since 3.20.0
 */
export function grantedDcdrKnowledgeCollections(scopes: readonly string[] | undefined | null): "ALL" | string[] {
  if (!Array.isArray(scopes) || !scopes.length) return [];
  if (scopes.includes(DcdrServiceTokenScope.FULL_ACCESS) || scopes.includes(DcdrServiceTokenScope.KNOWLEDGE_COLLECTIONS_ALL)) {
    return DCDR_KNOWLEDGE_ALL_COLLECTIONS;
  }
  const keys: string[] = [];
  for (const scope of scopes) {
    if (typeof scope !== "string" || !scope.startsWith(DCDR_KNOWLEDGE_COLLECTION_SCOPE_PREFIX)) continue;
    const key = scope.slice(DCDR_KNOWLEDGE_COLLECTION_SCOPE_PREFIX.length).trim();
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
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

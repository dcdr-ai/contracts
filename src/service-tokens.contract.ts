/**
 * Snapshot of allowed (and revoked) customer service tokens.
 *
 * IMPORTANT:
 * - Never include tokens in clear.
 * - Tokens are referenced by sha256(utf8(tokenString)) in hex.
 * - Backend should keep this snapshot stable & ordered for reproducible ETags.
 */
import { DcdrAssetScope } from "./asset.contract";
import { ProcessingProcessor } from "./processing.contract";
import { IntentType } from "./intent.contract";
import { IntentProvider } from "./provider.contract";
import { DcdrProviderLimitsConfig } from "./provider-limits.contract";
import { TelemetryEndUserIdMode, TelemetryPayloadLevel } from "./telemetry.contract";

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
  /**
   * Send OpenTelemetry telemetry to the runtime (`POST /v1/traces` and `POST /v1/logs`). Since 3.25.0.
   *
   * Separate from {@link LOGS_WRITE}, which keeps its meaning (runtime write-back to the control plane):
   * a token handed to an external AI app to export its traces should grant nothing else.
   */
  TRACES_WRITE = "traces:write",
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
 * One model an `OPEN_AI_COMPATIBLE` gateway binding exposes (3.28.0). There is no catalog behind these:
 * the binding's owner says what the server serves.
 */
export interface DcdrServiceTokenGatewayCompatibleModel {
  /** Exact model id sent upstream. */
  id: string;
  /**
   * `IntentType.CHAT` (default) or `IntentType.EMBEDDING`; any other value is ignored and the model is
   * `CHAT`. Decides which gateway routes accept the model (`/v1/embeddings` only takes `EMBEDDING`).
   */
  type?: IntentType;
}

/**
 * Gateway binding for one provider.
 *
 * Notes
 * - `credentialRef` uses the same reference concept already used elsewhere in
 *   DCDR contracts.
 * - Runtime/backend should treat `provider` as unique within one token's
 *   `gatewayBindings` array, **except `OPEN_AI_COMPATIBLE`** (3.28.0): a token may carry several
 *   `OPEN_AI_COMPATIBLE` bindings, one per `alias`, and at most one without `alias`. Validate them with
 *   {@link validateDcdrGatewayCompatibleBinding}.
 * - `baseUrl`, `alias` and `models` are read on `OPEN_AI_COMPATIBLE` bindings only; on any other
 *   provider they are ignored.
 */
export interface DcdrServiceTokenGatewayProviderBinding {
  provider: IntentProvider;
  credentialRef: string;
  /**
   * 3.28.0, `OPEN_AI_COMPATIBLE` only: server base URL (`http(s)://host[:port][/path]`, no credentials,
   * query or fragment); the runtime appends `/v1` unless it already ends in `/v1`. Without it the runtime's
   * env `DCDR_GATEWAY_OPENAI_COMPATIBLE_BASE_URL` applies (installs); a blank string counts as absent. A binding URL whose host resolves to
   * a private, loopback, link-local or metadata address is refused unless the runtime operator allows it.
   */
  baseUrl?: string;
  /**
   * 3.28.0, `OPEN_AI_COMPATIBLE` only: model prefix, so callers name `<alias>/<model>`. Matches
   * {@link DCDR_GATEWAY_COMPATIBLE_ALIAS_PATTERN}, unique per token, never a provider prefix
   * ({@link DCDR_GATEWAY_RESERVED_MODEL_PREFIXES}). Without it (or blank) the binding answers `openai-compatible/<model>`.
   */
  alias?: string;
  /**
   * 3.28.0, `OPEN_AI_COMPATIBLE` only: models this binding exposes (no catalog). Absent or `null`: the
   * runtime's env `DCDR_GATEWAY_OPENAI_COMPATIBLE_MODEL_IDS` applies. `[]` exposes no model.
   */
  models?: DcdrServiceTokenGatewayCompatibleModel[];
}

/**
 * Shape of an `OPEN_AI_COMPATIBLE` binding alias (3.28.0): lower case letters, digits and `-`, starting with
 * a letter or digit, at most 32 characters.
 */
export const DCDR_GATEWAY_COMPATIBLE_ALIAS_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * Model prefixes the gateway already reads as a provider (3.28.0); an `OPEN_AI_COMPATIBLE` binding alias can
 * never be one of them. `openai-compatible` names the binding without alias; `dcdr` is the DCDR virtual
 * provider.
 */
export const DCDR_GATEWAY_RESERVED_MODEL_PREFIXES: readonly string[] = [
  "openai",
  "anthropic",
  "gemini",
  "grok",
  "xai",
  "mistral",
  "office",
  "openai-compatible",
  "dcdr",
];

/** Why an `OPEN_AI_COMPATIBLE` gateway binding is not valid (3.28.0). */
export enum DcdrGatewayCompatibleBindingIssueCode {
  /** `alias` is not a string matching {@link DCDR_GATEWAY_COMPATIBLE_ALIAS_PATTERN}. */
  ALIAS_INVALID = "ALIAS_INVALID",
  /** `alias` is one of {@link DCDR_GATEWAY_RESERVED_MODEL_PREFIXES}. */
  ALIAS_RESERVED = "ALIAS_RESERVED",
  /** Another `OPEN_AI_COMPATIBLE` binding on the token has the same `alias`. */
  ALIAS_DUPLICATE = "ALIAS_DUPLICATE",
  /** Another `OPEN_AI_COMPATIBLE` binding on the token has no `alias` either. */
  UNALIASED_DUPLICATE = "UNALIASED_DUPLICATE",
  /** `baseUrl` is not an absolute `http(s)` URL without credentials, query or fragment. */
  BASE_URL_INVALID = "BASE_URL_INVALID",
  /** `models` is not an array, or an entry has no non-empty string `id`. */
  MODEL_INVALID = "MODEL_INVALID",
  /** Two entries of `models` share an `id` and a type. */
  MODEL_DUPLICATE = "MODEL_DUPLICATE",
}

/** One problem {@link validateDcdrGatewayCompatibleBinding} found (3.28.0). */
export interface DcdrGatewayCompatibleBindingIssue {
  code: DcdrGatewayCompatibleBindingIssueCode;
  /** The binding field at fault: `alias`, `baseUrl` or `models[<index>]`. */
  field: string;
  /** Human readable, safe to show to the token's owner. */
  message: string;
}

/**
 * The model type an `OPEN_AI_COMPATIBLE` binding model is served as (3.28.0): `EMBEDDING` when it says so,
 * `CHAT` otherwise (absent or any other value).
 *
 * @param model The binding model entry.
 * @returns `IntentType.EMBEDDING` or `IntentType.CHAT`.
 */
export function dcdrGatewayCompatibleModelType(model: Pick<DcdrServiceTokenGatewayCompatibleModel, "type">): IntentType {
  return model?.type === IntentType.EMBEDDING ? IntentType.EMBEDDING : IntentType.CHAT;
}

/**
 * Normalises an `OPEN_AI_COMPATIBLE` binding `baseUrl` into the upstream base the gateway calls (3.28.0):
 * trailing slashes dropped and `/v1` appended unless the path already ends in `/v1`.
 *
 * Pure (WHATWG `URL` only), so the control plane can validate on write with the runtime's exact rule.
 *
 * @param baseUrl The binding's `baseUrl`.
 * @returns The normalised base (`https://host[:port][/path]/v1`), or null when it is not an absolute
 *          `http(s)` URL without credentials, query or fragment.
 */
export function normalizeDcdrGatewayCompatibleBaseUrl(baseUrl: string | null | undefined): string | null {
  if (typeof baseUrl !== "string") return null;
  const raw = baseUrl.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname || url.username || url.password || url.search || url.hash) return null;
  // `raw.includes("?"/"#")` catches an empty query or fragment, which `URL` reports as "".
  if (raw.includes("?") || raw.includes("#")) return null;
  const base = `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, "");
  return /\/v1$/i.test(base) ? base : `${base}/v1`;
}

/**
 * Whether an optional `OPEN_AI_COMPATIBLE` binding field (`alias`, `baseUrl`) is set (3.28.0). Absent, `null` and a
 * blank string all mean "not set", so a form that sends `""` for an empty field means the same as one that omits it.
 *
 * @param value The field's value.
 * @returns False for `undefined`, `null` and blank strings; true for anything else (a non-string is set, and invalid).
 */
export function hasDcdrGatewayCompatibleField(value: string | null | undefined): boolean {
  if (value === undefined || value === null) return false;
  return typeof value !== "string" || value.trim().length > 0;
}

/**
 * Validates one `OPEN_AI_COMPATIBLE` gateway binding against the token's whole `gatewayBindings` (3.28.0).
 *
 * Checks `alias` (shape, reserved prefixes, unique among the token's `OPEN_AI_COMPATIBLE` bindings, at most one
 * binding without alias), `baseUrl` (see {@link normalizeDcdrGatewayCompatibleBaseUrl}) and `models` (array of
 * entries with a non-empty `id`, no repeated `id` within one type). A binding of any other provider has no
 * issues: these fields are ignored there. Duplicates are reported on every binding involved.
 *
 * The runtime ignores a binding with an alias issue (`ALIAS_*`, `UNALIASED_DUPLICATE`) and answers
 * `upstream_base_url_invalid` for one with `BASE_URL_INVALID`; invalid `models` entries are skipped. The
 * control plane should refuse all of them on write.
 *
 * @param binding The binding to check.
 * @param allBindings Every binding on the token, `binding` included (compared by identity).
 * @returns The issues found; empty when the binding is valid.
 */
export function validateDcdrGatewayCompatibleBinding(
  binding: DcdrServiceTokenGatewayProviderBinding,
  allBindings: readonly DcdrServiceTokenGatewayProviderBinding[],
): DcdrGatewayCompatibleBindingIssue[] {
  const issues: DcdrGatewayCompatibleBindingIssue[] = [];
  if (!binding || binding.provider !== IntentProvider.OPEN_AI_COMPATIBLE) return issues;

  const others = (Array.isArray(allBindings) ? allBindings : []).filter(
    (other) => other !== binding && Boolean(other) && other.provider === IntentProvider.OPEN_AI_COMPATIBLE,
  );
  const alias = binding.alias;
  if (!hasDcdrGatewayCompatibleField(alias)) {
    if (others.some((other) => !hasDcdrGatewayCompatibleField(other.alias))) {
      issues.push({
        code: DcdrGatewayCompatibleBindingIssueCode.UNALIASED_DUPLICATE,
        field: "alias",
        message: "Only one OPEN_AI_COMPATIBLE binding per token may have no alias.",
      });
    }
  } else if (typeof alias !== "string" || !DCDR_GATEWAY_COMPATIBLE_ALIAS_PATTERN.test(alias)) {
    issues.push({
      code: DcdrGatewayCompatibleBindingIssueCode.ALIAS_INVALID,
      field: "alias",
      message: "Alias must be 1-32 lower case letters, digits or '-', starting with a letter or digit.",
    });
  } else if (DCDR_GATEWAY_RESERVED_MODEL_PREFIXES.includes(alias)) {
    issues.push({
      code: DcdrGatewayCompatibleBindingIssueCode.ALIAS_RESERVED,
      field: "alias",
      message: `Alias '${alias}' is a provider prefix and cannot name a binding.`,
    });
  } else if (others.some((other) => other.alias === alias)) {
    issues.push({
      code: DcdrGatewayCompatibleBindingIssueCode.ALIAS_DUPLICATE,
      field: "alias",
      message: `Alias '${alias}' is used by another OPEN_AI_COMPATIBLE binding of this token.`,
    });
  }

  if (hasDcdrGatewayCompatibleField(binding.baseUrl) && !normalizeDcdrGatewayCompatibleBaseUrl(binding.baseUrl)) {
    issues.push({
      code: DcdrGatewayCompatibleBindingIssueCode.BASE_URL_INVALID,
      field: "baseUrl",
      message: "Base URL must be an absolute http(s) URL without credentials, query or fragment.",
    });
  }

  const models = binding.models;
  if (models !== undefined && models !== null) {
    if (!Array.isArray(models)) {
      issues.push({
        code: DcdrGatewayCompatibleBindingIssueCode.MODEL_INVALID,
        field: "models",
        message: "Models must be a list of { id, type }.",
      });
    } else {
      const seen = new Set<string>();
      models.forEach((model, index) => {
        const id = model && typeof model.id === "string" ? model.id.trim() : "";
        if (!id) {
          issues.push({
            code: DcdrGatewayCompatibleBindingIssueCode.MODEL_INVALID,
            field: `models[${index}]`,
            message: "Each model needs a non-empty id.",
          });
          return;
        }
        const key = `${dcdrGatewayCompatibleModelType(model)}:${id}`;
        if (seen.has(key)) {
          issues.push({
            code: DcdrGatewayCompatibleBindingIssueCode.MODEL_DUPLICATE,
            field: `models[${index}]`,
            message: `Model '${id}' is listed twice.`,
          });
        }
        seen.add(key);
      });
    }
  }
  return issues;
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

  /**
   * How much content of this token's gateway calls leaves the runtime (since 3.27.0); same vocabulary as
   * telemetry services. Absent: no content capture at all, the gateway log is what it was before 3.27.0.
   *
   * Parity field: in 3.27 the runtime reads the gateway content settings from the token check
   * ({@link DcdrGatewayTokenCheckResponse.payloadLevel}), not from the snapshot.
   */
  payloadLevel?: TelemetryPayloadLevel;

  /**
   * How the end user id named on this token's gateway calls leaves the runtime (since 3.27.0). Absent:
   * pseudonymised. Parity field, read from the token check in 3.27.
   */
  endUserIdMode?: TelemetryEndUserIdMode;

  /**
   * The token's own processors for captured gateway content (since 3.27.0); INPUT stage on `input` and `system`,
   * OUTPUT stage on `output`. They act on the captured copy only, never on the traffic to the provider or the
   * client. Parity field, read from the token check in 3.27.
   */
  processors?: ProcessingProcessor[];

  /**
   * Whether the tenant's global processors run on captured gateway content before the token's own (since
   * 3.27.0). Parity field, read from the token check in 3.27.
   */
  applyGlobalProcessors?: boolean;

  /** Optional note for operators. */
  note?: string;
};

/**
 * Tenant-wide settings for gateway content capture (since 3.27.0).
 *
 * The key is the same per-tenant key as telemetry (`DcdrTelemetryTenantSettings.userIdKey`): the gateway's
 * end user pseudonyms and content hashes use `telemetryEndUserPseudonym` with it, so a gateway call and a telemetry
 * span of the same user or the same prompt carry the same value.
 */
export interface DcdrServiceTokensContentSettings {
  /** Per-tenant key, 32 random bytes, base64. Never logged on either side. */
  userIdKey: string;
  /** Increments on every rotation; carried as `keyVersion` / `hashKeyVersion` next to every pseudonym and hash. */
  userIdKeyVersion: number;
}

export type DcdrServiceTokensSnapshotContract = {
  cid: string;
  tokens: DcdrServiceTokenSnapshotItem[];
  /** Snapshot issued at (unix ms). Optional. */
  iat?: number;
  /**
   * Tenant settings for gateway content capture (since 3.27.0).
   *
   * **Per-tenant snapshot route only** (the tenant's own `service-tokens` snapshot), never on the token check
   * response and never on any multi-tenant listing: it carries the tenant key. Absent, or a key that does not
   * decode to at least `DCDR_TELEMETRY_HASH_KEY_MIN_BYTES`: the gateway computes no hash and sends no end user
   * it would have to pseudonymise (fail closed).
   */
  contentSettings?: DcdrServiceTokensContentSettings;
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
  /**
   * Payload level of the token's gateway calls (since 3.27.0). Absent (a control plane older than 3.27.0): no
   * content capture, the gateway log is exactly what it was before. `NONE` -> counts; `METADATA` -> counts and
   * content summary; `FULL` -> also the content after processors.
   */
  payloadLevel?: TelemetryPayloadLevel;
  /** How the end user id named on the token's gateway calls leaves the runtime (since 3.27.0). Absent: pseudonymised. */
  endUserIdMode?: TelemetryEndUserIdMode;
  /** The token's processors for captured gateway content, as on the snapshot item (since 3.27.0). */
  processors?: ProcessingProcessor[];
  /** Whether the tenant's global processors run on captured content first, as on the snapshot item (since 3.27.0). */
  applyGlobalProcessors?: boolean;
  token?: {
    id?: string;
    name?: string;
    kind?: DcdrServiceTokenKind;
    scopes?: string[];
    gatewayBindings?: DcdrServiceTokenGatewayProviderBinding[];
    providerLimits?: DcdrProviderLimitsConfig;
    rules?: DcdrServiceTokenLimitRule[];
    allowedModels?: DcdrServiceTokenLimitRuleModelRef[] | null;
    /** As {@link DcdrGatewayTokenCheckResponse.payloadLevel} (since 3.27.0). */
    payloadLevel?: TelemetryPayloadLevel;
    /** As {@link DcdrGatewayTokenCheckResponse.endUserIdMode} (since 3.27.0). */
    endUserIdMode?: TelemetryEndUserIdMode;
    /** As {@link DcdrGatewayTokenCheckResponse.processors} (since 3.27.0). */
    processors?: ProcessingProcessor[];
    /** As {@link DcdrGatewayTokenCheckResponse.applyGlobalProcessors} (since 3.27.0). */
    applyGlobalProcessors?: boolean;
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

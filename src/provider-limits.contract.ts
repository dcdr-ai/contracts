import { IntentProvider } from "./provider.contract";
import { DcdrServiceTokenLimitType } from "./service-tokens.contract";

/**
 * Tenant-level provider/model limiting gate used by DCDR governance.
 *
 * Notes
 * - Missing/undefined values preserve permissive behavior by default.
 * - This contract carries configuration only; live metering/enforcement is a
 *   runtime/backend responsibility.
 */
export interface DcdrProviderLimitGate {
  /** Missing/true = allowed. `false` = fully blocked. */
  enabled?: boolean;

  /** Max execution calls allowed within `maxCallsPeriod`. `null` = unlimited. */
  maxCalls?: number | null;

  /**
   * Window type for `maxCalls`. Only meaningful when `maxCalls` is set.
   *
   * Notes
   * - `FIXED` is not a valid product period for Provider Limits (unlike service-token
   *   limits, there is no signed-token lifetime for it to tie to). Policy: reject on
   *   write — backend must require an explicit `HOUR`/`DAY`/`MONTH` whenever `maxCalls`
   *   is set, and the admin UI must not offer `FIXED` as a choice here. Coerce on read —
   *   for legacy/invalid data that already has `FIXED` persisted, backend and runtime
   *   both treat it as `LIMITED_BY_MONTH` so the two sides never compute different
   *   window buckets for the same stored value.
   */
  maxCallsPeriod?: DcdrServiceTokenLimitType;

  /** Max spend allowed within `maxBudgetPeriod`. `null` = unlimited. */
  maxBudget?: number | null;

  /** Window type for `maxBudget`. Only meaningful when `maxBudget` is set. Same `FIXED` policy as `maxCallsPeriod` (reject on write, coerce to `LIMITED_BY_MONTH` on read). */
  maxBudgetPeriod?: DcdrServiceTokenLimitType;

  /**
   * Optional backend-computed usage baseline for this gate's windows.
   *
   * Notes
   * - Additive: omitted means the runtime has no cross-node baseline for this gate,
   *   so `maxCalls` enforcement falls back to local-only counting since this node
   *   started, and `maxBudget` enforcement is skipped entirely (no local cost fallback).
   */
  usage?: DcdrProviderLimitUsageBaseline;
}

/**
 * Backend-computed usage baseline for one governance window (calls or budget).
 *
 * Notes
 * - `calls` and `budget` are independent because `maxCallsPeriod` and `maxBudgetPeriod`
 *   on the same gate may use different window granularities (e.g. calls capped daily,
 *   budget capped monthly) — a single shared `periodKey` could not represent both.
 * - A baseline is only valid for the window bucket it names in `periodKey`. If the
 *   runtime's current bucket does not match, the runtime must treat the baseline as 0
 *   (same rule already used for `DcdrEntitlementUsageBaseline.periodKey`).
 * - Mirrors backend `AICallLog` aggregates; runtime never derives spend locally.
 */
export interface DcdrProviderLimitUsageBaseline {
  /** Backend-aggregated call count for the current `maxCallsPeriod` window. */
  calls?: {
    /** Window bucket key, e.g. "2026-07" (MONTH), "2026-07-21" (DAY), "2026-07-21-14" (HOUR). */
    periodKey: string;
    /** Calls already consumed in this window, across all runtime nodes. */
    consumed: number;
  };

  /** Backend-aggregated USD spend for the current `maxBudgetPeriod` window. */
  budget?: {
    /** Window bucket key (same format as `calls.periodKey`). */
    periodKey: string;
    /** USD spend already consumed in this window, across all runtime nodes. */
    consumedUsd: number;
  };
}

/**
 * Per-provider gate plus optional per-model overrides.
 *
 * Notes
 * - Model ids remain free strings rather than a closed enum because the public
 *   provider catalog is large and versioned independently of tenant config.
 */
export interface DcdrProviderLimitEntry extends DcdrProviderLimitGate {
  models?: Record<string, DcdrProviderLimitGate>;
}

/**
 * Tenant-scoped provider limits configuration.
 */
export interface DcdrProviderLimitsConfig {
  providers?: Partial<Record<IntentProvider, DcdrProviderLimitEntry>>;
}

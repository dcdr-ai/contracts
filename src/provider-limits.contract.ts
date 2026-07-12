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

  /** Window type for `maxCalls`. Only meaningful when `maxCalls` is set. */
  maxCallsPeriod?: DcdrServiceTokenLimitType;

  /** Max spend allowed within `maxBudgetPeriod`. `null` = unlimited. */
  maxBudget?: number | null;

  /** Window type for `maxBudget`. Only meaningful when `maxBudget` is set. */
  maxBudgetPeriod?: DcdrServiceTokenLimitType;
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

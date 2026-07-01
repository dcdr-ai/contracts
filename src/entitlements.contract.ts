/**
 * Generic entitlement snapshot for a gateway/runtime.
 *
 * Keep this contract business-agnostic:
 * - "limits" are pure technical quotas
 * - "usageBaseline" is a snapshot for the current billing window
 *
 * Backend remains source-of-truth; runtime uses snapshot + local delta.
 */

import { DcdrAssetStorageDescriptor } from "./asset.contract";
import { SubscriptionStatus } from "./subscription.contract";

/**
 * Hard/soft technical limits enforced by the runtime.
 */
export interface DcdrEntitlementLimits {
  /** Hard limit (monthly). Null = unlimited. */
  maxCallsPerMonth: number | null;

  /** Optional hard limits for shorter windows. Null = unlimited / not enforced. */
  maxCallsPerHour?: number | null;
  maxCallsPerDay?: number | null;

  /** Soft limit: after this, runtime should disable I/O tracking/log enrichment. */
  maxTrackedCallsPerMonth?: number | null;
}

/**
 * Backend-provided usage baseline for the current billing window.
 * Runtime uses this + local counters to enforce quotas.
 */
export interface DcdrEntitlementUsageBaseline {
  /** Billing window key in UTC, e.g. "2026-03" */
  periodKey: string;

  /** Baseline calls already accounted for in backend for this period. */
  callsThisMonth: number;

  /** Baseline tracked calls already accounted for (optional). */
  trackedCallsThisMonth?: number;

  /** SUM(trackedCallsConsumed) — credit-weighted quota counter. Use this for limit enforcement. */
  creditsThisMonth?: number;

  /** SUM(trackedCallsConsumed) for tracked calls only. */
  trackedCreditsThisMonth?: number;
}

/**
 * Optional business-level limits (primarily used by UI/control plane).
 *
 * Notes
 * - Runtime should not rely on these for critical enforcement.
 * - These fields are included so clients can display subscription/plan info.
 */
export interface DcdrBusinessLimitsContract {
  maxUsers?: number;
  maxServiceTokens?: number;
  logRetentionDays?: number;
  maxIntents?: number;
  maxImplementations?: number;
  maxPromptTemplates?: number;
  maxCredentials?: number;
  maxExecutionWindows?: number;
  maxWebhooks?: number;
}

/**
 * Optional business-level usage counters (primarily used by UI/control plane).
 */
export interface DcdrBusinessUsageContract {
  users?: number;
  serviceTokens?: number;
  implementations?: number;
  intents?: number;
  promptTemplates?: number;
  credentials?: number;
  executionWindows?: number;
  webhooks?: number;
}

/**
 * Entitlements snapshot returned by the backend and cached in the runtime.
 *
 * Notes
 * - Runtime enforces `limits` and uses `usageBaseline`.
 * - Other fields are optional and mainly for diagnostics / UI parity.
 */
export interface DcdrEntitlementsContract {
  cid: string;
  limits: DcdrEntitlementLimits;
  usageBaseline: DcdrEntitlementUsageBaseline;

  /** Optional tenant-managed asset storages available in cloud mode. */
  assetStorages?: DcdrAssetStorageDescriptor[];

  /**
   * Optional gate controlling whether the tenant can use the paid DCDR virtual provider.
   *
   * Notes
   * - Additive and fail-open: when omitted, the runtime must assume the virtual provider is enabled.
   * - Intended for wallet/balance enforcement in managed (cloud) mode without affecting BYOK providers.
   */
  dcdrVirtual?: {
    /** When false, runtime must block executions that target `IntentProvider.DCDR`. */
    enabled: boolean;

    /** Optional business-friendly reason code (no sensitive details). */
    reason?: string;

    /** Optional hint for clients on when to retry (ms). */
    retryAfterMs?: number;
  };

  /** Optional reset time for quotas (unix ms). */
  resetAt?: number;

  /** Issued at (unix ms). Optional. */
  iat?: number;

  /** Optional subscription/contract status (backend-defined), e.g. `TRIAL`. */
  subscriptionStatus?: SubscriptionStatus;

  /** Optional subscription end date (unix ms). */
  subscriptionEndDateMs?: number;

  /** Optional log retention in days (may mirror businessLimits.logRetentionDays). */
  logRetentionDays?: number;

  /** Optional business/UI limits snapshot. */
  businessLimits?: DcdrBusinessLimitsContract;

  /** Optional business/UI usage snapshot. */
  businessUsage?: DcdrBusinessUsageContract;
}

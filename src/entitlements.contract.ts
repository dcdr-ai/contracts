/**
 * Generic entitlement snapshot for a gateway/runtime.
 *
 * Keep this contract business-agnostic:
 * - "limits" are pure technical quotas
 * - "usageBaseline" is a snapshot for the current billing window
 *
 * Backend remains source-of-truth; runtime uses snapshot + local delta.
 */

export type DcdrEntitlementLimits = {
  /** Hard limit (monthly). Null = unlimited. */
  maxCallsPerMonth: number | null;

  /** Optional hard limits for shorter windows. Null = unlimited / not enforced. */
  maxCallsPerHour?: number | null;
  maxCallsPerDay?: number | null;

  /** Soft limit: after this, runtime should disable I/O tracking/log enrichment. */
  maxTrackedCallsPerMonth?: number | null;
};

export type DcdrEntitlementUsageBaseline = {
  /** Billing window key in UTC, e.g. "2026-03" */
  periodKey: string;

  /** Baseline calls already accounted for in backend for this period. */
  callsThisMonth: number;

  /** Baseline tracked calls already accounted for (optional). */
  trackedCallsThisMonth?: number;
};

export type DcdrEntitlementsContract = {
  cid: string;
  limits: DcdrEntitlementLimits;
  usageBaseline: DcdrEntitlementUsageBaseline;

  /** Optional reset time for quotas (unix ms). */
  resetAt?: number;

  /** Issued at (unix ms). Optional. */
  iat?: number;
};

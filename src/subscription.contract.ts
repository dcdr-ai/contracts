/**
 * Subscription/contract status for customer entitlements.
 *
 * Notes
 * - Kept in contracts to avoid scattering status lists across services.
 * - This aligns with backend contract lifecycle, but uses a generic name to reduce collisions.
 */
export enum SubscriptionStatus {
  DRAFT = "DRAFT",
  TRIAL = "TRIAL",
  ACTIVE = "ACTIVE",
  ENDED = "ENDED",
  SUSPENDED = "SUSPENDED",
  CANCELED = "CANCELED",
}

/**
 * Centralized policy helpers for {@link SubscriptionStatus}.
 */
export class SubscriptionStatusPolicy {
  /**
   * Returns the statuses that are considered valid for a contract to exist for downstream consumers.
   *
   * Notes
   * - Some surfaces (e.g. BI) may allow ENDED contracts to remain visible.
   * - Keep this centralized to avoid scattering status lists across the codebase.
   */
  static validStatuses(): SubscriptionStatus[] {
    return [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.ENDED];
  }

  /**
   * Returns the statuses that are considered valid to show *current* data.
   *
   * Notes
   * - This excludes ENDED/SUSPENDED/CANCELED.
   * - Keep this centralized to avoid scattering status lists across the codebase.
   */
  static validStatusesToShowCurrentData(): SubscriptionStatus[] {
    return [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL];
  }
}

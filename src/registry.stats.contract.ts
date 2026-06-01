/**
 * Aggregated registry stats for internal ops.
 *
 * Notes
 * - Intended for server-to-server usage (runtime ↔ backend).
 * - Contains only counts/rollups; does not include per-customer registry payloads.
 */

export interface DcdrRegistryStatsCustomersBlock {
  active: number;
  total: number;
}

export interface DcdrRegistryStatsRegistriesBlock {
  activeCustomersWithRegistry: number;
  totalCustomersWithRegistry: number;
}

export interface DcdrRegistryStatsRecentUsageWindow {
  sinceISO: string;
  calls: number;
  customersWithCalls: number;
  customersPct: number;
}

export interface DcdrRegistryStatsRecentUsageBlock {
  last1h: DcdrRegistryStatsRecentUsageWindow;
  last6h: DcdrRegistryStatsRecentUsageWindow;
  last24h: DcdrRegistryStatsRecentUsageWindow;
}

export interface DcdrRegistryStatsWorkloadBlock {
  totalIntents: number;
  totalImplementations: number;
  recentAICallLogsUsage: DcdrRegistryStatsRecentUsageBlock;
}

export interface DcdrInternalRegistryStatsResponse {
  sampledAt: string;
  includeInactive: boolean;
  customers: DcdrRegistryStatsCustomersBlock;
  registries: DcdrRegistryStatsRegistriesBlock;
  workload: DcdrRegistryStatsWorkloadBlock;
}

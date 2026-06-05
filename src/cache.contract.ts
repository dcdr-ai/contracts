/**
 * Cache-related shared constants.
 */

/**
 * Default Redis Pub/Sub channel name for tenant registry invalidation hints.
 *
 * Notes
 * - Intended for backend-driven (preferred) or runtime-driven invalidation broadcasts.
 * - Pub/Sub is server-global; this channel name does not depend on Redis `db` selection.
 * - Keep this stable (cross-service coordination).
 */
export const DCDR_TENANT_REGISTRY_INVALIDATION_CHANNEL =
  "dcdr:tenant-registry:invalidate";
